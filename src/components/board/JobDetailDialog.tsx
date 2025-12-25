import { useState } from 'react';
import { JobPosting, JobStatus, STATUS_LABELS, STATUS_COLORS, KeyCompetency, CompanyCriteriaScore } from '@/types/job';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useJobStore } from '@/stores/jobStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  ExternalLink, 
  Star, 
  ChevronDown, 
  Building2, 
  MapPin, 
  Briefcase, 
  Calendar,
  Globe,
  FileText,
  Quote,
  AlertCircle,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { ResumeBuilderDialog } from './ResumeBuilderDialog';
import { FitEvaluationButton } from './FitEvaluationButton';
import { Textarea } from '@/components/ui/textarea';

interface JobDetailDialogProps {
  job: JobPosting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToCareer?: () => void;
}

export function JobDetailDialog({ job, open, onOpenChange, onNavigateToCareer }: JobDetailDialogProps) {
  const { updateJobPosting, currentGoal, experiences } = useJobStore();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isResumeBuilderOpen, setIsResumeBuilderOpen] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<number | null>(null);
  const [editEvalText, setEditEvalText] = useState('');
  
  // Initialize company criteria scores from goal or job
  const [companyCriteriaScores, setCompanyCriteriaScores] = useState<CompanyCriteriaScore[]>(() => {
    if (job.companyCriteriaScores?.length) {
      return job.companyCriteriaScores;
    }
    return currentGoal?.companyEvalCriteria.map(c => ({ ...c, score: undefined })) || [];
  });

  // Key competency scores (for fit score)
  const [keyCompetencyScores, setKeyCompetencyScores] = useState<KeyCompetency[]>(
    job.keyCompetencies || []
  );

  // Calculate average scores
  const companyAvg = companyCriteriaScores.filter(c => c.score).length > 0
    ? Math.round(companyCriteriaScores.reduce((sum, c) => sum + (c.score || 0), 0) / companyCriteriaScores.filter(c => c.score).length)
    : 0;
  
  const fitAvg = keyCompetencyScores.filter(c => c.score).length > 0
    ? Math.round(keyCompetencyScores.reduce((sum, c) => sum + (c.score || 0), 0) / keyCompetencyScores.filter(c => c.score).length)
    : 0;

  const handleStatusChange = (status: JobStatus) => {
    updateJobPosting(job.id, { status });
  };

  const handlePriorityChange = (priority: number) => {
    updateJobPosting(job.id, { priority });
  };

  const handleCompanyCriteriaScoreChange = (index: number, score: number) => {
    const updated = [...companyCriteriaScores];
    updated[index] = { ...updated[index], score };
    setCompanyCriteriaScores(updated);
    
    const avg = Math.round(updated.reduce((sum, c) => sum + (c.score || 0), 0) / updated.filter(c => c.score).length) || 0;
    updateJobPosting(job.id, { 
      companyCriteriaScores: updated, 
      companyScore: avg 
    });
    updatePriority(avg, fitAvg);
  };

  const handleKeyCompetencyScoreChange = (index: number, score: number) => {
    const updated = [...keyCompetencyScores];
    updated[index] = { ...updated[index], score };
    setKeyCompetencyScores(updated);
    
    const avg = Math.round(updated.reduce((sum, c) => sum + (c.score || 0), 0) / updated.filter(c => c.score).length) || 0;
    updateJobPosting(job.id, { 
      keyCompetencies: updated, 
      fitScore: avg 
    });
    updatePriority(companyAvg, avg);
  };

  const handleEvaluationUpdate = (index: number, evaluation: string) => {
    const updated = [...keyCompetencyScores];
    updated[index] = { ...updated[index], evaluation };
    setKeyCompetencyScores(updated);
    updateJobPosting(job.id, { keyCompetencies: updated });
    setEditingEvaluation(null);
    setEditEvalText('');
  };

  const handleAIEvaluated = (evaluatedCompetencies: KeyCompetency[]) => {
    setKeyCompetencyScores(evaluatedCompetencies);
    const avg = Math.round(evaluatedCompetencies.reduce((sum, c) => sum + (c.score || 0), 0) / evaluatedCompetencies.filter(c => c.score).length) || 0;
    updateJobPosting(job.id, { 
      keyCompetencies: evaluatedCompetencies, 
      fitScore: avg 
    });
    updatePriority(companyAvg, avg);
  };

  const updatePriority = (compScore: number, fitScoreVal: number) => {
    if (compScore === 0 && fitScoreVal === 0) return;
    const avgScore = ((compScore || 0) + (fitScoreVal || 0)) / 2;
    const newPriority = Math.max(1, Math.min(5, Math.round(6 - avgScore)));
    updateJobPosting(job.id, { priority: newPriority });
  };

  const handleFieldUpdate = (field: string, value: string | boolean) => {
    updateJobPosting(job.id, { [field]: value });
    setEditingField(null);
  };

  const renderStarRating = (value: number, onChange: (v: number) => void, size: 'sm' | 'md' = 'md', allowZero: boolean = false) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button 
          key={i} 
          onClick={() => {
            // Allow setting to 0 by clicking the same star again
            if (allowZero && value === i) {
              onChange(0);
            } else {
              onChange(i);
            }
          }} 
          className="focus:outline-none"
        >
          <Star className={cn(
            'transition-colors', 
            size === 'sm' ? 'w-4 h-4' : 'w-5 h-5',
            i <= value ? 'fill-primary text-primary' : 'text-muted-foreground hover:text-primary/50'
          )} />
        </button>
      ))}
    </div>
  );

  const getDisplayValue = (value: string | boolean | null | undefined, defaultText: string = '확인 불가') => {
    if (value === undefined || value === null || value === '') return defaultText;
    if (typeof value === 'boolean') return value ? '가능' : '불가';
    return value;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] p-0 rounded-2xl overflow-hidden">
          <ScrollArea className="max-h-[85vh]">
            <div className="p-6 space-y-6">
              <DialogHeader className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground font-medium">{job.companyName}</p>
                    <DialogTitle className="text-xl font-bold mt-1">{job.title}</DialogTitle>
                  </div>
                  {job.sourceUrl && (
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="shrink-0" 
                      onClick={() => {
                        // Use noopener,noreferrer to avoid LinkedIn blocking
                        const link = document.createElement('a');
                        link.href = job.sourceUrl!;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.click();
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                
                <div className="pt-2">
                  <Select value={job.status} onValueChange={(v) => handleStatusChange(v as JobStatus)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          <Badge className={cn('text-xs', STATUS_COLORS[key as JobStatus])}>{label}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </DialogHeader>

              {/* Priority Section */}
              <div className="bg-secondary/50 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">우선순위</h3>
                  <Badge variant="outline" className="text-sm font-bold">#{job.priority}</Badge>
                </div>
                
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((p) => (
                    <Button
                      key={p}
                      variant={job.priority === p ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => handlePriorityChange(p)}
                    >
                      #{p}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">회사 매력도</Label>
                    <div className="flex items-center gap-2">
                      {companyAvg > 0 && <span className="text-lg font-bold text-primary">{companyAvg}</span>}
                      <span className="text-xs text-muted-foreground">/ 5</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">내 적합도</Label>
                    <div className="flex items-center gap-2">
                      {fitAvg > 0 && <span className="text-lg font-bold text-primary">{fitAvg}</span>}
                      <span className="text-xs text-muted-foreground">/ 5</span>
                    </div>
                  </div>
                </div>
              </div>

              {job.summary && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">AI 요약</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed bg-accent/50 rounded-lg p-3">{job.summary}</p>
                </div>
              )}

              {/* Key Competencies from AI - with scoring and AI evaluation */}
              {keyCompetencyScores.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">핵심 역량 (채용담당자 관점)</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">AI가 추출한 5가지 핵심 역량입니다. 아래 버튼으로 내 경험 기반 적합도를 자동 평가하거나, 직접 점수를 입력하세요.</p>
                  
                  {/* AI Evaluation Button */}
                  <FitEvaluationButton
                    keyCompetencies={keyCompetencyScores}
                    experiences={experiences}
                    onEvaluated={handleAIEvaluated}
                  />

                  {keyCompetencyScores.map((comp, idx) => (
                    <Collapsible key={idx}>
                      <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{comp.title}</p>
                            <p className="text-xs text-muted-foreground">{comp.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">나의 역량:</span>
                          {renderStarRating(comp.score || 0, (v) => handleKeyCompetencyScoreChange(idx, v), 'sm')}
                        </div>
                        {/* AI Evaluation Toggle */}
                        {comp.evaluation && (
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground h-7 px-2">
                              <span>AI 평가 보기</span>
                              <ChevronDown className="w-3 h-3" />
                            </Button>
                          </CollapsibleTrigger>
                        )}
                        <CollapsibleContent>
                          {comp.evaluation && editingEvaluation !== idx && (
                            <div className="bg-background/50 rounded p-2 mt-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs text-muted-foreground italic flex-1">{comp.evaluation}</p>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="w-6 h-6 shrink-0"
                                  onClick={() => {
                                    setEditingEvaluation(idx);
                                    setEditEvalText(comp.evaluation || '');
                                  }}
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                          {editingEvaluation === idx && (
                            <div className="mt-2 space-y-2">
                              <Textarea
                                value={editEvalText}
                                onChange={(e) => setEditEvalText(e.target.value)}
                                className="text-xs min-h-[60px]"
                                placeholder="평가 의견을 수정하세요..."
                              />
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingEvaluation(null);
                                    setEditEvalText('');
                                  }}
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  취소
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleEvaluationUpdate(idx, editEvalText)}
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  저장
                                </Button>
                              </div>
                            </div>
                          )}
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              )}

              {keyCompetencyScores.length === 0 && (
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-warning">핵심 역량 분석 필요</p>
                    <p className="text-xs text-muted-foreground">새 공고를 등록하면 AI가 자동으로 5가지 핵심 역량을 추출합니다.</p>
                  </div>
                </div>
              )}

              {/* Auto-extracted Fields with Evidence */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">공고 정보</h3>
                <div className="grid gap-3">
                  <InfoRowWithEvidence 
                    icon={<Briefcase className="w-4 h-4" />} 
                    label="포지션" 
                    value={job.position} 
                    field="position" 
                    editingField={editingField} 
                    setEditingField={setEditingField} 
                    onSave={(v) => handleFieldUpdate('position', v)} 
                  />
                  <InfoRowWithEvidence 
                    icon={<Calendar className="w-4 h-4" />} 
                    label="최소 경력" 
                    value={getDisplayValue(job.minExperience)} 
                    evidence={job.minExperienceEvidence}
                    field="minExperience" 
                    editingField={editingField} 
                    setEditingField={setEditingField} 
                    onSave={(v) => handleFieldUpdate('minExperience', v)} 
                    isUnconfirmed={!job.minExperience}
                  />
                  <InfoRowWithEvidence 
                    icon={<Building2 className="w-4 h-4" />} 
                    label="근무 형태" 
                    value={getDisplayValue(job.workType)} 
                    evidence={job.workTypeEvidence}
                    field="workType" 
                    editingField={editingField} 
                    setEditingField={setEditingField} 
                    onSave={(v) => handleFieldUpdate('workType', v)} 
                    isUnconfirmed={!job.workType}
                  />
                  <InfoRowWithEvidence 
                    icon={<MapPin className="w-4 h-4" />} 
                    label="위치" 
                    value={getDisplayValue(job.location)} 
                    evidence={job.locationEvidence}
                    field="location" 
                    editingField={editingField} 
                    setEditingField={setEditingField} 
                    onSave={(v) => handleFieldUpdate('location', v)} 
                    isUnconfirmed={!job.location}
                  />
                  <InfoRowWithEvidence 
                    icon={<Globe className="w-4 h-4" />} 
                    label="비자 지원" 
                    value={job.visaSponsorship === undefined || job.visaSponsorship === null ? '확인 불가' : job.visaSponsorship ? '가능' : '불가'} 
                    evidence={job.visaSponsorshipEvidence}
                    field="visaSponsorship" 
                    editingField={editingField} 
                    setEditingField={setEditingField} 
                    onSave={(v) => handleFieldUpdate('visaSponsorship', v === '가능')} 
                    isUnconfirmed={job.visaSponsorship === undefined || job.visaSponsorship === null}
                  />
                </div>
              </div>

              {/* Detailed Company Scoring */}
              <Collapsible open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between px-0">
                    <span className="font-semibold">자세히 보기 (회사 평가 5가지)</span>
                    <ChevronDown className={cn('w-4 h-4 transition-transform', isDetailOpen && 'rotate-180')} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-4">
                  <p className="text-xs text-muted-foreground">목표 탭에서 설정한 5가지 기준으로 회사를 평가하세요. 같은 별을 다시 누르면 0점으로 초기화됩니다.</p>
                  {companyCriteriaScores.map((criteria, index) => (
                    <div key={index} className="bg-secondary/30 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{criteria.name}</span>
                        <Badge variant="outline" className="text-xs">가중치 {criteria.weight}</Badge>
                      </div>
                      {renderStarRating(criteria.score || 0, (v) => handleCompanyCriteriaScoreChange(index, v), 'sm', true)}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              <Button 
                className="w-full" 
                size="lg"
                onClick={() => setIsResumeBuilderOpen(true)}
                disabled={!keyCompetencyScores.length}
              >
                <FileText className="w-4 h-4 mr-2" />
                이 공고 맞춤 이력서 만들기
              </Button>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <ResumeBuilderDialog
        open={isResumeBuilderOpen}
        onOpenChange={setIsResumeBuilderOpen}
        job={job}
        keyCompetencies={keyCompetencyScores}
        experiences={experiences}
        onNavigateToCareer={() => {
          onOpenChange(false);
          onNavigateToCareer?.();
        }}
      />
    </>
  );
}

interface InfoRowWithEvidenceProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  evidence?: string;
  field: string;
  editingField: string | null;
  setEditingField: (field: string | null) => void;
  onSave: (value: string) => void;
  isUnconfirmed?: boolean;
}

function InfoRowWithEvidence({ icon, label, value, evidence, field, editingField, setEditingField, onSave, isUnconfirmed }: InfoRowWithEvidenceProps) {
  const [localValue, setLocalValue] = useState(value || '');
  const isEditing = editingField === field;

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-2">
        <div className="text-muted-foreground">{icon}</div>
        <Input value={localValue} onChange={(e) => setLocalValue(e.target.value)} className="h-8 flex-1" autoFocus onBlur={() => onSave(localValue)} onKeyDown={(e) => e.key === 'Enter' && onSave(localValue)} />
      </div>
    );
  }

  return (
    <div 
      className="bg-secondary/30 rounded-lg p-3 cursor-pointer hover:bg-secondary/50 transition-colors" 
      onClick={() => setEditingField(field)}
    >
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn('text-sm font-medium truncate', isUnconfirmed ? 'text-warning' : 'text-foreground')}>{value || '확인 불가'}</p>
        </div>
      </div>
      {evidence && (
        <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground bg-background/50 rounded p-2">
          <Quote className="w-3 h-3 shrink-0 mt-0.5" />
          <span className="italic">{evidence}</span>
        </div>
      )}
    </div>
  );
}
