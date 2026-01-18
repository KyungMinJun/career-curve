import { useState, useMemo } from "react";
import {
  LayoutGrid,
  Table2,
  Filter,
  ArrowUpDown,
  ArrowRight,
  Loader2,
  AlertCircle,
  Link,
} from "lucide-react";
import logoImage from "@/assets/logo.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/hooks/useAuth";
import { KanbanView } from "@/components/board/KanbanView";
import { TableView } from "@/components/board/TableView";
import { JobStatus } from "@/types/job";
import { cn } from "@/lib/utils";
import { STATUS_ORDER } from "@/components/board/constants";
import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage } from "@/integrations/supabase/functionErrors";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ViewMode = "kanban" | "table";
type SortOption = "newest" | "oldest" | "priority" | "company";

// 필터 옵션: 경력/근무형태/위치 기준
interface FilterState {
  minExperience: string;
  workType: string;
  location: string;
}

// Display order for select dropdown (different from kanban order)
const STATUS_SELECT_ORDER: JobStatus[] = [
  "reviewing",
  "applied",
  "interview",
  "offer",
  "rejected-docs",
  "rejected-interview",
  "accepted",
  "closed",
];

const SORT_LABELS: Record<SortOption, string> = {
  newest: "최신순",
  oldest: "오래된순",
  priority: "추천순",
  company: "회사명순 (한글→영문)",
};

// URL 분석 관련 상수
const JOB_URL_KEYWORDS = [
  "career",
  "careers",
  "job",
  "jobs",
  "recruit",
  "recruiting",
  "hire",
  "hiring",
  "position",
  "vacancy",
  "opening",
  "apply",
  "talent",
  "greenhouse",
  "lever",
  "workable",
  "ashbyhq",
];

function isLikelyJobUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return JOB_URL_KEYWORDS.some((keyword) => lowerUrl.includes(keyword));
}

function isUrl(text: string): boolean {
  try {
    new URL(text);
    return true;
  } catch {
    return !!text.match(
      /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i
    );
  }
}

// Load filters from localStorage
const loadSavedFilters = (): FilterState => {
  try {
    const saved = localStorage.getItem("curve-board-filters");
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load filters", e);
  }
  return { minExperience: "", workType: "", location: "" };
};

