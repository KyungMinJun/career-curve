import { JobPosting, STATUS_LABELS, STATUS_COLORS, INTEREST_LABELS } from '@/types/job';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

interface JobCardProps {
  job: JobPosting;
  onClick?: () => void;
}

export function JobCard({ job, onClick }: JobCardProps) {
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

  return (
    <div
      onClick={onClick}
      className="bg-card rounded-xl p-4 border border-border card-shadow cursor-pointer hover:card-shadow-lg transition-shadow active:scale-[0.98]"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium">
            {job.companyName}
          </p>
          <h3 className="font-semibold text-foreground truncate mt-0.5">
            {job.title}
          </h3>
        </div>
        <span className="text-lg shrink-0">
          {INTEREST_LABELS[job.quickInterest]}
        </span>
      </div>

      {/* Position tag */}
      <Badge variant="secondary" className="text-xs mb-3">
        {job.position}
      </Badge>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-primary">
            #{job.priority}
          </span>
          {job.fitScore && renderStars(job.fitScore)}
        </div>
        <Badge className={cn('text-xs', STATUS_COLORS[job.status])}>
          {STATUS_LABELS[job.status]}
        </Badge>
      </div>
    </div>
  );
}
