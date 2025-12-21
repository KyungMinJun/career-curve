import { useState } from 'react';
import { LayoutGrid, Table2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useJobStore } from '@/stores/jobStore';
import { JobCard } from '@/components/board/JobCard';
import { JobPosting } from '@/types/job';
import { JobStatus, STATUS_LABELS, STATUS_COLORS, INTEREST_LABELS } from '@/types/job';
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
  const { jobPostings, userName, goalStartDate } = useJobStore();

  const interviewCount = jobPostings.filter((j) => j.status === 'interview').length;
  const totalCount = jobPostings.length;
  const daysSinceGoal = goalStartDate 
    ? Math.floor((Date.now() - goalStartDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const groupedByStatus = STATUS_ORDER.reduce((acc, status) => {
    acc[status] = jobPostings.filter((j) => j.status === status);
    return acc;
  }, {} as Record<JobStatus, typeof jobPostings>);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 pt-safe-top pb-4 bg-background safe-top">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">이직 보드</h1>
          
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
          <KanbanView groupedByStatus={groupedByStatus} />
        ) : (
          <TableView jobs={jobPostings} />
        )}
      </div>
    </div>
  );
}

function KanbanView({ 
  groupedByStatus 
}: { 
  groupedByStatus: Record<JobStatus, JobPosting[]> 
}) {
  return (
    <div className="h-full overflow-x-auto scrollbar-hide">
      <div className="flex gap-4 px-4 h-full min-w-max pb-4">
        {STATUS_ORDER.filter((status) => !status.startsWith('rejected')).map((status) => (
          <div key={status} className="w-72 flex-shrink-0">
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
                <JobCard key={job.id} job={job} />
              ))}
              {groupedByStatus[status]?.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  아직 없음
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TableView({ 
  jobs 
}: { 
  jobs: JobPosting[]
}) {
  return (
    <div className="h-full overflow-auto px-4 scrollbar-hide">
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr,80px,60px] gap-2 px-4 py-3 bg-secondary/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>공고</span>
          <span>상태</span>
          <span className="text-center">관심</span>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-border">
          {jobs.sort((a, b) => a.priority - b.priority).map((job) => (
            <div 
              key={job.id} 
              className="grid grid-cols-[1fr,80px,60px] gap-2 px-4 py-3 items-center hover:bg-secondary/30 cursor-pointer transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{job.title}</p>
                <p className="text-xs text-muted-foreground truncate">{job.companyName}</p>
              </div>
              <Badge className={cn('text-[10px] justify-center', STATUS_COLORS[job.status])}>
                {STATUS_LABELS[job.status]}
              </Badge>
              <span className="text-center text-lg">
                {INTEREST_LABELS[job.quickInterest]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
