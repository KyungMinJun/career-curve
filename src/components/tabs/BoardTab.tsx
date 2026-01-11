import { useState, useMemo } from "react";
import { LayoutGrid, Table2, Filter, ArrowUpDown } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const { jobPostings, currentGoals, updateJobPosting } = useData();
  const { user } = useAuth();
  const userName =
    user?.user_metadata?.name_ko ||
    user?.user_metadata?.name_en ||
    user?.email ||
    "사용자";
  const currentGoal = currentGoals[0] ?? null;

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
    </div>
  );
}
