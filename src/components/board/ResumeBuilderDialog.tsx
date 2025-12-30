import { useState, useEffect, useMemo } from 'react';
import { JobPosting, KeyCompetency, Experience, TailoredResume } from '@/types/job';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, CheckCircle2, Loader2, Copy, ArrowRight, Save, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useData } from '@/contexts/DataContext';

interface ResumeBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobPosting;
  keyCompetencies: KeyCompetency[];
  experiences: Experience[];
  onNavigateToCareer?: (tailoredResumeId?: string) => void;
}

type ResumeFormat = 'consulting';

function detectLanguage(text: string): 'ko' | 'en' {
  // Count Korean characters (including spaces between Korean text)
  const koreanChars = (text.match(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g) || []).length;
  // Count English characters
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  
  // If there are very few characters of either type, check for specific patterns
  const totalChars = koreanChars + englishChars;
  if (totalChars < 10) {
    return 'ko'; // Default to Korean for very short text
  }
  
  // Use a threshold: if more than 70% is English, treat as English
  const englishRatio = englishChars / totalChars;
  return englishRatio > 0.7 ? 'en' : 'ko';
}

export function ResumeBuilderDialog({
  open,
  onOpenChange,
  job,
  keyCompetencies,
  experiences,
  onNavigateToCareer,
}: ResumeBuilderDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedFormat, setSelectedFormat] = useState<ResumeFormat>('consulting');
  const [selectedExperiences, setSelectedExperiences] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [rawAIContent, setRawAIContent] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [lastSavedTailoredResumeId, setLastSavedTailoredResumeId] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const { addTailoredResume } = useData();

  const workExperiences = useMemo(() => experiences.filter(e => e.type === 'work'), [experiences]);
  const projectExperiences = useMemo(() => experiences.filter(e => e.type === 'project'), [experiences]);

  // Auto-select all work experiences when dialog opens
  useEffect(() => {
    if (open) {
      const workIds = workExperiences.map(e => e.id);
      setSelectedExperiences(workIds);
      setStep(1);
      setGeneratedContent(null);
      setAiFeedback(null);
      setRawAIContent(null);
      setIsGenerating(false);
      setIsSaved(false);
      setLastSavedTailoredResumeId(null);
    }
  }, [open, workExperiences]);

  const toggleExperience = (id: string, e?: React.MouseEvent) => {
    // Prevent event propagation to avoid dialog closing
    e?.stopPropagation();
    e?.preventDefault();
    setSelectedExperiences(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const selectAllExperiences = () => {
    setSelectedExperiences(experiences.map(e => e.id));
  };

  const deselectAllExperiences = () => {
    setSelectedExperiences([]);
  };

  const language = useMemo(() => {
    // Analyze job title, summary, and key competencies for language detection
    const competencyText = keyCompetencies.map(k => `${k.title} ${k.description}`).join(' ');
    const textToAnalyze = `${job.title} ${job.summary || ''} ${competencyText}`;
    return detectLanguage(textToAnalyze);
  }, [job.title, job.summary, keyCompetencies]);

  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (selectedExperiences.length === 0) {
      toast.error('최소 1개의 경험을 선택해주세요');
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);
    setIsGenerating(true);
    setGeneratedContent(null);
    setAiFeedback(null);

    try {
      const selectedExps = experiences.filter(e => selectedExperiences.includes(e.id));

      const { data, error } = await supabase.functions.invoke('generate-resume', {
        body: {
          jobTitle: job.title,
          companyName: job.companyName,
          jobSummary: job.summary || '',
          keyCompetencies: keyCompetencies.map(k => ({
            title: k.title,
            description: k.description,
            score: k.score,
            evaluation: k.evaluation,
          })),
          experiences: selectedExps,
          language,
          format: selectedFormat,
          minimumRequirementsCheck: job.minimumRequirementsCheck,
        },
      });

      // Check if aborted
      if (controller.signal.aborted) {
        return;
      }

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to generate resume');

      setGeneratedContent(data.content);
      setAiFeedback(data.aiFeedback || null);
      setRawAIContent(data.rawContent || null);
      setStep(2); // Now step 2 is the result
      toast.success('맞춤 이력서가 생성되었습니다');
    } catch (error) {
      if (controller.signal.aborted) {
        toast.info('이력서 생성이 중단되었습니다');
        return;
      }
      console.error('Error generating resume:', error);
      toast.error(error instanceof Error ? error.message : '이력서 생성 실패');
    } finally {
      setIsGenerating(false);
      setAbortController(null);
    }
  };

  const handleAbort = () => {
    if (abortController) {
      abortController.abort();
      setIsGenerating(false);
      setAbortController(null);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!generatedContent) return;
    await navigator.clipboard.writeText(generatedContent);
    toast.success('클립보드에 복사되었습니다');
  };

  const handleSaveToCareer = () => {
    if (!generatedContent) return;

    const now = new Date();
    const id = Date.now().toString();
    const newTailoredResume: TailoredResume = {
      id,
      jobPostingId: job.id,
      companyName: job.companyName,
      jobTitle: job.title,
      content: generatedContent,
      aiFeedback: aiFeedback || undefined,
      language,
      format: selectedFormat,
      createdAt: now,
      updatedAt: now,
    };

    addTailoredResume(newTailoredResume);
    setLastSavedTailoredResumeId(id);
    setIsSaved(true);
    toast.success('공고별 이력서가 저장되었습니다');
  };

  const handleNavigateToCareer = () => {
    onOpenChange(false);
    onNavigateToCareer?.(lastSavedTailoredResumeId ?? undefined);
  };

  // Step1 is now experience selection (removed format selection)
  const Step1 = () => (
    <div className="space-y-4">
      <div className="bg-secondary/30 rounded-lg p-3 text-sm text-muted-foreground">
        생성 언어: <span className="font-medium text-foreground">{language === 'ko' ? '국문' : '영문'}</span> (공고 언어 기반)
      </div>
      
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">핵심 역량 기준</h4>
        <p className="text-xs text-muted-foreground">
          AI가 아래 역량에 맞게 경험을 최적화합니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {keyCompetencies.map((comp, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {comp.title}
            </Badge>
          ))}
        </div>
      </div>

      {/* Select All / Deselect All */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            selectAllExperiences();
          }}
        >
          모두 선택
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deselectAllExperiences();
          }}
        >
          모두 해제
        </Button>
      </div>

      <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
        {workExperiences.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold sticky top-0 bg-background py-1 z-10">경력 (자동 선택됨)</h4>
            {workExperiences.map((exp) => (
              <ExperienceCheckbox
                key={exp.id}
                experience={exp}
                checked={selectedExperiences.includes(exp.id)}
                onToggle={(e) => toggleExperience(exp.id, e)}
              />
            ))}
          </div>
        )}

        {projectExperiences.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold sticky top-0 bg-background py-1 z-10">프로젝트</h4>
            {projectExperiences.map((exp) => (
              <ExperienceCheckbox
                key={exp.id}
                experience={exp}
                checked={selectedExperiences.includes(exp.id)}
                onToggle={(e) => toggleExperience(exp.id, e)}
              />
            ))}
          </div>
        )}

        {experiences.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            경력 탭에서 경험을 먼저 추가해주세요.
          </p>
        )}
      </div>
    </div>
  );

  // Step2 is now the result view
  const Step2 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          맞춤 이력서 생성 완료
        </h4>
        <p className="text-xs text-muted-foreground">
          {job.companyName} - {job.title} 포지션에 최적화된 이력서입니다.
        </p>
      </div>

      <div className="bg-secondary/30 rounded-lg p-4 overflow-x-auto max-h-[45vh] overflow-y-auto">
        <pre className="text-sm whitespace-pre-wrap break-words font-sans text-foreground [overflow-wrap:anywhere]">
          {generatedContent}
        </pre>
      </div>
    </div>
  );


  // Allow closing during generation now that we have abort
  const handleOpenChange = (open: boolean) => {
    if (!open && isGenerating) {
      handleAbort();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] rounded-2xl flex flex-col p-0">
        <div className="px-6 pt-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              맞춤 이력서 만들기
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 mt-4">
            <div className={cn('flex-1 h-1 rounded-full', step >= 1 ? 'bg-primary' : 'bg-muted')} />
            <div className={cn('flex-1 h-1 rounded-full', step >= 2 ? 'bg-primary' : 'bg-muted')} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 1 && <Step1 />}
          {step === 2 && <Step2 />}
        </div>

        <div className="px-6 pb-6 pt-3 border-t border-border bg-background">
          {step === 1 && !generatedContent && (
            <div className="flex flex-col gap-2">
              {!isGenerating && (
                <div className="bg-muted/50 text-muted-foreground text-xs p-2 rounded-lg text-center">
                  20초 정도 소요됩니다. 중간에 창을 닫거나 나가면 저장되지 않습니다.
                </div>
              )}
              {isGenerating && (
                <div className="bg-warning/10 text-warning text-xs p-2 rounded-lg text-center">
                  생성 중... 20초 정도 소요됩니다. 중간에 창을 닫거나 나가면 저장되지 않습니다.
                </div>
              )}
              {isGenerating ? (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleAbort}
                >
                  <X className="w-4 h-4 mr-2" />
                  중단하기
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleGenerate}
                  disabled={selectedExperiences.length === 0}
                >
                  맞춤 이력서 생성
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-2">
              {!isSaved ? (
                <>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={handleCopyToClipboard}>
                      <Copy className="w-4 h-4 mr-2" />
                      복사
                    </Button>
                    <Button className="flex-1" onClick={handleSaveToCareer}>
                      <Save className="w-4 h-4 mr-2" />
                      공고별 이력서 저장
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => {
                      setStep(1);
                      setGeneratedContent(null);
                    }}
                  >
                    다시 생성하기
                  </Button>
                </>
              ) : (
                <>
                  <Button className="w-full" onClick={handleNavigateToCareer}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    공고별 이력서 확인하기
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                    닫기
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExperienceCheckbox({
  experience,
  checked,
  onToggle,
}: {
  experience: Experience;
  checked: boolean;
  onToggle: (e?: React.MouseEvent) => void;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle(e);
  };

  return (
    <div
      className={cn(
        'border rounded-lg p-3 cursor-pointer transition-colors',
        checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <Checkbox 
          checked={checked} 
          className="mt-1" 
          onClick={(e) => {
            e.stopPropagation();
            onToggle(e);
          }}
          onCheckedChange={() => {}}
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{experience.title}</p>
          {experience.company && (
            <p className="text-xs text-muted-foreground">{experience.company}</p>
          )}
          <ul className="mt-1 space-y-0.5">
            {experience.bullets.slice(0, 2).map((bullet, i) => (
                <li key={i} className="text-xs text-muted-foreground break-words [overflow-wrap:anywhere]">
                  • {bullet}
                </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

