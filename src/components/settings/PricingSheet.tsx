import { Check, Crown, Sparkles, ShieldCheck } from 'lucide-react';
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetHeader,
  ResponsiveSheetTitle,
} from '@/components/ui/responsive-sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useData } from '@/contexts/DataContext';
import { cn } from '@/lib/utils';

interface PricingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PricingSheet({ open, onOpenChange }: PricingSheetProps) {
  const { subscription, plans, jobPostings } = useData();
  
  const currentJobCount = jobPostings?.length || 0;

  // Plan feature descriptions
  const planFeatures = {
    free: [
      { label: '채팅 공고 분석', value: '5개' },
      { label: '공고 저장', value: '5개' },
      { label: 'AI 적합도 평가', value: '3개' },
      { label: '맞춤 이력서 생성', value: '1개' },
    ],
    starter: [
      { label: '채팅 공고 분석', value: '30개' },
      { label: '공고 저장', value: '30개' },
      { label: 'AI 적합도 평가', value: '20개' },
      { label: '맞춤 이력서 생성', value: '10개' },
    ],
    pro: [
      { label: '채팅 공고 분석', value: '무제한' },
      { label: '공고 저장', value: '무제한' },
      { label: 'AI 적합도 평가', value: '50개' },
      { label: '맞춤 이력서 생성', value: '30개' },
    ],
  };

  const planPrices = {
    free: { price: 0, label: '무료' },
    starter: { price: 9900, label: '₩9,900' },
    pro: { price: 19900, label: '₩19,900' },
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      <ResponsiveSheetContent className="rounded-t-2xl max-w-md mx-auto max-h-[85vh] overflow-y-auto lg:max-w-2xl">
        <ResponsiveSheetHeader className="text-left pb-4">
          <ResponsiveSheetTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            요금제 안내
          </ResponsiveSheetTitle>
        </ResponsiveSheetHeader>

        {/* Current Usage Status */}
        <div className="p-4 rounded-xl bg-secondary/50 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">현재 요금제</span>
            <Badge variant="secondary" className="font-medium">
              {subscription?.planDisplayName || 'Free'}
            </Badge>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">공고 저장</span>
              <span className="font-medium">
                {currentJobCount} / {subscription?.jobLimit === 999999 ? '무제한' : subscription?.jobLimit || 5}개
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">AI 적합도 평가</span>
              <span className="font-medium">
                {subscription?.aiCreditsRemaining ?? 0}개 남음
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">맞춤 이력서 생성</span>
              <span className="font-medium">
                {subscription?.resumeCreditsRemaining ?? 0}개 남음
              </span>
            </div>
          </div>
        </div>

        {/* Plans */}
        <div className="space-y-4">
          {(['free', 'starter', 'pro'] as const).map((planKey) => {
            const plan = plans.find(p => p.name === planKey);
            const isCurrentPlan = subscription?.planName === planKey;
            const isPro = planKey === 'pro';
            const features = planFeatures[planKey];
            const priceInfo = planPrices[planKey];

            return (
              <div
                key={planKey}
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
                    <h3 className="font-semibold capitalize">{planKey}</h3>
                    <p className="text-2xl font-bold">
                      {priceInfo.label}
                      {priceInfo.price > 0 && <span className="text-sm font-normal text-muted-foreground">/월</span>}
                    </p>
                  </div>
                  {isCurrentPlan && (
                    <Badge variant="outline" className="text-primary border-primary">
                      현재 플랜
                    </Badge>
                  )}
                </div>

                <ul className="space-y-2 mb-4">
                  {features.map((feature, idx) => (
                    <li key={idx} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                        {feature.label}
                      </span>
                      <span className="font-medium text-muted-foreground">{feature.value}</span>
                    </li>
                  ))}
                  {planKey !== 'free' && (
                    <li className="flex items-center gap-2 text-sm pt-1">
                      <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>전화번호 인증 필수</span>
                    </li>
                  )}
                </ul>

                {!isCurrentPlan && (
                  <Button 
                    className="w-full" 
                    variant={isPro ? "default" : "outline"}
                    disabled
                  >
                    {priceInfo.price > (planPrices[subscription?.planName as keyof typeof planPrices]?.price ?? 0)
                      ? '업그레이드 (준비중)' 
                      : '선택하기 (준비중)'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            결제 기능은 곧 출시됩니다. 현재는 무료 플랜을 이용해주세요.
          </p>
          <p className="text-xs text-muted-foreground text-center">
            AI 기능 사용 시 전화번호 인증이 필요하며, 무료 악용 방지 목적으로만 사용됩니다.
          </p>
        </div>
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}
