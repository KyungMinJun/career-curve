import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useJobStore } from '@/stores/jobStore';

export function ExperienceTab() {
  const { experiences } = useJobStore();

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-safe-top pb-4 bg-background safe-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">경험</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              정리된 경험 {experiences.length}개
            </p>
          </div>
          <Button size="sm" className="rounded-full">
            <Plus className="w-4 h-4 mr-1" /> 추가
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-3 scrollbar-hide">
        {experiences.map((exp) => (
          <div key={exp.id} className="bg-card rounded-xl p-4 border border-border card-shadow">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-foreground">{exp.title}</h3>
                {exp.company && <p className="text-sm text-muted-foreground">{exp.company}</p>}
              </div>
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground mb-3">
              {exp.bullets.slice(0, 3).map((bullet, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            {exp.usedInPostings.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {exp.usedInPostings.length}개 공고에 사용됨
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
