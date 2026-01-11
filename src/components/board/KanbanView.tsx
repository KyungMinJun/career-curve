import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobCard } from "@/components/board/JobCard";
import { JobDetailDialog } from "@/components/board/JobDetailDialog";
import { JobPosting, JobStatus, STATUS_LABELS } from "@/types/job";
import { STATUS_ORDER } from "@/components/board/constants";

interface KanbanViewProps {
  groupedByStatus: Record<JobStatus, JobPosting[]>;
  onDropOnColumn: (jobId: string, newStatus: JobStatus) => void;
  allJobs: JobPosting[];
}

export function KanbanView({
  groupedByStatus,
  onDropOnColumn,
  allJobs,
}: KanbanViewProps) {
  const [showClosed, setShowClosed] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<JobStatus | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const selectedJob = selectedJobId
    ? allJobs.find((j) => j.id === selectedJobId) ?? null
    : null;

  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    setDraggedJobId(jobId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", jobId);
  };

  const handleDragEnd = () => {
    setDraggedJobId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: JobStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, status: JobStatus) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("text/plain");
    if (jobId) {
      onDropOnColumn(jobId, status);
    }
    setDragOverColumn(null);
    setDraggedJobId(null);
  };

  const updateScrollButtons = () => {
    console.log("Updating scroll buttons");
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 10);
      setCanScrollRight(
        container.scrollLeft <
          container.scrollWidth - container.clientWidth - 10
      );
    }
  };

  useEffect(() => {
    updateScrollButtons();

    let timeoutId: NodeJS.Timeout;
    const debouncedUpdateScrollButtons = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        updateScrollButtons();
      }, 150);
    };

    window.addEventListener("resize", debouncedUpdateScrollButtons);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", debouncedUpdateScrollButtons);
    };
  }, []);

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -288, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 288, behavior: "smooth" });
  };

  // Statuses to show in main view (excluding closed and rejected)
  const mainStatuses = STATUS_ORDER.filter(
    (status) => !status.startsWith("rejected") && status !== "closed"
  );

  return (
    <>
      <div className="relative h-full">
        {/* Left scroll arrow */}
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-background/90 backdrop-blur-sm border border-border rounded-full p-2 shadow-lg hover:bg-secondary transition-colors hidden lg:block "
            aria-label="왼쪽으로 스크롤"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
        )}

        {/* Right scroll arrow */}
        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 bg-background/90 backdrop-blur-sm border border-border rounded-full p-2 shadow-lg hover:bg-secondary transition-colors hidden lg:block"
            aria-label="오른쪽으로 스크롤"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          className="h-full lg:px-4 overflow-y-auto overflow-x-visible lg:overflow-y-visible lg:overflow-x-auto scrollbar-hide"
          onScroll={updateScrollButtons}
        >
          <div className="flex flex-col gap-4 px-4 pb-4">
            {/* Main columns */}
            <div className="flex flex-col gap-4 lg:flex-row lg:gap-6 lg:min-w-max lg:pr-4">
              {mainStatuses.map((status) => (
                <div
                  key={status}
                  className={cn(
                    "w-full rounded-lg transition-colors lg:w-72 lg:flex-shrink-0",
                    dragOverColumn === status && "bg-primary/10"
                  )}
                  onDragOver={(e) => handleDragOver(e, status)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, status)}
                >
                  {/* Column Header */}
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        status === "reviewing" && "bg-muted-foreground",
                        status === "applied" && "bg-info",
                        status === "interview" && "bg-primary",
                        status === "offer" && "bg-success",
                        status === "accepted" && "bg-success"
                      )}
                    />
                    <span className="text-sm font-semibold text-foreground">
                      {STATUS_LABELS[status]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {groupedByStatus[status]?.length || 0}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-350px)] scrollbar-hide">
                    {groupedByStatus[status]?.map((job) => (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, job.id)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "cursor-grab active:cursor-grabbing",
                          draggedJobId === job.id && "opacity-50"
                        )}
                      >
                        <JobCard
                          job={job}
                          onClick={() => setSelectedJobId(job.id)}
                        />
                      </div>
                    ))}
                    {groupedByStatus[status]?.length === 0 && (
                      <div
                        className={cn(
                          "text-center py-8 text-sm text-muted-foreground rounded-lg border-2 border-dashed",
                          dragOverColumn === status
                            ? "border-primary"
                            : "border-transparent"
                        )}
                      >
                        {dragOverColumn === status
                          ? "여기에 놓기"
                          : "아직 없음"}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Closed toggle section */}
            {groupedByStatus["closed"]?.length > 0 && (
              <div className="min-w-max">
                <button
                  onClick={() => setShowClosed(!showClosed)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showClosed ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span>공고 마감</span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                    {groupedByStatus["closed"]?.length || 0}
                  </span>
                </button>

                {showClosed && (
                  <div
                    className={cn(
                      "w-full rounded-lg transition-colors mt-2 ml-3 lg:w-72 lg:flex-shrink-0",
                      dragOverColumn === "closed" && "bg-primary/10"
                    )}
                    onDragOver={(e) => handleDragOver(e, "closed")}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, "closed")}
                  >
                    <div className="space-y-3 overflow-y-auto max-h-[300px] scrollbar-hide">
                      {groupedByStatus["closed"]?.map((job) => (
                        <div
                          key={job.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, job.id)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            "cursor-grab active:cursor-grabbing opacity-70",
                            draggedJobId === job.id && "opacity-30"
                          )}
                        >
                          <JobCard
                            job={job}
                            onClick={() => setSelectedJobId(job.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Job Detail Dialog */}
      {selectedJob && (
        <JobDetailDialog
          job={selectedJob}
          open={!!selectedJob}
          onOpenChange={(open) => !open && setSelectedJobId(null)}
          onNavigateToCareer={(tailoredResumeId) => {
            setSelectedJobId(null);
            // Navigate to career tab - will be handled by parent component
            window.dispatchEvent(
              new CustomEvent("navigate-to-tab", {
                detail: { tab: "career", tailoredResumeId },
              })
            );
          }}
        />
      )}
    </>
  );
}
