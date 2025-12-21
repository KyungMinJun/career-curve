import { Target, Sliders } from 'lucide-react';
import { useJobStore } from '@/stores/jobStore';
import { cn } from '@/lib/utils';

export function GoalsTab() {
  const { currentGoal } = useJobStore();

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-safe-top pb-4 bg-background safe-top">
        <h1 className="text-xl font-bold text-foreground">목표</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          무엇을 기준으로 이직을 판단하는지 정리해요
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-4 scrollbar-hide">
        {currentGoal && (
          <>
            <div className="bg-card rounded-xl p-4 border border-border card-shadow">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">이직 이유</h3>
              </div>
              <p className="text-sm text-muted-foreground">{currentGoal.reason}</p>
              {currentGoal.careerPath && (
                <p className="text-xs text-primary mt-2">{currentGoal.careerPath}</p>
              )}
            </div>

            <div className="bg-card rounded-xl p-4 border border-border card-shadow">
              <div className="flex items-center gap-2 mb-3">
                <Sliders className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">회사 평가 기준</h3>
              </div>
              <div className="space-y-2">
                {currentGoal.companyEvalCriteria.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{c.name}</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <div key={n} className={cn('w-2 h-2 rounded-full', n <= c.weight ? 'bg-primary' : 'bg-muted')} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-xl p-4 border border-border card-shadow">
              <div className="flex items-center gap-2 mb-3">
                <Sliders className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">적합도 기준</h3>
              </div>
              <div className="space-y-2">
                {currentGoal.fitEvalCriteria.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{c.name}</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <div key={n} className={cn('w-2 h-2 rounded-full', n <= c.weight ? 'bg-primary' : 'bg-muted')} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
