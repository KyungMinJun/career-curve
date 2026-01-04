import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Lock, Shield } from 'lucide-react';
import { Experience, KeyCompetency, MinimumRequirementsCheck } from '@/types/job';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useData } from '@/contexts/DataContext';
import { usePhoneVerification } from '@/hooks/usePhoneVerification';
import { PhoneVerificationDialog } from '@/components/auth/PhoneVerificationDialog';

interface FitEvaluationButtonProps {
  keyCompetencies: KeyCompetency[];
  experiences: Experience[];
  minExperience?: string;
  onEvaluated: (competencies: KeyCompetency[], minimumRequirements?: MinimumRequirementsCheck) => void;
}

export function FitEvaluationButton({ keyCompetencies, experiences, minExperience, onEvaluated }: FitEvaluationButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const { hasAiCredits } = useData();
  const { isVerified: isPhoneVerified, isLoading: isPhoneLoading, refetch: refetchPhone } = usePhoneVerification();

  const hasCompetencies = keyCompetencies && keyCompetencies.length > 0;
  const hasExperiences = experiences && experiences.length > 0;
  const canEvaluate = hasCompetencies && hasExperiences;
  const hasCredits = hasAiCredits();

  const performEvaluation = async () => {
    setIsLoading(true);
    try {
      // Credits are now deducted server-side in the edge function
      const { data, error } = await supabase.functions.invoke('evaluate-fit', {
        body: {
          keyCompetencies,
          experiences,
          minExperience,
        }
      });

      if (error) throw error;

      // Handle specific error codes from server-side credit check
      if (!data?.success && data?.error) {
        if (data.error === 'Insufficient AI credits') {
          toast.error('AI 크레딧이 부족합니다. 요금제를 업그레이드해주세요.');
          return;
        }
        throw new Error(data.error);
      }

      if (data?.evaluatedCompetencies) {
        onEvaluated(data.evaluatedCompetencies, data.minimumRequirements);
        toast.success('AI 적합도 평가가 완료되었습니다');
      }
    } catch (error) {
      console.error('Fit evaluation error:', error);
      toast.error('평가 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!canEvaluate) {
      if (!hasExperiences) {
        toast.error('경력 탭에서 경험을 먼저 등록해주세요');
      } else if (!hasCompetencies) {
        toast.error('공고에서 추출된 핵심 역량이 필요합니다');
      }
      return;
    }

    if (!hasCredits) {
      toast.error('AI 크레딧이 부족합니다. 요금제를 업그레이드해주세요.');
      return;
    }

    // Check if phone verification is required
    if (!isPhoneVerified && !isPhoneLoading) {
      setShowPhoneDialog(true);
      return;
    }

    await performEvaluation();
  };

  const handlePhoneVerified = async () => {
    await refetchPhone();
    // After phone verification, proceed with evaluation
    await performEvaluation();
  };

  const needsPhoneVerification = !isPhoneVerified && !isPhoneLoading;
  const disabledReason = !hasCredits
    ? 'AI 크레딧이 필요합니다'
    : !hasExperiences 
    ? '경력 탭에서 경험을 먼저 등록하세요' 
    : !hasCompetencies 
    ? '공고에서 핵심 역량이 추출되어야 합니다' 
    : needsPhoneVerification
    ? '전화번호 인증 후 사용 가능합니다'
    : '';

  const isDisabled = isLoading || !canEvaluate || !hasCredits;

  return (
    <>
      <div className="w-full">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleEvaluate}
          disabled={isDisabled}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : !hasCredits ? (
            <Lock className="w-4 h-4 mr-2" />
          ) : needsPhoneVerification ? (
            <Shield className="w-4 h-4 mr-2" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          AI로 내 적합도 평가하기
        </Button>
        {isDisabled && disabledReason && (
          <p className="text-xs text-muted-foreground text-center mt-1">{disabledReason}</p>
        )}
      </div>

      <PhoneVerificationDialog
        open={showPhoneDialog}
        onOpenChange={setShowPhoneDialog}
        onVerified={handlePhoneVerified}
        triggerReason="ai_evaluation"
      />
    </>
  );
}
