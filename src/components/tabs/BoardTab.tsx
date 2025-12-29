import { useState, useMemo, useRef } from 'react';
import { LayoutGrid, Table2, Filter, ArrowUpDown, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import logoImage from '@/assets/logo.png';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/hooks/useAuth';
import { JobCard } from '@/components/board/JobCard';
import { JobDetailDialog } from '@/components/board/JobDetailDialog';
import { TableView } from '@/components/board/TableView';
import { JobPosting } from '@/types/job';
import { JobStatus, STATUS_LABELS } from '@/types/job';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ViewMode = 'kanban' | 'table';
type SortOption = 'newest' | 'oldest' | 'priority' | 'company';

// 필터 옵션: 경력/근무형태/위치 기준
interface FilterState {
  minExperience: string;
  workType: string;
  location: string;
}

const STATUS_ORDER: JobStatus[] = [
  'reviewing',
  'applied',
  'interview',
  'offer',
  'accepted',
  'rejected-docs',
  'rejected-interview',
  'closed',
];

// Display order for select dropdown (different from kanban order)
const STATUS_SELECT_ORDER: JobStatus[] = [
  'reviewing',
  'applied',
  'interview',
  'offer',
  'rejected-docs',
  'rejected-interview',
  'accepted',
  'closed',
];

const SORT_LABELS: Record<SortOption, string> = {
  newest: '최신순',
  oldest: '오래된순',
  priority: '추천순',
  company: '회사명순 (한글→영문)',
};

// Load filters from localStorage
const loadSavedFilters = (): FilterState => {
  try {
    const saved = localStorage.getItem('curve-board-filters');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load filters', e);
  }
  return { minExperience: '', workType: '', location: '' };
};

export function BoardTab() {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [sortOption, setSortOption] = useState<SortOption>('priority');
  const [filters, setFiltersState] = useState<FilterState>(loadSavedFilters);
  const { jobPostings, currentGoals, updateJobPosting } = useData();
  const { user } = useAuth();
  const userName = user?.user_metadata?.name_ko || user?.user_metadata?.name_en || user?.email || '사용자';
  const currentGoal = currentGoals[0] ?? null;

  // Persist filters to localStorage
  const setFilters = (updater: FilterState | ((prev: FilterState) => FilterState)) => {
    setFiltersState((prev) => {
      const newFilters = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('curve-board-filters', JSON.stringify(newFilters));
      } catch (e) {
        console.error('Failed to save filters', e);
      }
      return newFilters;
    });
  };

  // 필터 옵션 목록 추출
  const filterOptions = useMemo(() => {
    const experiences = [...new Set(jobPostings.map(j => j.minExperience).filter(Boolean))] as string[];
    const workTypes = [...new Set(jobPostings.map(j => j.workType).filter(Boolean))] as string[];
    const locations = [...new Set(jobPostings.map(j => j.location).filter(Boolean))] as string[];
    return { experiences, workTypes, locations };
  }, [jobPostings]);

  // 한글→영문 정렬 함수
  const koreanFirstCompare = (a: string, b: string) => {
    const aIsKorean = /^[가-힣]/.test(a);
    const bIsKorean = /^[가-힣]/.test(b);
    if (aIsKorean && !bIsKorean) return -1;
    if (!aIsKorean && bIsKorean) return 1;
    return a.localeCompare(b, 'ko');
  };

  // Sort and filter jobs
  const sortedJobs = useMemo(() => {
    let filtered = [...jobPostings];
    
    // 경력/근무형태/위치 필터 적용
    if (filters.minExperience) {
      filtered = filtered.filter(j => j.minExperience === filters.minExperience);
    }
    if (filters.workType) {
      filtered = filtered.filter(j => j.workType === filters.workType);
    }
    if (filters.location) {
      filtered = filtered.filter(j => j.location === filters.location);
    }
    
    switch (sortOption) {
      case 'newest':
        return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'oldest':
        return filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'priority':
        // 우선순위(낮을수록 좋음) 기반 정렬 + fitScore는 보조 지표로 사용
        return filtered.sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          const aScore = a.fitScore ?? 0;
          const bScore = b.fitScore ?? 0;
          return bScore - aScore;
        });
      case 'company':
        return filtered.sort((a, b) => koreanFirstCompare(a.companyName, b.companyName));
      default:
        return filtered;
    }
  }, [jobPostings, sortOption, filters]);

  const interviewCount = jobPostings.filter((j) => j.status === 'interview').length;
  const totalCount = jobPostings.length;
  const goalStart = currentGoal?.startDate ? new Date(currentGoal.startDate) : null;
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
      <header className="px-4 pb-4 bg-background safe-top-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="커브 로고" className="w-6 h-6 object-contain" loading="eager" />
            <h1 className="text-xl font-bold text-foreground">공고 관리 보드</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Filter - 경력/근무형태/위치 기준 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2">
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  <span className="text-xs">필터</span>
                  {(filters.minExperience || filters.workType || filters.location) && (
                    <Badge variant="secondary" className="ml-1 text-[10px]">적용중</Badge>
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
                      {filterOptions.experiences.map(exp => (
                        <Badge
                          key={exp}
                          variant={filters.minExperience === exp ? 'default' : 'outline'}
                          className="text-xs cursor-pointer"
                          onClick={() => setFilters(f => ({ ...f, minExperience: f.minExperience === exp ? '' : exp }))}
                        >
                          {exp}
                        </Badge>
                      ))}
                    </div>
                  ) : <p className="text-xs text-muted-foreground">데이터 없음</p>}
                </div>

                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium mb-1">근무 형태</p>
                  {filterOptions.workTypes.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {filterOptions.workTypes.map(wt => (
                        <Badge
                          key={wt}
                          variant={filters.workType === wt ? 'default' : 'outline'}
                          className="text-xs cursor-pointer"
                          onClick={() => setFilters(f => ({ ...f, workType: f.workType === wt ? '' : wt }))}
                        >
                          {wt}
                        </Badge>
                      ))}
                    </div>
                  ) : <p className="text-xs text-muted-foreground">데이터 없음</p>}
                </div>

                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium mb-1">위치</p>
                  {filterOptions.locations.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {filterOptions.locations.map(loc => (
                        <Badge
                          key={loc}
                          variant={filters.location === loc ? 'default' : 'outline'}
                          className="text-xs cursor-pointer"
                          onClick={() => setFilters(f => ({ ...f, location: f.location === loc ? '' : loc }))}
                        >
                          {loc}
                        </Badge>
                      ))}
                    </div>
                  ) : <p className="text-xs text-muted-foreground">데이터 없음</p>}
                </div>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilters({ minExperience: '', workType: '', location: '' })}>
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
                  <DropdownMenuItem key={key} onClick={() => setSortOption(key as SortOption)}>
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
          <KanbanView groupedByStatus={groupedByStatus} onDropOnColumn={handleDropOnColumn} allJobs={jobPostings} />
        ) : (
          <TableView jobs={sortedJobs} />
        )}
      </div>
    </div>
  );
}

