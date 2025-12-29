import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ChevronRight, FileText, Shield, CreditCard, Sparkles } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { AccountSheet } from '@/components/settings/AccountSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export function SettingsTab() {
  const navigate = useNavigate();
  const { jobPostings, currentGoals, subscription } = useData();
  const [accountOpen, setAccountOpen] = useState(false);
  const currentGoal = currentGoals[0] ?? null;

  const interviewCount = jobPostings.filter(j => j.status === 'interview').length;
  const appliedCount = jobPostings.filter(j => j.status !== 'reviewing').length;
  const start = currentGoal?.startDate ? new Date(currentGoal.startDate) : null;
  const daysSinceGoal = start 
    ? Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const totalCredits = subscription ? subscription.aiCreditsRemaining + subscription.aiCreditsUsed : 0;
  const creditPercentage = totalCredits > 0 ? (subscription?.aiCreditsRemaining || 0) / totalCredits * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="설정"
        subtitle="이직 여정을 한 번에 돌아봅니다"
        logoSize="lg"
        className="pb-5"
        titleClassName="text-2xl"
      />

      <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-4 scrollbar-hide">
        {/* Summary Card */}
        <div className="bg-gradient-to-br from-primary/10 to-accent rounded-2xl p-5 border border-primary/10">
          <p className="text-2xl font-bold text-foreground mb-1">
            {daysSinceGoal}일째
          </p>
          <p className="text-sm text-muted-foreground mb-4">이직 목표 수립 후</p>
          <div className="flex gap-6">
            <div>
              <p className="text-xl font-bold text-primary">{appliedCount}</p>
              <p className="text-xs text-muted-foreground">지원</p>
            </div>
            <div>
              <p className="text-xl font-bold text-primary">{interviewCount}</p>
              <p className="text-xs text-muted-foreground">인터뷰</p>
            </div>
          </div>
        </div>

        {/* Subscription Card */}
        {subscription && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <span className="font-medium">{subscription.planDisplayName}</span>
              </div>
              <Badge variant={subscription.planName === 'free' ? 'secondary' : 'default'}>
                {subscription.planName === 'free' ? '무료' : '유료'}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-4 h-4" />
                  AI 크레딧
                </span>
                <span className="font-medium">
                  {subscription.aiCreditsRemaining} / {totalCredits}
                </span>
              </div>
              <Progress value={creditPercentage} className="h-2" />
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>공고 제한</span>
              <span>{jobPostings.length} / {subscription.jobLimit >= 999999 ? '무제한' : subscription.jobLimit}</span>
            </div>
          </div>
        )}

        {/* Menu Items */}
        <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
          <MenuItem icon={User} label="계정" onClick={() => setAccountOpen(true)} />
          <MenuItem icon={FileText} label="이용약관" onClick={() => navigate('/terms')} />
          <MenuItem icon={Shield} label="개인정보처리방침" onClick={() => navigate('/privacy')} />
        </div>

        <p className="text-center text-xs text-muted-foreground pt-4">
          커브 v1.0.0
        </p>
      </div>

      <AccountSheet open={accountOpen} onOpenChange={setAccountOpen} />
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: typeof User; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between w-full px-4 py-3.5 hover:bg-secondary/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}

