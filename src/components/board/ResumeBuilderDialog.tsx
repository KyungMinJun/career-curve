import { useState } from 'react';
import { JobPosting, KeyCompetency, Experience } from '@/types/job';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, Download, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface ResumeBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobPosting;
  keyCompetencies: KeyCompetency[];
  experiences: Experience[];
}

type ResumeFormat = 'standard' | 'creative' | 'minimal';

const RESUME_FORMATS: { id: ResumeFormat; name: string; description: string }[] = [
  { id: 'standard', name: '표준형', description: '전통적인 형식의 이력서' },
  { id: 'creative', name: '창의형', description: '디자인이 강조된 이력서' },
  { id: 'minimal', name: '간결형', description: '핵심만 담은 1페이지 이력서' },
];

export function ResumeBuilderDialog({
  open,
  onOpenChange,
  job,
  keyCompetencies,
  experiences,
}: ResumeBuilderDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedFormat, setSelectedFormat] = useState<ResumeFormat>('standard');
  const [selectedExperiences, setSelectedExperiences] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const workExperiences = experiences.filter(e => e.type === 'work');
  const projectExperiences = experiences.filter(e => e.type === 'project');

  const toggleExperience = (id: string) => {
    setSelectedExperiences(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (selectedExperiences.length === 0) {
      toast.error('최소 1개의 경험을 선택해주세요');
      return;
    }

    setIsGenerating(true);
    
    // TODO: Call AI to generate resume
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsGenerating(false);
    toast.success('이력서가 생성되었습니다');
    onOpenChange(false);
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        공고에서 요구하는 핵심 역량에 맞는 이력서 형식을 선택하세요.
      </p>
      
      <div className="space-y-3">
        {RESUME_FORMATS.map((format) => (
          <div
            key={format.id}
            className={cn(
              'border rounded-lg p-4 cursor-pointer transition-colors',
              selectedFormat === format.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            )}
            onClick={() => setSelectedFormat(format.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{format.name}</p>
                <p className="text-sm text-muted-foreground">{format.description}</p>
              </div>
              {selectedFormat === format.id && (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              )}
            </div>
          </div>
        ))}
      </div>

      <Button className="w-full" onClick={() => setStep(2)}>
        다음: 경험 선택
      </Button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">핵심 역량 기준</h4>
        <p className="text-xs text-muted-foreground">
          아래 역량에 맞는 경험을 선택하세요.
        </p>
        <div className="flex flex-wrap gap-2">
          {keyCompetencies.map((comp, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {comp.title}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {workExperiences.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">경력</h4>
            {workExperiences.map((exp) => (
              <ExperienceCheckbox
                key={exp.id}
                experience={exp}
                checked={selectedExperiences.includes(exp.id)}
                onToggle={() => toggleExperience(exp.id)}
              />
            ))}
          </div>
        )}

        {projectExperiences.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">프로젝트</h4>
            {projectExperiences.map((exp) => (
              <ExperienceCheckbox
                key={exp.id}
                experience={exp}
                checked={selectedExperiences.includes(exp.id)}
                onToggle={() => toggleExperience(exp.id)}
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

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
          이전
        </Button>
        <Button 
          className="flex-1" 
          onClick={handleGenerate}
          disabled={isGenerating || selectedExperiences.length === 0}
        >
          {isGenerating ? (
            '생성 중...'
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              이력서 생성
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            맞춤 이력서 만들기
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          <div className={cn('flex-1 h-1 rounded-full', step >= 1 ? 'bg-primary' : 'bg-muted')} />
          <div className={cn('flex-1 h-1 rounded-full', step >= 2 ? 'bg-primary' : 'bg-muted')} />
        </div>

        <ScrollArea className="max-h-[60vh]">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </ScrollArea>
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
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        'border rounded-lg p-3 cursor-pointer transition-colors',
        checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      )}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <Checkbox checked={checked} className="mt-1" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{experience.title}</p>
          {experience.company && (
            <p className="text-xs text-muted-foreground">{experience.company}</p>
          )}
          <ul className="mt-1 space-y-0.5">
            {experience.bullets.slice(0, 2).map((bullet, i) => (
              <li key={i} className="text-xs text-muted-foreground truncate">
                • {bullet}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