function KanbanView({ 
  groupedByStatus,
  onDropOnColumn,
  allJobs,
}: { 
  groupedByStatus: Record<JobStatus, JobPosting[]>;
  onDropOnColumn: (jobId: string, newStatus: JobStatus) => void;
  allJobs: JobPosting[];
}) {
  const [showClosed, setShowClosed] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<JobStatus | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const selectedJob = selectedJobId ? allJobs.find((j) => j.id === selectedJobId) ?? null : null;

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

  const updateScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 10);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
    }
  };

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -288, behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 288, behavior: 'smooth' });
  };

  // Statuses to show in main view (excluding closed and rejected)
  const mainStatuses = STATUS_ORDER.filter((status) => !status.startsWith('rejected') && status !== 'closed');

  return (
    <>
      <div className="relative h-full">
        {/* Left scroll arrow */}
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/90 backdrop-blur-sm border border-border rounded-full p-2 shadow-lg hover:bg-secondary transition-colors"
            aria-label="왼쪽으로 스크롤"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
        )}
        
        {/* Right scroll arrow */}
        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/90 backdrop-blur-sm border border-border rounded-full p-2 shadow-lg hover:bg-secondary transition-colors"
            aria-label="오른쪽으로 스크롤"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
        )}

        <div 
          ref={scrollContainerRef}
          className="h-full overflow-x-auto scrollbar-hide"
          onScroll={updateScrollButtons}
        >
        <div className="flex flex-col gap-4 px-4 h-full pb-4">
          {/* Main columns */}
          <div className="flex gap-4 min-w-max">
            {mainStatuses.map((status) => (
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

          {/* Closed toggle section */}
          {(groupedByStatus['closed']?.length > 0) && (
            <div className="min-w-max">
              <button
                onClick={() => setShowClosed(!showClosed)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {showClosed ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span>공고 마감</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                  {groupedByStatus['closed']?.length || 0}
                </span>
              </button>
              
              {showClosed && (
                <div 
                  className={cn(
                    "w-72 flex-shrink-0 rounded-lg transition-colors mt-2 ml-3",
                    dragOverColumn === 'closed' && "bg-primary/10"
                  )}
                  onDragOver={(e) => handleDragOver(e, 'closed')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'closed')}
                >
                  <div className="space-y-3 overflow-y-auto max-h-[300px] scrollbar-hide">
                    {groupedByStatus['closed']?.map((job) => (
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
              new CustomEvent('navigate-to-tab', {
                detail: { tab: 'career', tailoredResumeId },
              })
            );
          }}
        />
      )}
    </>
  );
}
