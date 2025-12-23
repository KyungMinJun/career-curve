import { useState } from 'react';
import { LayoutGrid, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useJobStore } from '@/stores/jobStore';
import { JobCard } from '@/components/board/JobCard';
import { JobDetailDialog } from '@/components/board/JobDetailDialog';
import { TableView } from '@/components/board/TableView';
import { JobPosting } from '@/types/job';
import { JobStatus, STATUS_LABELS } from '@/types/job';
import { cn } from '@/lib/utils';

type ViewMode = 'kanban' | 'table';

const STATUS_ORDER: JobStatus[] = [
  'reviewing',
  'applied',
  'interview',
  'offer',
  'accepted',
  'rejected-docs',
  'rejected-interview',
];

export function BoardTab() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const { jobPostings, userName, goalStartDate, updateJobPosting } = useJobStore();

  const interviewCount = jobPostings.filter((j) => j.status === 'interview').length;
  const totalCount = jobPostings.length;
  const daysSinceGoal = goalStartDate 
    ? Math.floor((Date.now() - goalStartDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const groupedByStatus = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = jobPostings.filter((j) => j.status === status);
    return acc;
  }, {} as Record<JobStatus, typeof jobPostings>);

  const handleDropOnColumn = (jobId: string, newStatus: JobStatus) => {
    updateJobPosting(jobId, { status: newStatus });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 pt-safe-top pb-4 bg-background safe-top">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">보드</h1>
          
          {/* View Toggle */}
          <div className="flex bg-secondary rounded-lg p-0.5">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2.5 rounded-md',
                viewMode === 'kanban' && 'bg-card shadow-sm'
              )}
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2.5 rounded-md',
                viewMode === 'table' && 'bg-card shadow-sm'
              )}
              onClick={() => setViewMode('table')}
            >
              <Table2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Hero Summary */}
        <div className="bg-gradient-to-br from-primary/10 to-accent rounded-2xl p-4 border border-primary/10">
          <p className="text-sm text-foreground leading-relaxed">
            <span className="font-semibold">{userName}</span>님, 이직 목표 수립 후
            <br />
            총 <span className="font-bold text-primary">{totalCount}곳</span>을 검토했고
            <br />
            <span className="font-bold text-primary">{interviewCount}곳</span>과 인터뷰를 진행 중이에요
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
        {viewMode === 'kanban' ? (
          <KanbanView groupedByStatus={groupedByStatus} onDropOnColumn={handleDropOnColumn} />
        ) : (
          <TableView jobs={jobPostings} />
        )}
      </div>
    </div>
  );
}

function KanbanView({ 
  groupedByStatus,
  onDropOnColumn,
}: { 
  groupedByStatus: Record<JobStatus, JobPosting[]>;
  onDropOnColumn: (jobId: string, newStatus: JobStatus) => void;
}) {
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<JobStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    setDraggedJobId(jobId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', jobId);
  };

  const handleDragEnd = () => {
    setDraggedJobId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: JobStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, status: JobStatus) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData('text/plain');
    if (jobId) {
      onDropOnColumn(jobId, status);
    }
    setDragOverColumn(null);
    setDraggedJobId(null);
  };

  return (
    <>
      <div className="h-full overflow-x-auto scrollbar-hide">
        <div className="flex gap-4 px-4 h-full min-w-max pb-4">
          {STATUS_ORDER.filter((status) => !status.startsWith('rejected')).map((status) => (
            <div 
              key={status} 
              className={cn(
                "w-72 flex-shrink-0 rounded-lg transition-colors",
                dragOverColumn === status && "bg-primary/10"
              )}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status)}
            >
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className={cn(
                  'w-2 h-2 rounded-full',
                  status === 'reviewing' && 'bg-muted-foreground',
                  status === 'applied' && 'bg-info',
                  status === 'interview' && 'bg-primary',
                  status === 'offer' && 'bg-success',
                  status === 'accepted' && 'bg-success',
                )} />
                <span className="text-sm font-semibold text-foreground">
                  {STATUS_LABELS[status]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {groupedByStatus[status]?.length || 0}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-hide">
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
                      onClick={() => setSelectedJob(job)}
                    />
                  </div>
                ))}
                {groupedByStatus[status]?.length === 0 && (
                  <div className={cn(
                    "text-center py-8 text-sm text-muted-foreground rounded-lg border-2 border-dashed",
                    dragOverColumn === status ? "border-primary" : "border-transparent"
                  )}>
                    {dragOverColumn === status ? "여기에 놓기" : "아직 없음"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Job Detail Dialog */}
      {selectedJob && (
        <JobDetailDialog
          job={selectedJob}
          open={!!selectedJob}
          onOpenChange={(open) => !open && setSelectedJob(null)}
        />
      )}
    </>
  );
}
