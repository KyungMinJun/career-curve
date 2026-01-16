import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  JobPosting,
  JobStatus,
  STATUS_LABELS,
  STATUS_COLORS,
  KeyCompetency,
  CompanyCriteriaScore,
  MinimumRequirementsCheck,
} from "@/types/job";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useData } from "@/contexts/DataContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ExternalLink,
  Star,
  ChevronDown,
  Building2,
  MapPin,
  Briefcase,
  Calendar,
  Globe,
  FileText,
  Quote,
  AlertCircle,
  Edit2,
  Check,
  X,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { ResumeBuilderDialog } from "./ResumeBuilderDialog";
import { FitEvaluationButton } from "./FitEvaluationButton";
import { Textarea } from "@/components/ui/textarea";

interface JobDetailDialogProps {
  job: JobPosting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToCareer?: (tailoredResumeId?: string) => void;
}

export function JobDetailDialog({
  job,
  open,
  onOpenChange,
  onNavigateToCareer,
}: JobDetailDialogProps) {
  const { updateJobPosting, currentGoals, experiences, jobPostings } =
    useData();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isResumeBuilderOpen, setIsResumeBuilderOpen] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<number | null>(
    null
  );
  const [editEvalText, setEditEvalText] = useState("");

  // Initialize company criteria scores from goals or job
  // Merge criteria from all active goals (no endDate), deduped by name
  const [companyCriteriaScores, setCompanyCriteriaScores] = useState<
    CompanyCriteriaScore[]
  >(() => {
    if (job.companyCriteriaScores?.length) {
      return job.companyCriteriaScores;
    }
    const activeGoals = currentGoals;
    if (activeGoals.length === 0) return [];
    // Merge criteria from all goals, dedup by name (take first occurrence)
    const criteriaMap = new Map<
      string,
      { name: string; weight: number; description?: string }
    >();
    activeGoals.forEach((goal) => {
      goal.companyEvalCriteria.forEach((c) => {
        if (!criteriaMap.has(c.name)) {
          criteriaMap.set(c.name, c);
        }
      });
    });
    return Array.from(criteriaMap.values()).map((c) => ({
      ...c,
      score: undefined,
    }));
  });

  // Key competency scores (for fit score)
  const [keyCompetencyScores, setKeyCompetencyScores] = useState<
    KeyCompetency[]
  >(job.keyCompetencies || []);

  // Minimum requirements check state
  const [minimumRequirementsCheck, setMinimumRequirementsCheck] = useState<
    MinimumRequirementsCheck | undefined
  >(job.minimumRequirementsCheck);

  // Calculate average scores
  const companyAvg =
    companyCriteriaScores.filter((c) => c.score).length > 0
      ? Math.round(
        companyCriteriaScores.reduce((sum, c) => sum + (c.score || 0), 0) /
        companyCriteriaScores.filter((c) => c.score).length
      )
      : 0;

  const fitAvg =
    keyCompetencyScores.filter((c) => c.score).length > 0
      ? Math.round(
        keyCompetencyScores.reduce((sum, c) => sum + (c.score || 0), 0) /
        keyCompetencyScores.filter((c) => c.score).length
      )
      : 0;

  // Calculate relative priority based on all job postings
  const calculateRelativePriority = (
    compScore: number,
    fitScoreVal: number
  ): number => {
    // Get all job postings with scores
    const allScores = jobPostings
      .filter(
        (j) =>
          (j.companyScore && j.companyScore > 0) ||
          (j.fitScore && j.fitScore > 0)
      )
      .map((j) => {
        const comp = j.companyScore || 0;
        const fit = j.fitScore || 0;
        const count = (comp > 0 ? 1 : 0) + (fit > 0 ? 1 : 0);
        return count > 0 ? (comp + fit) / count : 0;
      })
      .filter((s) => s > 0);

    // Calculate this job's average
    const count = (compScore > 0 ? 1 : 0) + (fitScoreVal > 0 ? 1 : 0);
    const thisScore = count > 0 ? (compScore + fitScoreVal) / count : 0;

    if (thisScore === 0 || allScores.length === 0) return 3; // Default to middle

    // Sort all scores (including this one) descending
    const allWithThis = [
      ...allScores.filter((s) => s !== thisScore),
      thisScore,
    ].sort((a, b) => b - a);

    if (allWithThis.length === 1) {
      // Only one job - assign based on absolute score
      if (thisScore >= 4) return 1;
      if (thisScore >= 3) return 2;
      if (thisScore >= 2) return 3;
      if (thisScore >= 1) return 4;
      return 5;
    }

    // Find this job's rank (0-indexed)
    const rank = allWithThis.indexOf(thisScore);
    const totalJobs = allWithThis.length;

    // Distribute into 5 priority buckets relatively
    // Priority 1: top 20%, Priority 2: 20-40%, etc.
    const percentile = rank / totalJobs;

    if (percentile < 0.2) return 1;
    if (percentile < 0.4) return 2;
    if (percentile < 0.6) return 3;
    if (percentile < 0.8) return 4;
    return 5;
  };

  const handleStatusChange = (status: JobStatus) => {
    updateJobPosting(job.id, { status });
  };

  const handlePriorityChange = (priority: number) => {
    updateJobPosting(job.id, { priority });
  };

  const handleCompanyCriteriaScoreChange = (index: number, score: number) => {
    const updated = [...companyCriteriaScores];
    updated[index] = { ...updated[index], score };
    setCompanyCriteriaScores(updated);

    const avg =
      Math.round(
        updated.reduce((sum, c) => sum + (c.score || 0), 0) /
        updated.filter((c) => c.score).length
      ) || 0;
    updateJobPosting(job.id, {
      companyCriteriaScores: updated,
      companyScore: avg,
    });
    updatePriorityRelative(avg, fitAvg);
  };

  const handleKeyCompetencyScoreChange = (index: number, score: number) => {
    const updated = [...keyCompetencyScores];
    updated[index] = { ...updated[index], score };
    setKeyCompetencyScores(updated);

    const avg =
      Math.round(
        updated.reduce((sum, c) => sum + (c.score || 0), 0) /
        updated.filter((c) => c.score).length
      ) || 0;
    updateJobPosting(job.id, {
      keyCompetencies: updated,
      fitScore: avg,
    });
    updatePriorityRelative(companyAvg, avg);
  };

  const handleEvaluationUpdate = (index: number, evaluation: string) => {
    const updated = [...keyCompetencyScores];
    updated[index] = { ...updated[index], evaluation };
    setKeyCompetencyScores(updated);
    updateJobPosting(job.id, { keyCompetencies: updated });
    setEditingEvaluation(null);
    setEditEvalText("");
  };

  const handleAIEvaluated = (
    evaluatedCompetencies: KeyCompetency[],
    minReqs?: MinimumRequirementsCheck
  ) => {
    setKeyCompetencyScores(evaluatedCompetencies);
    setMinimumRequirementsCheck(minReqs);

    const avg =
      Math.round(
        evaluatedCompetencies.reduce((sum, c) => sum + (c.score || 0), 0) /
        evaluatedCompetencies.filter((c) => c.score).length
      ) || 0;
    updateJobPosting(job.id, {
      keyCompetencies: evaluatedCompetencies,
      fitScore: avg,
      minimumRequirementsCheck: minReqs,
    });
    updatePriorityRelative(companyAvg, avg);
  };

  const updatePriorityRelative = (compScore: number, fitScoreVal: number) => {
    if (compScore === 0 && fitScoreVal === 0) return;
    const newPriority = calculateRelativePriority(compScore, fitScoreVal);
    updateJobPosting(job.id, { priority: newPriority });
  };

  const handleFieldUpdate = (field: string, value: string | boolean) => {
    updateJobPosting(job.id, { [field]: value });
    setEditingField(null);
  };

  const renderStarRating = (
    value: number,
    onChange: (v: number) => void,
    size: "sm" | "md" = "md",
    allowZero: boolean = false
  ) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          onClick={() => {
            // Allow setting to 0 by clicking the same star again
            if (allowZero && value === i) {
              onChange(0);
            } else {
              onChange(i);
            }
          }}
          className="focus:outline-none"
        >
          <Star
            className={cn(
              "transition-colors",
              size === "sm" ? "w-4 h-4" : "w-5 h-5",
              i <= value
                ? "fill-primary text-primary"
                : "text-muted-foreground hover:text-primary/50"
            )}
          />
        </button>
      ))}
    </div>
  );

  const getDisplayValue = (
    value: string | boolean | null | undefined,
    defaultText: string = "확인 불가"
  ) => {
    if (value === undefined || value === null || value === "")
      return defaultText;
    if (typeof value === "boolean") return value ? "가능" : "불가";
    return value;
  };

  const [isSummaryOpen, setIsSummaryOpen] = useState(true);
  const [isStep1Open, setIsStep1Open] = useState(true);
  const [isStep2Open, setIsStep2Open] = useState(true);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[90%] sm:max-w-md lg:max-w-2xl xl:max-w-3xl max-h-[85vh] p-0 rounded-2xl overflow-hidden">
          <ScrollArea className="max-h-[85vh]">
            <div className="p-6 space-y-5">
              {/* 1. Header Section */}
              <div className="flex flex-col text-center sm:text-left space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground font-medium">
                      {job.companyName}
                    </p>
                    <h2 className="tracking-tight text-xl font-bold mt-1">
                      {job.title}
                    </h2>
                  </div>
                  {job.sourceUrl && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0 h-10 w-10"
                      onClick={() => {
                        const isLinkedIn = job.sourceUrl
                          ?.toLowerCase()
                          .includes("linkedin.com");
                        if (isLinkedIn) {
                          navigator.clipboard.writeText(job.sourceUrl!);
                          toast.info(
                            "LinkedIn은 바로 이동이 어렵습니다. 링크가 복사되었으니, 브라우저에 붙여넣어 이동하세요."
                          );
                          return;
                        }
                        const link = document.createElement("a");
                        link.href = job.sourceUrl!;
                        link.target = "_blank";
                        link.rel = "noopener noreferrer";
                        link.click();
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* 2. Status Section */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">지원 상태</span>
                </div>
                <Select
                  value={job.status}
                  onValueChange={(v) => handleStatusChange(v as JobStatus)}
                >
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      [
                        "reviewing",
                        "applied",
                        "interview",
                        "offer",
                        "rejected-docs",
                        "rejected-interview",
                        "accepted",
                        "closed",
                      ] as JobStatus[]
                    ).map((key) => (
                      <SelectItem key={key} value={key}>
                        <Badge className={cn("text-xs", STATUS_COLORS[key])}>
                          {STATUS_LABELS[key]}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Job Summary Collapsible */}
              <Collapsible open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between px-0 h-auto py-2 hover:bg-accent hover:text-accent-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">공고 요약</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-muted-foreground transition-transform",
                        isSummaryOpen && "rotate-180"
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  {/* Job Summary Text */}
                  {job.summary ? (
                    <div className="bg-accent/50 rounded-lg p-3">
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {job.summary}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-sm text-muted-foreground">
                        AI 요약 정보가 없습니다.
                      </p>
                    </div>
                  )}

                  {/* Minimum Requirements Check */}
                  {minimumRequirementsCheck && (
                    <div
                      className={cn(
                        "rounded-lg p-3 flex items-start gap-3 border",
                        minimumRequirementsCheck.experienceMet === "충족"
                          ? "bg-success/10 border-success/20"
                          : minimumRequirementsCheck.experienceMet === "미충족"
                            ? "bg-destructive/10 border-destructive/20"
                            : "bg-warning/10 border-warning/20"
                      )}
                    >
                      {minimumRequirementsCheck.experienceMet === "충족" ? (
                        <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                      ) : minimumRequirementsCheck.experienceMet === "미충족" ? (
                        <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      ) : (
                        <HelpCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            minimumRequirementsCheck.experienceMet === "충족"
                              ? "text-success"
                              : minimumRequirementsCheck.experienceMet ===
                                "미충족"
                                ? "text-destructive"
                                : "text-warning"
                          )}
                        >
                          최소 경력 조건:{" "}
                          {minimumRequirementsCheck.experienceMet}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {minimumRequirementsCheck.reason}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Job Detail Fields */}
                  <div className="grid gap-3 pt-2">
                    <InfoRowWithEvidence
                      icon={<Briefcase className="w-4 h-4" />}
                      label="포지션"
                      value={job.position}
                      field="position"
                      editingField={editingField}
                      setEditingField={setEditingField}
                      onSave={(v) => handleFieldUpdate("position", v)}
                    />
                    <InfoRowWithEvidence
                      icon={<Calendar className="w-4 h-4" />}
                      label="최소 경력"
                      value={getDisplayValue(job.minExperience)}
                      evidence={job.minExperienceEvidence}
                      field="minExperience"
                      editingField={editingField}
                      setEditingField={setEditingField}
                      onSave={(v) => handleFieldUpdate("minExperience", v)}
                      isUnconfirmed={!job.minExperience}
                    />
                    <InfoRowWithEvidence
                      icon={<Building2 className="w-4 h-4" />}
                      label="근무 형태"
                      value={getDisplayValue(job.workType)}
                      evidence={job.workTypeEvidence}
                      field="workType"
                      editingField={editingField}
                      setEditingField={setEditingField}
                      onSave={(v) => handleFieldUpdate("workType", v)}
                      isUnconfirmed={!job.workType}
                    />
                    <InfoRowWithEvidence
                      icon={<MapPin className="w-4 h-4" />}
                      label="위치"
                      value={getDisplayValue(job.location)}
                      evidence={job.locationEvidence}
                      field="location"
                      editingField={editingField}
                      setEditingField={setEditingField}
                      onSave={(v) => handleFieldUpdate("location", v)}
                      isUnconfirmed={!job.location}
                    />
                    <InfoRowWithEvidence
                      icon={<Globe className="w-4 h-4" />}
                      label="비자 지원"
                      value={
                        job.visaSponsorship === undefined ||
                          job.visaSponsorship === null
                          ? "확인 불가"
                          : job.visaSponsorship
                            ? "가능"
                            : "불가"
                      }
                      evidence={job.visaSponsorshipEvidence}
                      field="visaSponsorship"
                      editingField={editingField}
                      setEditingField={setEditingField}
                      onSave={(v) =>
                        handleFieldUpdate("visaSponsorship", v === "가능")
                      }
                      isUnconfirmed={
                        job.visaSponsorship === undefined ||
                        job.visaSponsorship === null
                      }
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* 4. Priority Card */}
              <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">우선순위</span>
                    <div className="inline-flex items-center rounded-full border border-transparent font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-[10px] gap-1 px-1.5 py-0 h-5 bg-background">
                      <Sparkles className="w-3 h-3" />
                      AI 자동
                    </div>
                  </div>
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-sm font-bold bg-background">
                    #{job.priority}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  아래 평가 결과에 따라 자동 계산됩니다. 직접 조정도 가능합니다.
                </p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePriorityChange(p)}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 rounded-md px-3 flex-1",
                        job.priority === p
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      #{p}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      핵심 역량 적합도
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-primary">
                        {fitAvg}
                      </span>
                      <span className="text-xs text-muted-foreground">/ 5</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">
                      회사 매력도
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-primary">
                        {companyAvg}
                      </span>
                      <span className="text-xs text-muted-foreground">/ 5</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. Step 1: Core Competency Fit */}
              <Collapsible open={isStep1Open} onOpenChange={setIsStep1Open}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between px-0 h-auto py-2 hover:bg-accent hover:text-accent-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors",
                          fitAvg > 0
                            ? "bg-primary text-primary-foreground"
                            : "bg-primary/20 text-primary"
                        )}
                      >
                        {fitAvg > 0 ? <Check className="w-2.5 h-2.5" /> : "1"}
                      </div>
                      <span className="text-sm font-semibold">
                        Step 1. 핵심 역량 적합도
                      </span>
                      <div className="inline-flex items-center rounded-full border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground text-[10px] gap-1 px-1.5 py-0 h-5">
                        <Sparkles className="w-3 h-3" />
                        AI 자동
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-primary">
                        {fitAvg}/5
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform",
                          isStep1Open && "rotate-180"
                        )}
                      />
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  {/* Integrated Competency Logic */}
                  {fitAvg > 0 && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-primary mb-1">
                        종합 피드백
                      </h4>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                        {fitAvg >= 4 ? (
                          <>
                            적합한 경험을 보유하고 있습니다. 핵심 역량과 잘 맞는
                            경험을 강조하여 지원하시면 좋겠습니다.
                          </>
                        ) : fitAvg >= 3 ? (
                          <>
                            일부 역량에서 적합한 경험이 있습니다. 부족한 역량은
                            관련 프로젝트나 학습 경험으로 보완하여 어필하세요.
                          </>
                        ) : (
                          <>
                            핵심 역량과의 매칭이 다소 부족합니다. 지원 시 전이
                            가능한 기술이나 빠른 학습 능력을 강조해 보세요.
                          </>
                        )}
                      </p>
                    </div>
                  )}
                  <p class="text-xs text-muted-foreground">AI가 추출한 핵심 역량입니다. 버튼으로 자동 평가하거나 별점을 클릭해 직접 수정하세요.</p>
                  <FitEvaluationButton
                    keyCompetencies={keyCompetencyScores}
                    experiences={experiences}
                    minExperience={job.minExperience}
                    onEvaluated={handleAIEvaluated}
                  />

                  {keyCompetencyScores.map((comp, idx) => (
                    <Collapsible key={idx}>
                      <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium break-words [overflow-wrap:anywhere]">
                              {comp.title}
                            </p>
                            <p className="text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">
                              {comp.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            나의 역량:
                          </span>
                          {renderStarRating(
                            comp.score || 0,
                            (v) => handleKeyCompetencyScoreChange(idx, v),
                            "sm"
                          )}
                        </div>
                        {/* AI Evaluation Toggle */}
                        {comp.evaluation && (
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-between text-xs text-muted-foreground h-7 px-2"
                            >
                              <span>AI 평가 보기</span>
                              <ChevronDown className="w-3 h-3" />
                            </Button>
                          </CollapsibleTrigger>
                        )}
                        <CollapsibleContent>
                          {comp.evaluation && editingEvaluation !== idx && (
                            <div className="bg-background/50 rounded p-2 mt-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs text-muted-foreground italic flex-1 break-words [overflow-wrap:anywhere]">
                                  {comp.evaluation}
                                </p>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-6 h-6 shrink-0"
                                  onClick={() => {
                                    setEditingEvaluation(idx);
                                    setEditEvalText(comp.evaluation || "");
                                  }}
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                          {editingEvaluation === idx && (
                            <div className="mt-2 space-y-2">
                              <Textarea
                                value={editEvalText}
                                onChange={(e) =>
                                  setEditEvalText(e.target.value)
                                }
                                className="text-xs min-h-[60px]"
                                placeholder="평가 의견을 수정하세요..."
                              />
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingEvaluation(null);
                                    setEditEvalText("");
                                  }}
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  취소
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleEvaluationUpdate(idx, editEvalText)
                                  }
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  저장
                                </Button>
                              </div>
                            </div>
                          )}
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                  {keyCompetencyScores.length === 0 && (
                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-warning">
                          핵심 역량 분석 필요
                        </p>
                        <p className="text-xs text-muted-foreground">
                          새 공고를 등록하면 AI가 자동으로 5가지 핵심 역량을
                          추출합니다.
                        </p>
                      </div>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* 6. Step 2: Company Attractiveness */}
              <Collapsible open={isStep2Open} onOpenChange={setIsStep2Open}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between px-0 h-auto py-2 hover:bg-accent hover:text-accent-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors",
                          companyAvg > 0
                            ? "bg-primary text-primary-foreground"
                            : "bg-primary/20 text-primary"
                        )}
                      >
                        {companyAvg > 0 ? (
                          <Check className="w-2.5 h-2.5" />
                        ) : (
                          "2"
                        )}
                      </div>
                      <span className="text-sm font-semibold">
                        Step 2. 회사 매력도
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-primary">
                        {companyAvg}/5
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform",
                          isStep2Open && "rotate-180"
                        )}
                      />
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  {companyCriteriaScores.length === 0 ? (
                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 text-center">
                      <p className="text-sm font-medium text-warning">
                        회사 평가 기준 없음
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        이직 목표를 먼저 수립해주세요.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        목표 탭에서 설정한 기준으로 회사를 평가하세요. 별점을 클릭해 수정하고, 같은 별을 다시 누르면 0점으로 초기화됩니다.
                      </p>
                      {companyCriteriaScores.map((criteria, index) => (
                        <div
                          key={index}
                          className="bg-secondary/30 rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {criteria.name}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              가중치 {criteria.weight}
                            </Badge>
                          </div>
                          {criteria.description && (
                            <p className="text-xs text-muted-foreground">
                              {criteria.description}
                            </p>
                          )}
                          {renderStarRating(
                            criteria.score || 0,
                            (v) => handleCompanyCriteriaScoreChange(index, v),
                            "sm",
                            true
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* 7. Step 3: Create Resume */}
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors bg-primary/20 text-primary">
                    3
                  </div>
                  <span className="text-sm font-semibold">
                    Step 3. 맞춤 이력서 만들기
                  </span>
                </div>
                <div className="pl-auto">
                  <Button
                    className="w-full h-11"
                    onClick={() => setIsResumeBuilderOpen(true)}
                    disabled={!keyCompetencyScores.length}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    이 공고 맞춤 이력서 만들기
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <ResumeBuilderDialog
        open={isResumeBuilderOpen}
        onOpenChange={setIsResumeBuilderOpen}
        job={job}
        keyCompetencies={keyCompetencyScores}
        experiences={experiences}
        onNavigateToCareer={(tailoredResumeId) => {
          onOpenChange(false);
          onNavigateToCareer?.(tailoredResumeId);
        }}
      />
    </>
  );
}

interface InfoRowWithEvidenceProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  evidence?: string;
  field: string;
  editingField: string | null;
  setEditingField: (field: string | null) => void;
  onSave: (value: string) => void;
  isUnconfirmed?: boolean;
}

function InfoRowWithEvidence({
  icon,
  label,
  value,
  evidence,
  field,
  editingField,
  setEditingField,
  onSave,
  isUnconfirmed,
}: InfoRowWithEvidenceProps) {
  const [localValue, setLocalValue] = useState(value || "");
  const isEditing = editingField === field;

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-2">
        <div className="text-muted-foreground">{icon}</div>
        <Input
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          className="h-8 flex-1"
          autoFocus
          onBlur={() => onSave(localValue)}
          onKeyDown={(e) => e.key === "Enter" && onSave(localValue)}
        />
      </div>
    );
  }

  return (
    <div
      className="bg-secondary/30 rounded-lg p-3 cursor-pointer hover:bg-secondary/50 transition-colors"
      onClick={() => setEditingField(field)}
    >
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "text-sm font-medium truncate",
              isUnconfirmed ? "text-warning" : "text-foreground"
            )}
          >
            {value || "확인 불가"}
          </p>
        </div>
      </div>
      {evidence && (
        <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground bg-background/50 rounded p-2">
          <Quote className="w-3 h-3 shrink-0 mt-0.5" />
          <span className="italic break-words [overflow-wrap:anywhere]">
            {evidence}
          </span>
        </div>
      )}
    </div>
  );
}
