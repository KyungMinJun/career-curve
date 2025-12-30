import { useState } from 'react';
import { JobPosting, JobStatus, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS } from '@/types/job';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface JobCardProps {
  job: JobPosting;
  onClick?: () => void;
}

export function JobCard({ job, onClick }: JobCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { removeJobPosting, updateJobPosting } = useData();

  const renderStars = (score: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              'w-3 h-3',
              i <= score ? 'fill-primary text-primary' : 'text-muted'
            )}
          />
        ))}
      </div>
    );
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeJobPosting(job.id);
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'text-primary bg-primary/10';
      case 2: return 'text-success bg-success/10';
      case 3: return 'text-warning bg-warning/10';
      case 4: return 'text-muted-foreground bg-muted';
      case 5: return 'text-muted-foreground bg-muted';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  // Check if evaluation is done (has company or fit scores)
  const hasEvaluation = (job.companyScore && job.companyScore > 0) || (job.fitScore && job.fitScore > 0);
  const displayPriority = hasEvaluation ? job.priority : '-';

  return (
    <>
      <div
        onClick={onClick}
        className="bg-card rounded-xl p-4 border border-border card-shadow cursor-pointer hover:card-shadow-lg transition-shadow active:scale-[0.98] group min-w-0"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-xs text-muted-foreground font-medium truncate">
              {job.companyName}
            </p>
            <h3 className="font-semibold text-foreground truncate mt-0.5">
              {job.title}
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge className={cn('text-xs font-semibold', hasEvaluation ? getPriorityColor(job.priority) : 'text-muted-foreground bg-muted')}>
              #{displayPriority}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsEditOpen(true); }}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  편집
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Position and Language tags */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge variant="secondary" className="text-xs shrink-0">
            {job.position}
          </Badge>
          {job.language && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              {job.language === 'ko' ? '🇰🇷 국문' : '🇺🇸 영문'}
            </Badge>
          )}
        </div>

        {/* Date added */}
        <p className="text-xs text-muted-foreground mb-2">
          {new Date(job.createdAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })} 추가
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {job.fitScore && renderStars(job.fitScore)}
          </div>
          <Badge className={cn('text-xs shrink-0', STATUS_COLORS[job.status])}>
            {STATUS_LABELS[job.status]}
          </Badge>
        </div>
      </div>

      {/* Edit Dialog */}
      <JobEditDialog 
        job={job} 
        open={isEditOpen} 
        onOpenChange={setIsEditOpen}
      />
    </>
  );
}

interface JobEditDialogProps {
  job: JobPosting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function JobEditDialog({ job, open, onOpenChange }: JobEditDialogProps) {
  const { updateJobPosting } = useData();
  const [formData, setFormData] = useState({
    companyName: job.companyName,
    title: job.title,
    position: job.position,
    status: job.status,
    priority: job.priority,
    minExperience: job.minExperience || '',
    workType: job.workType || '',
    location: job.location || '',
  });

  const handleSave = () => {
    updateJobPosting(job.id, formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90%] rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>공고 편집</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">회사명</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">공고명</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">포지션</Label>
            <Input
              id="position"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>상태</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => setFormData({ ...formData, status: v as JobStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>우선순위</Label>
              <Select
                value={formData.priority.toString()}
                onValueChange={(v) => setFormData({ ...formData, priority: parseInt(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((p) => (
                    <SelectItem key={p} value={p.toString()}>#{p} {PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="minExperience">최소 경력</Label>
              <Input
                id="minExperience"
                value={formData.minExperience}
                onChange={(e) => setFormData({ ...formData, minExperience: e.target.value })}
                placeholder="예: 3년 이상"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workType">근무 형태</Label>
              <Input
                id="workType"
                value={formData.workType}
                onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
                placeholder="예: 재택"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">위치</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="예: 서울 강남"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button className="flex-1" onClick={handleSave}>
              저장
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
