import { Check, Crown, Sparkles } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/contexts/DataContext';
import { cn } from '@/lib/utils';

interface PricingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PricingSheet({ open, onOpenChange }: PricingSheetProps) {
  const { subscription, plans } = useData();
  
  const isFreePlan = subscription?.planName === 'free';
  
  // Use actual subscription credits from DB
  const resumeCreditsRemaining = subscription?.resumeCreditsRemaining ?? 0;
  const resumeCreditsUsed = subscription?.resumeCreditsUsed ?? 0;
  const totalResumeCredits = resumeCreditsRemaining + resumeCreditsUsed;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-w-md mx-auto max-h-[85vh] overflow-y-auto">
        <SheetHeader className="text-left pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            요금제
          </SheetTitle>
        </SheetHeader>

        {/* Current Plan Status */}
        <div className="p-4 rounded-xl bg-secondary/50 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">현재 요금제</span>
            <Badge variant="secondary" className="font-medium">
              {subscription?.planDisplayName || 'Free'}
            </Badge>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">맞춤 이력서 생성</span>
            <span className="text-sm font-medium">
              {isFreePlan 
                ? `${resumeCreditsUsed}/${totalResumeCredits > 0 ? totalResumeCredits : 0}개 사용` 
                : `${resumeCreditsRemaining}개 남음`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">AI 크레딧</span>
            <span className="text-sm font-medium">
              {subscription?.aiCreditsRemaining ?? 0}개 남음
            </span>
          </div>
        </div>

        {/* Plans */}
        <div className="space-y-4">
          {plans.map((plan) => {
            const isCurrentPlan = subscription?.planId === plan.id;
            const isPro = plan.name === 'pro';
            
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative p-4 rounded-xl border-2 transition-all",
                  isCurrentPlan 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50",
                  isPro && !isCurrentPlan && "ring-2 ring-primary/20"
                )}
              >
                {isPro && !isCurrentPlan && (
                  <div className="absolute -top-2.5 left-4">
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      추천
                    </Badge>
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{plan.displayName}</h3>
                    <p className="text-2xl font-bold">
                      {plan.price === 0 ? '무료' : `₩${plan.price.toLocaleString()}`}
                      {plan.price > 0 && <span className="text-sm font-normal text-muted-foreground">/월</span>}
                    </p>
                  </div>
                  {isCurrentPlan && (
                    <Badge variant="outline" className="text-primary border-primary">
                      현재 플랜
                    </Badge>
                  )}
                </div>

                <ul className="space-y-2 mb-4">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>맞춤 이력서 {plan.resumeCredits >= 999999 ? '무제한' : `${plan.resumeCredits}개`}</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>공고 저장 {plan.jobLimit}개</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>AI 크레딧 {plan.aiCredits}개/월</span>
                  </li>
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {!isCurrentPlan && (
                  <Button 
                    className="w-full" 
                    variant={isPro ? "default" : "outline"}
                    disabled
                  >
                    {plan.price > (subscription?.planId ? plans.find(p => p.id === subscription.planId)?.price ?? 0 : 0) 
                      ? '업그레이드 (준비중)' 
                      : '선택하기 (준비중)'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          결제 기능은 곧 출시됩니다. 현재는 무료 플랜을 이용해주세요.
        </p>
      </SheetContent>
    </Sheet>
  );
}
