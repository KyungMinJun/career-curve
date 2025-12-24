import { useState, useRef } from 'react';
import { Plus, FileText, Upload, Trash2, Edit2, ChevronDown, ChevronUp, File, Loader2, Briefcase, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useJobStore } from '@/stores/jobStore';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Experience, Resume, ExperienceType } from '@/types/job';
import { supabase } from '@/integrations/supabase/client';
import { extractTextFromPdf, renderPdfToImageDataUrls } from '@/lib/pdfParser';

export function CareerTab() {
  const { experiences, resumes, addExperience, updateExperience, removeExperience, addResume, updateResume, removeResume } = useJobStore();
  const [resumesOpen, setResumesOpen] = useState(true);
  const [workOpen, setWorkOpen] = useState(true);
  const [projectOpen, setProjectOpen] = useState(true);
  const [isAddingExperience, setIsAddingExperience] = useState(false);
  const [editingExperience, setEditingExperience] = useState<string | null>(null);
  const [newExperienceType, setNewExperienceType] = useState<ExperienceType>('work');
  const [isUploading, setIsUploading] = useState(false);
  const [logResumeId, setLogResumeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const workExperiences = experiences.filter(e => e.type === 'work');
  const projectExperiences = experiences.filter(e => e.type === 'project');
  const logResume = logResumeId ? resumes.find(r => r.id === logResumeId) : undefined;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('PDF 파일만 업로드 가능합니다');
      return;
    }

    setIsUploading(true);

    // 업로드 시점에 화면에 남아있는 "예시/목데이터" 경험은 먼저 제거 (실제 데이터만 남기기)
    const mockLike = (e: any) => {
      const title = String(e?.title ?? '').trim();
      const company = String(e?.company ?? '').trim();
      const desc = String(e?.description ?? '').trim();
      return /^(예시|샘플|Sample|Dummy|목데이터)/i.test(title) || /목데이터|샘플|example/i.test(`${title} ${company} ${desc}`);
    };
    experiences.filter(mockLike).forEach((e) => removeExperience(e.id));

    try {
      const fileUrl = URL.createObjectURL(file);

      const newResume: Resume = {
        id: Date.now().toString(),
        fileName: file.name,
        fileUrl: fileUrl,
        uploadedAt: new Date(),
        parseStatus: 'pending',
      };

      addResume(newResume);
      toast.success('이력서가 업로드되었습니다. 분석 중...');

      // 1) PDF 텍스트 추출 시도
      let resumeText = '';
      try {
        resumeText = await extractTextFromPdf(file);
        console.log('Extracted text length:', resumeText.length);
      } catch (err) {
        console.error('Failed to extract PDF text:', err);
      }

      // 2) 텍스트가 거의 없으면(스캔본 등) → 이미지(OCR) 기반으로 분석
      let pageImages: string[] | undefined;
      if (!resumeText || resumeText.trim().length < 80) {
        try {
          // OCR 정확도/커버리지 ↑: 더 많은 페이지를 렌더링하되, 해상도는 과도한 용량을 피하기 위해 적절히 조절
          pageImages = await renderPdfToImageDataUrls(file, { maxPages: 6, scale: 2.4, quality: 0.78 });
          console.log('Rendered pages for OCR:', pageImages.length);
        } catch (err) {
          console.error('Failed to render PDF pages:', err);
        }
      }

      // 3) (진단) 추출된 텍스트를 Resume에 저장
      updateResume(newResume.id, {
        extractedText: resumeText?.trim() ? resumeText : undefined,
      });

      // 4) 둘 다 실패하면 사용자에게 안내
      if ((!resumeText || resumeText.trim().length < 80) && (!pageImages || pageImages.length === 0)) {
        updateResume(newResume.id, {
          parseStatus: 'fail',
          parseError: 'PDF 텍스트 추출 0자 + OCR 이미지 생성 실패',
        });
        toast.error('PDF에서 텍스트를 추출할 수 없습니다. (OCR용 이미지 생성도 실패)');
        setIsUploading(false);
        return;
      }

      // 5) 백엔드 분석 호출 (텍스트 우선, 필요시 이미지로 OCR)
      try {
        const { data, error } = await supabase.functions.invoke('parse-resume', {
          body: {
            fileName: file.name,
            resumeId: newResume.id,
            resumeText: resumeText,
            pageImages,
          },
        });

        if (error) throw error;

        // (진단) OCR 텍스트도 저장
        updateResume(newResume.id, {
          ocrText: typeof data?.ocrText === 'string' && data.ocrText.trim() ? data.ocrText : undefined,
          parsedAt: new Date(),
        });

        const extractedLen = Number(data?.extractedTextLength ?? 0);

        if (data?.experiences && data.experiences.length > 0) {
          // 이전에 "이력서에서 가져온" 경험 + 목데이터로 보이는 경험은 교체/정리
          const mockLikeLocal = (e: any) => {
            const title = String(e?.title ?? '').trim();
            const company = String(e?.company ?? '').trim();
            const desc = String(e?.description ?? '').trim();
            return /^(예시|샘플|Sample|Dummy|목데이터)/i.test(title) || /목데이터|샘플|example/i.test(`${title} ${company} ${desc}`);
          };

          experiences
            .filter((e) => (e.usedInPostings || []).some((t) => t.startsWith('source:resume:')) || mockLikeLocal(e))
            .forEach((e) => removeExperience(e.id));

          const validExperiences = data.experiences.filter((exp: any) => {
            const title = String(exp?.title ?? '').trim();
            const company = String(exp?.company ?? '').trim();
            const desc = String(exp?.description ?? '').trim();
            const bullets = Array.isArray(exp?.bullets) ? exp.bullets.filter((b: any) => String(b).trim()) : [];

            const looksLikeMock = /^(예시|샘플|Sample|Dummy|목데이터)/i.test(title) || /목데이터|샘플|example/i.test(`${title} ${company} ${desc}`);
            const hasSignal = title.length >= 2 && (desc.length >= 3 || bullets.length >= 1 || company.length >= 2);
            return !looksLikeMock && hasSignal;
          });

          validExperiences.forEach((exp: any) => {
            addExperience({
              id: Date.now().toString() + Math.random(),
              type: exp.type || 'work',
              title: exp.title,
              company: exp.company,
              period: exp.period || undefined,
              description: exp.description || '',
              bullets: exp.bullets || [],
              usedInPostings: [`source:resume:${newResume.id}`],
              createdAt: new Date(),
            });
          });

          if (validExperiences.length === 0) {
            updateResume(newResume.id, {
              parseStatus: 'fail',
              parseError: `경험 0개 (추출텍스트 ${extractedLen}자)`,
            });
            toast.error('이력서에서 경험을 추출할 수 없습니다. (텍스트는 잡혔지만 구조화에 실패)');
            return;
          }

          updateResume(newResume.id, { parseStatus: 'success', parseError: undefined });
          toast.success(`이력서 분석 완료! ${validExperiences.length}개의 경험을 추출했습니다.`);
        } else {
          updateResume(newResume.id, {
            parseStatus: 'fail',
            parseError: `경험 0개 (추출텍스트 ${extractedLen}자)`,
          });
          toast.error('이력서에서 경험을 추출할 수 없습니다.');
        }
      } catch (parseError) {
        console.error('Resume parse error:', parseError);
        updateResume(newResume.id, { parseStatus: 'fail', parseError: '분석 실패' });
        toast.error('이력서 분석에 실패했습니다.');
      }
    } catch (error) {
      toast.error('업로드 실패. 다시 시도해주세요.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddExperience = (type: ExperienceType) => {
    setNewExperienceType(type);
    setIsAddingExperience(true);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-safe-top pb-4 bg-background safe-top">
        <h1 className="text-xl font-bold text-foreground">경력</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          이력서와 경험을 관리하세요
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-4 scrollbar-hide">
        {/* Resumes Section */}
        <Collapsible open={resumesOpen} onOpenChange={setResumesOpen}>
          <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
            <CollapsibleTrigger className="w-full flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <File className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">이력서</h2>
                <Badge variant="secondary" className="text-xs">{resumes.length}</Badge>
              </div>
              {resumesOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <Button 
                  variant="outline" 
                  className="w-full border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  이력서 업로드 (PDF)
                </Button>

                {resumes.map((resume) => (
                  <div key={resume.id} className="bg-secondary/30 rounded-lg p-3 group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <File className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {resume.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(resume.uploadedAt).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={resume.parseStatus === 'success' ? 'default' : 'secondary'}
                          className={cn('text-xs', resume.parseStatus === 'pending' && 'animate-pulse')}
                        >
                          {resume.parseStatus === 'pending' && '분석 중'}
                          {resume.parseStatus === 'success' && '완료'}
                          {resume.parseStatus === 'fail' && '실패'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7"
                          onClick={() => setLogResumeId(resume.id)}
                          aria-label="파싱 로그 보기"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeResume(resume.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {resume.parseError && (
                      <p className="text-xs text-warning mt-2">{resume.parseError}</p>
                    )}
                  </div>
                ))}

                {resumes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    이력서를 업로드하면 자동으로 분석됩니다
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Work Experience Section */}
        <Collapsible open={workOpen} onOpenChange={setWorkOpen}>
          <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
            <CollapsibleTrigger className="w-full flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">경력</h2>
                <Badge variant="secondary" className="text-xs">{workExperiences.length}</Badge>
              </div>
              {workOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-3">
                {workExperiences.map((exp) => (
                  <ExperienceCard 
                    key={exp.id} 
                    experience={exp} 
                    onEdit={() => setEditingExperience(exp.id)}
                    onDelete={() => removeExperience(exp.id)}
                  />
                ))}

                {workExperiences.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    이력서를 업로드하거나 직접 추가해주세요
                  </p>
                )}

                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full"
                  onClick={() => handleAddExperience('work')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  경력 추가
                </Button>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Project Section */}
        <Collapsible open={projectOpen} onOpenChange={setProjectOpen}>
          <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
            <CollapsibleTrigger className="w-full flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">프로젝트</h2>
                <Badge variant="secondary" className="text-xs">{projectExperiences.length}</Badge>
              </div>
              {projectOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-3">
                {projectExperiences.map((exp) => (
                  <ExperienceCard 
                    key={exp.id} 
                    experience={exp} 
                    onEdit={() => setEditingExperience(exp.id)}
                    onDelete={() => removeExperience(exp.id)}
                  />
                ))}

                {projectExperiences.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    이력서를 업로드하거나 직접 추가해주세요
                  </p>
                )}

                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full"
                  onClick={() => handleAddExperience('project')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  프로젝트 추가
                </Button>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </div>

      {/* Experience Add/Edit Dialog */}
      <ExperienceDialog
        open={isAddingExperience || !!editingExperience}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddingExperience(false);
            setEditingExperience(null);
          }
        }}
        experience={editingExperience ? experiences.find(e => e.id === editingExperience) : undefined}
        defaultType={newExperienceType}
        onSave={(exp) => {
          if (editingExperience) {
            updateExperience(editingExperience, exp);
          } else {
            addExperience({ 
              id: Date.now().toString(), 
              ...exp,
              createdAt: new Date() 
            });
          }
          setIsAddingExperience(false);
          setEditingExperience(null);
        }}
      />

      {/* Resume Parse Logs Dialog */}
      <Dialog open={!!logResumeId} onOpenChange={(open) => !open && setLogResumeId(null)}>
        <DialogContent className="max-w-[92%] rounded-2xl">
          <DialogHeader>
            <DialogTitle>이력서 인식 로그</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-foreground font-medium truncate">{logResume?.fileName}</p>
              <p className="text-xs text-muted-foreground">
                PDF 텍스트: {(logResume?.extractedText?.length ?? 0).toLocaleString()}자 • OCR: {(logResume?.ocrText?.length ?? 0).toLocaleString()}자
              </p>
            </div>

            <div className="space-y-2">
              <Label>PDF 텍스트(추출 결과)</Label>
              <Textarea
                value={logResume?.extractedText ?? ''}
                readOnly
                rows={8}
                placeholder="(비어있으면 PDF에서 텍스트가 추출되지 않은 상태입니다)"
              />
            </div>

            <div className="space-y-2">
              <Label>OCR 텍스트(이미지 인식 결과)</Label>
              <Textarea
                value={logResume?.ocrText ?? ''}
                readOnly
                rows={8}
                placeholder="(비어있으면 OCR 인식이 실패한 상태입니다)"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setLogResumeId(null)}>
                닫기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExperienceCard({ experience, onEdit, onDelete }: { experience: Experience; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="bg-secondary/30 rounded-lg p-3 group">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-sm text-foreground">{experience.title}</h3>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {experience.company && <span>{experience.company}</span>}
            {experience.company && experience.period && <span>•</span>}
            {experience.period && <span>{experience.period}</span>}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onEdit}>
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      {experience.description && (
        <p className="text-xs text-muted-foreground mb-2">{experience.description}</p>
      )}
      <ul className="space-y-1 text-xs text-muted-foreground">
        {experience.bullets.slice(0, 3).map((bullet, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-primary">•</span>
            <span>{bullet}</span>
          </li>
        ))}
        {experience.bullets.length > 3 && (
          <li className="text-primary text-xs">+{experience.bullets.length - 3}개 더...</li>
        )}
      </ul>
    </div>
  );
}

interface ExperienceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experience?: Experience;
  defaultType: ExperienceType;
  onSave: (exp: Omit<Experience, 'id' | 'createdAt'>) => void;
}

function ExperienceDialog({ open, onOpenChange, experience, defaultType, onSave }: ExperienceDialogProps) {
  const [formData, setFormData] = useState({
    type: experience?.type || defaultType,
    title: experience?.title || '',
    company: experience?.company || '',
    period: experience?.period || '',
    description: experience?.description || '',
    bullets: experience?.bullets.join('\n') || '',
    usedInPostings: experience?.usedInPostings || [],
  });

  const handleSave = () => {
    onSave({
      type: formData.type,
      title: formData.title,
      company: formData.company || undefined,
      period: formData.period || undefined,
      description: formData.description,
      bullets: formData.bullets.split('\n').filter(b => b.trim()),
      usedInPostings: formData.usedInPostings,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90%] rounded-2xl">
        <DialogHeader>
          <DialogTitle>{experience ? '수정' : formData.type === 'work' ? '경력 추가' : '프로젝트 추가'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>유형</Label>
            <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as ExperienceType })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="work">경력</SelectItem>
                <SelectItem value="project">프로젝트</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expTitle">제목</Label>
            <Input
              id="expTitle"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={formData.type === 'work' ? '예: 시니어 프론트엔드 개발자' : '예: 커머스 플랫폼 개발'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expCompany">{formData.type === 'work' ? '회사' : '조직/팀'}</Label>
            <Input
              id="expCompany"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="예: 스타트업 ABC"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expPeriod">기간</Label>
            <Input
              id="expPeriod"
              value={formData.period}
              onChange={(e) => setFormData({ ...formData, period: e.target.value })}
              placeholder="예: 2022.01 - 2023.12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expDesc">설명</Label>
            <Input
              id="expDesc"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="역할에 대한 간단한 설명"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expBullets">주요 성과 (줄바꿈으로 구분)</Label>
            <Textarea
              id="expBullets"
              value={formData.bullets}
              onChange={(e) => setFormData({ ...formData, bullets: e.target.value })}
              placeholder="• MAU 50만 서비스 개발&#10;• 성능 30% 개선"
              rows={4}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button className="flex-1" onClick={handleSave}>
              저장
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