export function BoardTab() {
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [sortOption, setSortOption] = useState<SortOption>("priority");
  const [filters, setFiltersState] = useState<FilterState>(loadSavedFilters);

  // URL 입력 관련 상태
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [noContentDialogOpen, setNoContentDialogOpen] = useState(false);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const {
    jobPostings,
    currentGoals,
    updateJobPosting,
    addJobPosting,
    canAddJob,
    subscription,
    hasAiCredits,
  } = useData();
  const { user } = useAuth();
  const userName =
    user?.user_metadata?.name_ko ||
    user?.user_metadata?.name_en ||
    user?.email ||
    "사용자";
  const currentGoal = currentGoals[0] ?? null;

  const isAtJobLimit = !canAddJob(jobPostings.length);
  const hasAnalysisCredits = hasAiCredits();

  // Check if URL was already shared
  const findExistingJobByUrl = (url: string) => {
    return jobPostings.find((job) => job.sourceUrl === url);
  };

  // Edge function 호출하여 공고 분석
  const analyzeJobUrl = async (url: string): Promise<any> => {
    const { data, error } = await supabase.functions.invoke("analyze-job", {
      body: { url },
    });

    if (error) {
      console.error("Edge function error:", error);
      throw new Error(getFunctionErrorMessage(error, "공고 분석에 실패했습니다."));
    }

    if (!data?.success) {
      throw new Error(data?.error || "공고 분석에 실패했습니다.");
    }

    return data.data;
  };

  // 공고 URL 처리
  const processJobUrl = async (url: string) => {
    if (!hasAnalysisCredits) {
      toast.error("AI 분석 크레딧이 부족합니다. 요금제를 업그레이드해주세요.");
      return;
    }

    setIsProcessing(true);

    try {
      const jobData = await analyzeJobUrl(url);

      await addJobPosting({
        companyName: jobData.companyName || "회사명 확인 필요",
        title: jobData.title || "채용 공고",
        status: "reviewing",
        priority: 0,
        position: jobData.position || "미정",
        language: jobData.language || "ko",
        minExperience: jobData.minExperience,
        workType: jobData.workType,
        location: jobData.location,
        visaSponsorship: jobData.visaSponsorship,
        summary: jobData.summary || "공고 내용을 확인해주세요.",
        companyScore:
          typeof jobData.companyScore === "number"
            ? jobData.companyScore
            : undefined,
        fitScore:
          typeof jobData.fitScore === "number" ? jobData.fitScore : undefined,
        keyCompetencies: jobData.keyCompetencies || [],
        sourceUrl: url,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      toast.success(
        `${jobData.companyName} - ${jobData.title} 공고가 추가되었습니다`
      );
    } catch (error: any) {
      console.error("Error analyzing job:", error);

      if (
        error?.message?.includes("추출할 수 없습니다") ||
        error?.message?.includes("noContent")
      ) {
        setPendingUrl(url);
        setNoContentDialogOpen(true);
      } else {
        toast.error(error instanceof Error ? error.message : "공고 분석 실패");
      }
    } finally {
      setIsProcessing(false);
      setInputValue("");
    }
  };

  // 폼 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const urlToAnalyze = inputValue.trim();

    if (!isUrl(urlToAnalyze)) {
      toast.error("올바른 URL을 입력해주세요");
      return;
    }

    // 공고 한도 체크
    if (isAtJobLimit) {
      setPendingUrl(urlToAnalyze);
      setLimitDialogOpen(true);
      return;
    }

    // 중복 체크
    const existingJob = findExistingJobByUrl(urlToAnalyze);
    if (existingJob) {
      setPendingUrl(urlToAnalyze);
      setDuplicateDialogOpen(true);
      return;
    }

    // 채용 공고 URL인지 체크
    if (!isLikelyJobUrl(urlToAnalyze)) {
      setPendingUrl(urlToAnalyze);
      setConfirmDialogOpen(true);
      return;
    }

    await processJobUrl(urlToAnalyze);
  };

  // 다이얼로그 핸들러들
  const handleConfirmJobUrl = async () => {
    setConfirmDialogOpen(false);
    if (pendingUrl) {
      await processJobUrl(pendingUrl);
      setPendingUrl(null);
    }
  };

  const handleCancelJobUrl = () => {
    setConfirmDialogOpen(false);
    setPendingUrl(null);
  };

  const handleDuplicateConfirm = async () => {
    setDuplicateDialogOpen(false);
    if (pendingUrl) {
      await processJobUrl(pendingUrl);
      setPendingUrl(null);
    }
  };

  const handleDuplicateCancel = () => {
    setDuplicateDialogOpen(false);
    setPendingUrl(null);
  };

  const handleNoContentConfirm = async () => {
    setNoContentDialogOpen(false);
    if (pendingUrl) {
      await addJobPosting({
        companyName: "수동 입력 필요",
        title: "공고 내용 확인 필요",
        status: "reviewing",
        priority: 0,
        position: "미정",
        summary: "공고 내용을 직접 확인하고 입력해주세요.",
        keyCompetencies: [],
        sourceUrl: pendingUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      toast.success("공고가 추가되었습니다. 정보를 직접 입력해주세요.");
      setInputValue("");
      setPendingUrl(null);
    }
  };

  const handleNoContentCancel = () => {
    setNoContentDialogOpen(false);
    setPendingUrl(null);
  };

  // Persist filters to localStorage
  const setFilters = (
    updater: FilterState | ((prev: FilterState) => FilterState)
  ) => {
    setFiltersState((prev) => {
      const newFilters =
        typeof updater === "function" ? updater(prev) : updater;
      try {
        localStorage.setItem("curve-board-filters", JSON.stringify(newFilters));
      } catch (e) {
        console.error("Failed to save filters", e);
      }
      return newFilters;
    });
  };

  // 필터 옵션 목록 추출
  const filterOptions = useMemo(() => {
    const experiences = [
      ...new Set(jobPostings.map((j) => j.minExperience).filter(Boolean)),
    ] as string[];
    const workTypes = [
      ...new Set(jobPostings.map((j) => j.workType).filter(Boolean)),
    ] as string[];
    const locations = [
      ...new Set(jobPostings.map((j) => j.location).filter(Boolean)),
    ] as string[];
    return { experiences, workTypes, locations };
  }, [jobPostings]);

  // 한글→영문 정렬 함수
  const koreanFirstCompare = (a: string, b: string) => {
    const aIsKorean = /^[가-힣]/.test(a);
    const bIsKorean = /^[가-힣]/.test(b);
    if (aIsKorean && !bIsKorean) return -1;
    if (!aIsKorean && bIsKorean) return 1;
    return a.localeCompare(b, "ko");
  };

  // Sort and filter jobs
  const sortedJobs = useMemo(() => {
    let filtered = [...jobPostings];

    // 경력/근무형태/위치 필터 적용
    if (filters.minExperience) {
      filtered = filtered.filter(
        (j) => j.minExperience === filters.minExperience
      );
    }
    if (filters.workType) {
      filtered = filtered.filter((j) => j.workType === filters.workType);
    }
    if (filters.location) {
      filtered = filtered.filter((j) => j.location === filters.location);
    }

    switch (sortOption) {
      case "newest":
        return filtered.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case "oldest":
        return filtered.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      case "priority":
        // 우선순위(낮을수록 좋음) 기반 정렬 + fitScore는 보조 지표로 사용
        return filtered.sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          const aScore = a.fitScore ?? 0;
          const bScore = b.fitScore ?? 0;
          return bScore - aScore;
        });
      case "company":
        return filtered.sort((a, b) =>
          koreanFirstCompare(a.companyName, b.companyName)
        );
      default:
        return filtered;
    }
  }, [jobPostings, sortOption, filters]);

  const interviewCount = jobPostings.filter(
    (j) => j.status === "interview"
  ).length;
  const totalCount = jobPostings.length;
  const goalStart = currentGoal?.startDate
    ? new Date(currentGoal.startDate)
    : null;
  const daysSinceGoal = goalStart
    ? Math.floor((Date.now() - goalStart.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Group sorted jobs by status for kanban
  const groupedByStatus = useMemo(() => {
    return STATUS_ORDER.reduce((acc, status) => {
      acc[status] = sortedJobs.filter((j) => j.status === status);
      return acc;
    }, {} as Record<JobStatus, typeof sortedJobs>);
  }, [sortedJobs]);

  const handleDropOnColumn = (jobId: string, newStatus: JobStatus) => {
    updateJobPosting(jobId, { status: newStatus });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 pb-4 bg-background safe-top-lg lg:px-8 lg:pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-4">
          <div className="flex items-center gap-2">
            <img
              src={logoImage}
              alt="커브 로고"
              className="w-6 h-6 object-contain"
              loading="eager"
            />
            <h1 className="text-xl font-bold text-foreground">
              공고 관리 보드
            </h1>
          </div>
          <div className="flex items-center gap-2 lg:shrink-0">
            {/* Filter - 경력/근무형태/위치 기준 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2">
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  <span className="text-xs">필터</span>
                  {(filters.minExperience ||
                    filters.workType ||
                    filters.location) && (
                    <Badge variant="secondary" className="ml-1 text-[10px]">
                      적용중
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>필터 (공고 정보 기준)</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium mb-1">최소 경력</p>
                  {filterOptions.experiences.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {filterOptions.experiences.map((exp) => (
                        <Badge
                          key={exp}
                          variant={
                            filters.minExperience === exp
                              ? "default"
                              : "outline"
                          }
                          className="text-xs cursor-pointer"
                          onClick={() =>
                            setFilters((f) => ({
                              ...f,
                              minExperience: f.minExperience === exp ? "" : exp,
                            }))
                          }
                        >
                          {exp}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">데이터 없음</p>
                  )}
                </div>

                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium mb-1">근무 형태</p>
                  {filterOptions.workTypes.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {filterOptions.workTypes.map((wt) => (
                        <Badge
                          key={wt}
                          variant={
                            filters.workType === wt ? "default" : "outline"
                          }
                          className="text-xs cursor-pointer"
                          onClick={() =>
                            setFilters((f) => ({
                              ...f,
                              workType: f.workType === wt ? "" : wt,
                            }))
                          }
                        >
                          {wt}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">데이터 없음</p>
                  )}
                </div>

                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium mb-1">위치</p>
                  {filterOptions.locations.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {filterOptions.locations.map((loc) => (
                        <Badge
                          key={loc}
                          variant={
                            filters.location === loc ? "default" : "outline"
                          }
                          className="text-xs cursor-pointer"
                          onClick={() =>
                            setFilters((f) => ({
                              ...f,
                              location: f.location === loc ? "" : loc,
                            }))
                          }
                        >
                          {loc}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">데이터 없음</p>
                  )}
                </div>

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    setFilters({
                      minExperience: "",
                      workType: "",
                      location: "",
                    })
                  }
                >
                  필터 초기화
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2">
                  <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
                  <span className="text-xs">{SORT_LABELS[sortOption]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>정렬</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(SORT_LABELS).map(([key, label]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => setSortOption(key as SortOption)}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Toggle */}
            <div className="flex bg-secondary rounded-lg p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2.5 rounded-md",
                  viewMode === "kanban" && "bg-card shadow-sm"
                )}
                onClick={() => setViewMode("kanban")}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2.5 rounded-md",
                  viewMode === "table" && "bg-card shadow-sm"
                )}
                onClick={() => setViewMode("table")}
              >
                <Table2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* URL 입력 섹션 */}
        <form onSubmit={handleSubmit} className="pb-4 flex justify-center">
          <div className="relative w-full max-w-xl">
            <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="채용 공고 URL을 붙여넣으세요"
              className="w-full bg-card rounded-full pl-10 pr-12 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 border border-border focus:border-primary/30 shadow-sm"
              disabled={isProcessing}
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full w-8 h-8 hover:bg-primary hover:text-primary-foreground"
              disabled={!inputValue.trim() || isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>

        {/* Hero Summary */}
        <div className="bg-gradient-to-br from-primary/10 to-accent rounded-2xl p-4 border border-primary/10">
          <p className="text-sm text-foreground leading-relaxed">
            <span className="font-semibold">{userName}</span>님, 이직 목표 수립
            후
            <br />총{" "}
            <span className="font-bold text-primary">{totalCount}곳</span>을
            검토했고
            <br />
            <span className="font-bold text-primary">{interviewCount}곳</span>과
            인터뷰를 진행 중이에요
          </p>
          {daysSinceGoal > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {daysSinceGoal}일째 이직 여정
            </p>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden pb-20">
        {viewMode === "kanban" ? (
          <KanbanView
            groupedByStatus={groupedByStatus}
            onDropOnColumn={handleDropOnColumn}
            allJobs={jobPostings}
          />
        ) : (
          <TableView jobs={sortedJobs} />
        )}
      </div>

      {/* Non-job URL Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              공고가 아닌 링크일 수 있습니다
            </AlertDialogTitle>
            <AlertDialogDescription>
              이 링크는 채용 공고가 아닌 것으로 보입니다. 계속 공고 등록을
              진행하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelJobUrl}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmJobUrl}>
              계속 진행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate URL Confirmation Dialog */}
      <AlertDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              이전에 공유한 적 있는 링크입니다
            </AlertDialogTitle>
            <AlertDialogDescription>
              이 링크는 이미 보드에 추가된 공고입니다. 다시 추가하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDuplicateCancel}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDuplicateConfirm}>
              추가
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* No Content Confirmation Dialog */}
      <AlertDialog
        open={noContentDialogOpen}
        onOpenChange={setNoContentDialogOpen}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-warning" />
              공고 내용을 가져올 수 없습니다
            </AlertDialogTitle>
            <AlertDialogDescription>
              해당 페이지가 마감되었거나 접근할 수 없는 상태입니다. 그래도
              공고를 추가하고 직접 정보를 입력하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleNoContentCancel}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleNoContentConfirm}>
              직접 입력하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Job Limit Dialog */}
      <AlertDialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              공고 추가 한도 초과
            </AlertDialogTitle>
            <AlertDialogDescription>
              {subscription?.planName === "free"
                ? `무료 요금제는 공고 ${subscription.jobLimit}개까지 추가할 수 있습니다. 더 많은 공고를 관리하려면 유료 요금제로 업그레이드해주세요.`
                : "공고 추가 한도에 도달했습니다. 요금제를 업그레이드해주세요."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setLimitDialogOpen(false);
                setPendingUrl(null);
              }}
            >
              닫기
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
