import { useState } from 'react';
import { JobPosting, JobStatus, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS } from '@/types/job';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useJobStore } from '@/stores/jobStore';
import { JobDetailDialog } from './JobDetailDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { 
  Filter, 
  ArrowUpDown, 
  Settings2, 
  Star 
} from 'lucide-react';

interface TableViewProps {
  jobs: JobPosting[];
}

type SortKey = 'priority' | 'createdAt' | 'companyName' | 'title';
type SortDirection = 'asc' | 'desc';

const DEFAULT_COLUMNS = [
  { key: 'title', label: '공고명', visible: true },
  { key: 'companyName', label: '회사', visible: true },
  { key: 'status', label: '상태', visible: true },
  { key: 'priority', label: '우선순위', visible: true },
  { key: 'position', label: '포지션', visible: true },
  { key: 'minExperience', label: '최소경력', visible: true },
  { key: 'workType', label: '근무형태', visible: true },
  { key: 'location', label: '위치', visible: true },
  { key: 'visaSponsorship', label: '비자', visible: false },
];

export function TableView({ jobs }: TableViewProps) {
  const { updateJobPosting } = useJobStore();
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const selectedJob = useJobStore((s) => (selectedJobId ? s.jobPostings.find((j) => j.id === selectedJobId) ?? null : null));

  const filteredJobs = jobs
    .filter((job) => statusFilter === 'all' || job.status === statusFilter)
    .sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'priority':
          comparison = a.priority - b.priority;
          break;
        case 'createdAt':
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
        case 'companyName':
          comparison = a.companyName.localeCompare(b.companyName);
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const visibleColumns = columns.filter((col) => col.visible);

  const toggleColumn = (key: string) => {
    setColumns(columns.map((col) => 
      col.key === key ? { ...col, visible: !col.visible } : col
    ));
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleCellEdit = (jobId: string, field: string, value: string) => {
    updateJobPosting(jobId, { [field]: value });
    setEditingCell(null);
  };

  const renderCell = (job: JobPosting, columnKey: string) => {
    const isEditing = editingCell?.id === job.id && editingCell?.field === columnKey;
    const value = job[columnKey as keyof JobPosting];

    if (columnKey === 'status') {
      return (
        <Select
          value={job.status}
          onValueChange={(v) => updateJobPosting(job.id, { status: v as JobStatus })}
        >
          <SelectTrigger className="h-7 w-24 text-xs border-none bg-transparent p-0">
            <Badge className={cn('text-[10px]', STATUS_COLORS[job.status])}>
              {STATUS_LABELS[job.status]}
            </Badge>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (columnKey === 'priority') {
      return (
        <Select
          value={job.priority.toString()}
          onValueChange={(v) => updateJobPosting(job.id, { priority: parseInt(v) })}
        >
          <SelectTrigger className="h-7 w-20 text-xs border-none bg-transparent p-0">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-primary">#{job.priority}</span>
              {job.fitScore && (
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={cn(
                        'w-3 h-3',
                        i <= job.fitScore! ? 'fill-primary text-primary' : 'text-muted'
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((p) => (
              <SelectItem key={p} value={p.toString()} className="text-xs">
                #{p} {PRIORITY_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (columnKey === 'visaSponsorship') {
      const visaValue = job.visaSponsorship;
      return (
        <Badge 
          variant="outline" 
          className={cn(
            'text-[10px]',
            visaValue === undefined && 'text-warning border-warning',
            visaValue === true && 'text-success border-success',
            visaValue === false && 'text-muted-foreground'
          )}
        >
          {visaValue === undefined ? '미확인' : visaValue ? '가능' : '불가'}
        </Badge>
      );
    }

    const editableFields = ['title', 'companyName', 'position', 'minExperience', 'workType', 'location'];
    if (editableFields.includes(columnKey)) {
      if (isEditing) {
        return (
          <Input
            defaultValue={String(value || '')}
            className="h-7 text-xs"
            autoFocus
            onBlur={(e) => handleCellEdit(job.id, columnKey, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCellEdit(job.id, columnKey, e.currentTarget.value);
              }
              if (e.key === 'Escape') {
                setEditingCell(null);
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        );
      }

      const displayValue = String(value || '');
      const isUnconfirmed = !value;

      return (
        <span
          className={cn(
            'text-sm cursor-text hover:bg-secondary/50 px-1 py-0.5 rounded truncate block',
            isUnconfirmed && 'text-warning italic'
          )}
          onClick={(e) => {
            e.stopPropagation();
            setEditingCell({ id: job.id, field: columnKey });
          }}
        >
          {displayValue || '미확인'}
        </span>
      );
    }

    return <span className="text-sm truncate">{String(value || '-')}</span>;
  };

  return (
    <div className="h-full px-4 space-y-3">
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="w-3.5 h-3.5 mr-1.5" />
              필터
              {statusFilter !== 'all' && (
                <Badge variant="secondary" className="ml-1.5 text-[10px]">
                  {STATUS_LABELS[statusFilter]}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>상태 필터</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setStatusFilter('all')}>
              전체
            </DropdownMenuItem>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <DropdownMenuItem key={key} onClick={() => setStatusFilter(key as JobStatus)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
              정렬
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>정렬 기준</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleSort('priority')}>
              추천순 (우선순위)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort('createdAt')}>
              최근 추가순
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort('companyName')}>
              회사명
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 ml-auto">
              <Settings2 className="w-3.5 h-3.5 mr-1.5" />
              컬럼
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>표시할 컬럼</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.key}
                checked={col.visible}
                onCheckedChange={() => toggleColumn(col.key)}
              >
                {col.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <div 
            className="grid gap-2 px-4 py-3 bg-secondary/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide min-w-max"
            style={{ gridTemplateColumns: visibleColumns.map(() => 'minmax(80px, 1fr)').join(' ') }}
          >
            {visibleColumns.map((col) => (
              <span key={col.key} className="truncate">{col.label}</span>
            ))}
          </div>

          <div className="divide-y divide-border">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="grid gap-2 px-4 py-3 items-center hover:bg-secondary/30 cursor-pointer transition-colors min-w-max"
                style={{ gridTemplateColumns: visibleColumns.map(() => 'minmax(80px, 1fr)').join(' ') }}
                onClick={() => setSelectedJobId(job.id)}
              >
                {visibleColumns.map((col) => (
                  <div key={col.key} className="min-w-0">
                    {renderCell(job, col.key)}
                  </div>
                ))}
              </div>
            ))}

            {filteredJobs.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                표시할 공고가 없습니다
              </div>
            )}
          </div>
        </div>
      </div>

       {selectedJob && (
        <JobDetailDialog
          job={selectedJob}
          open={!!selectedJob}
          onOpenChange={(open) => !open && setSelectedJobId(null)}
        />
      )}
    </div>
  );
}
