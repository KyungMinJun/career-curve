import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { Experience, KeyCompetency, MinimumRequirementsCheck } from '@/types/job';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FitEvaluationButtonProps {
  keyCompetencies: KeyCompetency[];
  experiences: Experience[];
  minExperience?: string;
  onEvaluated: (competencies: KeyCompetency[], minimumRequirements?: MinimumRequirementsCheck) => void;
}

export function FitEvaluationButton({ keyCompetencies, experiences, minExperience, onEvaluated }: FitEvaluationButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const hasCompetencies = keyCompetencies && keyCompetencies.length > 0;
  const hasExperiences = experiences && experiences.length > 0;
  const canEvaluate = hasCompetencies && hasExperiences;

  const handleEvaluate = async () => {
    if (!canEvaluate) {
      if (!hasExperiences) {
        toast.error('경력 탭에서 경험을 먼저 등록해주세요');
      } else if (!hasCompetencies) {
        toast.error('공고에서 추출된 핵심 역량이 필요합니다');
      }
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('evaluate-fit', {
        body: {
          keyCompetencies,
          experiences,
          minExperience,
        }
      });

      if (error) throw error;

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

  const disabledReason = !hasExperiences 
    ? '경력 탭에서 경험을 먼저 등록하세요' 
    : !hasCompetencies 
    ? '공고에서 핵심 역량이 추출되어야 합니다' 
    : '';

  return (
    <div className="w-full">
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleEvaluate}
        disabled={isLoading || !canEvaluate}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4 mr-2" />
        )}
        AI로 내 적합도 평가하기
      </Button>
      {!canEvaluate && disabledReason && (
        <p className="text-xs text-muted-foreground text-center mt-1">{disabledReason}</p>
      )}
    </div>
  );
}
