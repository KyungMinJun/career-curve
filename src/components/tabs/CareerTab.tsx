import { useEffect, useState, useRef } from 'react';
import { Plus, FileText, Upload, Trash2, Edit2, ChevronDown, ChevronUp, File, Loader2, Briefcase, FolderKanban, Download, FileCheck, Eye, MessageSquare, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Experience, Resume, ExperienceType, TailoredResume } from '@/types/job';
import { supabase } from '@/integrations/supabase/client';
import { extractTextFromPdf, renderPdfToImageDataUrls } from '@/lib/pdfParser';
import { exportResumeToDocx } from '@/lib/resumeExporter';
import { exportTailoredResumeToDocx, formatResumeForPreview, ResumeFormat } from '@/lib/tailoredResumeExporter';

export function CareerTab() {
  const { experiences, resumes, tailoredResumes, addExperience, updateExperience, removeExperience, addResume, updateResume, removeResume, updateTailoredResume, removeTailoredResume } = useData();
  const { user } = useAuth();
  const userName = user?.user_metadata?.name_ko || user?.user_metadata?.name_en || user?.email || '사용자';
  const userNameKo = user?.user_metadata?.name_ko || '';
  const userNameEn = user?.user_metadata?.name_en || '';
  const [resumesOpen, setResumesOpen] = useState(true);
  const [workOpen, setWorkOpen] = useState(true);
  const [projectOpen, setProjectOpen] = useState(true);
  const [tailoredOpen, setTailoredOpen] = useState(true);
  const [isAddingExperience, setIsAddingExperience] = useState(false);
  const [editingExperience, setEditingExperience] = useState<string | null>(null);
  const [editingTailoredResume, setEditingTailoredResume] = useState<TailoredResume | null>(null);
  const [previewingTailoredResume, setPreviewingTailoredResume] = useState<TailoredResume | null>(null);
  const [newExperienceType, setNewExperienceType] = useState<ExperienceType>('work');
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [logResumeId, setLogResumeId] = useState<string | null>(null);
  const [showUploadWarning, setShowUploadWarning] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Board → Career 이동 이벤트 처리
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<any>;
      const detail = custom.detail;
      if (!detail || typeof detail !== 'object') return;
      if (detail.tab !== 'career') return;

      const resumeId = detail.tailoredResumeId as string | undefined;
      if (!resumeId) return;

      const found = tailoredResumes.find((r) => r.id === resumeId);
      if (!found) return;

      setTailoredOpen(true);
      setPreviewingTailoredResume(found);
    };

    window.addEventListener('navigate-to-tab', handler as EventListener);
    return () => window.removeEventListener('navigate-to-tab', handler as EventListener);
  }, [tailoredResumes]);

  // Sort by createdAt descending (most recent first)
  const workExperiences = experiences
    .filter(e => e.type === 'work')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const projectExperiences = experiences
    .filter(e => e.type === 'project')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const logResume = logResumeId ? resumes.find(r => r.id === logResumeId) : undefined;

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('PDF 파일만 업로드 가능합니다');
      return;
    }

    // Check if there are existing experiences from resume parsing
    const hasExistingExperiences = experiences.some(exp => 
      (exp.usedInPostings || []).some(t => t.startsWith('source:resume:'))
    );

    if (hasExistingExperiences) {
      setPendingFile(file);
      setShowUploadWarning(true);
    } else {
      processFileUpload(file);
    }
  };

  const processFileUpload = async (file: File) => {
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

      // Add resume and get the new ID
      const newResumeId = await addResume({
        fileName: file.name,
        fileUrl: fileUrl,
        uploadedAt: new Date(),
        parseStatus: 'pending',
      });

      if (!newResumeId) {
        toast.error('이력서 추가 중 오류가 발생했습니다');
        setIsUploading(false);
        return;
      }

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
          // OCR 품질/안정성 최적화:
          // - PNG: 글자 윤곽 보존(underscores만 나오던 케이스 방지)
          // - scale: 폰트 렌더링이 안정화되면 글자가 선명하게 나오도록 약간 상향
          pageImages = await renderPdfToImageDataUrls(file, { maxPages: 6, scale: 2.2, format: 'png', quality: 0.72 });
          console.log('Rendered pages for OCR:', pageImages.length);
          console.log('OCR page image sizes(chars):', pageImages.map((s) => s.length));
        } catch (err) {
          console.error('Failed to render PDF pages:', err);
        }
      }

      // 3) (진단) 추출된 텍스트를 Resume에 저장
      updateResume(newResumeId, {
        extractedText: resumeText?.trim() ? resumeText : undefined,
      });

      // 4) 둘 다 실패하면 사용자에게 안내
      if ((!resumeText || resumeText.trim().length < 80) && (!pageImages || pageImages.length === 0)) {
        updateResume(newResumeId, {
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
            resumeId: newResumeId,
            resumeText: resumeText,
            pageImages,
          },
        });

        if (error) throw error;

        // (진단) OCR 텍스트도 저장
        updateResume(newResumeId, {
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

          for (const exp of validExperiences) {
            await addExperience({
              type: exp.type || 'work',
              title: exp.title,
              company: exp.company,
              period: exp.period || undefined,
              description: exp.description || '',
              bullets: exp.bullets || [],
              usedInPostings: [`source:resume:${newResumeId}`],
              createdAt: new Date(),
            });
          }

          if (validExperiences.length === 0) {
            updateResume(newResumeId, {
              parseStatus: 'fail',
              parseError: `경험 0개 (추출텍스트 ${extractedLen}자)`,
            });
            toast.error('이력서에서 경험을 추출할 수 없습니다. (텍스트는 잡혔지만 구조화에 실패)');
            return;
          }

          updateResume(newResumeId, { parseStatus: 'success', parseError: undefined });
          toast.success(`이력서 분석 완료! ${validExperiences.length}개의 경험을 추출했습니다.`);
        } else {
          updateResume(newResumeId, {
            parseStatus: 'fail',
            parseError: `경험 0개 (추출텍스트 ${extractedLen}자)`,
          });
          toast.error('이력서에서 경험을 추출할 수 없습니다.');
        }
      } catch (parseError) {
        console.error('Resume parse error:', parseError);
        updateResume(newResumeId, { parseStatus: 'fail', parseError: '분석 실패' });
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
      <PageHeader title="경력" subtitle="이력서와 경험을 관리하세요" />

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
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    업로드 (PDF)
                  </Button>

                  <Button 
                    variant="outline" 
                    className="flex-1"
                    disabled={experiences.length === 0}
                    onClick={() => setShowResumePreview(true)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    미리보기
                  </Button>

                  <Button 
                    variant="outline" 
                    className="flex-1"
                    disabled={isExporting || experiences.length === 0}
                    onClick={async () => {
                      setIsExporting(true);
                      try {
                        await exportResumeToDocx({ userName, experiences });
                        toast.success('이력서가 다운로드되었습니다');
                      } catch (err) {
                        console.error('Export error:', err);
                        toast.error('이력서 추출에 실패했습니다');
                      } finally {
                        setIsExporting(false);
                      }
                    }}
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    추출 (DOCX)
                  </Button>
                </div>

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
                <h2 className="font-semibold text-foreground">Selected Projects</h2>
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

        {/* Tailored Resumes Section - 공고별 이력서 */}
        <Collapsible open={tailoredOpen} onOpenChange={setTailoredOpen}>
          <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
            <CollapsibleTrigger className="w-full flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">공고별 이력서</h2>
                <Badge variant="secondary" className="text-xs">{tailoredResumes.length}</Badge>
              </div>
              {tailoredOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-3">
                {[...tailoredResumes]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((resume) => (
                    <TailoredResumeCard
                      key={resume.id}
                      resume={resume}
                      onPreview={() => setPreviewingTailoredResume(resume)}
                      onEdit={() => setEditingTailoredResume(resume)}
                      onDelete={() => removeTailoredResume(resume.id)}
                      userName={userName}
                    />
                  ))}

                {tailoredResumes.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    보드에서 공고 카드를 선택 후 &quot;맞춤 이력서 만들기&quot;로 생성할 수 있습니다
                  </p>
                )}
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

      {/* Tailored Resume Edit Dialog */}
      <TailoredResumeEditDialog
        resume={editingTailoredResume}
        open={!!editingTailoredResume}
        onOpenChange={(open) => !open && setEditingTailoredResume(null)}
        onSave={(content) => {
          if (editingTailoredResume) {
            updateTailoredResume(editingTailoredResume.id, { content });
            toast.success('이력서가 수정되었습니다');
          }
          setEditingTailoredResume(null);
        }}
      />

      {/* Tailored Resume Preview Dialog */}
      <TailoredResumePreviewDialog
        resume={previewingTailoredResume}
        open={!!previewingTailoredResume}
        onOpenChange={(open) => !open && setPreviewingTailoredResume(null)}
        userNames={{ ko: userNameKo, en: userNameEn, display: userName }}
      />

      {/* Resume Preview Dialog (경력탭 이력서 미리보기) */}
      <ResumePreviewDialog
        open={showResumePreview}
        onOpenChange={setShowResumePreview}
        userNames={{ ko: userNameKo, en: userNameEn, display: userName }}
        experiences={experiences}
        onExport={async () => {
          setIsExporting(true);
          try {
            // 기본 이력서는 '표시 이름' 사용
            await exportResumeToDocx({ userName, experiences });
            toast.success('이력서가 다운로드되었습니다');
          } catch (err) {
            console.error('Export error:', err);
            toast.error('이력서 추출에 실패했습니다');
          } finally {
            setIsExporting(false);
          }
        }}
        isExporting={isExporting}
      />

      {/* Resume Upload Warning Dialog */}
      <AlertDialog open={showUploadWarning} onOpenChange={setShowUploadWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              새 이력서를 업로드하시겠습니까?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>새 파일을 업로드하면 <strong>기존 경력 데이터가 삭제</strong>됩니다.</p>
              <p className="text-sm text-muted-foreground">
                삭제를 원치 않으신다면, 먼저 현재 상태를 &quot;추출 (DOCX)&quot; 버튼으로 다운로드하세요.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setPendingFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (pendingFile) {
                processFileUpload(pendingFile);
              }
              setPendingFile(null);
              setShowUploadWarning(false);
            }}>
              업로드
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TailoredResumeCard({ 
  resume, 
  onPreview, 
  onEdit, 
  onDelete,
  userName 
}: { 
  resume: TailoredResume; 
  onPreview: () => void;
  onEdit: () => void; 
  onDelete: () => void;
  userName: string;
}) {
  const [isExporting, setIsExporting] = useState(false);
  const dateStr = new Date(resume.createdAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '');

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      await exportTailoredResumeToDocx(resume, userName);
      toast.success('이력서가 다운로드되었습니다');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('다운로드에 실패했습니다');
    } finally {
      setIsExporting(false);
    }
  };
  
  // Check if created within last 24 hours
  const isNew = (new Date().getTime() - new Date(resume.createdAt).getTime()) < 24 * 60 * 60 * 1000;

  return (
    <div className="bg-secondary/30 rounded-lg p-3 group">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-foreground truncate">
              {resume.companyName} - {resume.jobTitle}
            </h3>
            {isNew && (
              <Badge variant="default" className="text-[10px] bg-primary text-primary-foreground shrink-0">
                New!
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{dateStr}</span>
            <Badge variant="outline" className="text-[10px]">
              {resume.language === 'ko' ? '국문' : '영문'}
            </Badge>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onPreview} title="미리보기">
            <Eye className="w-3.5 h-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-7 h-7" 
            onClick={handleDownload}
            disabled={isExporting}
            title="다운로드"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={onEdit} title="편집">
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={onDelete} title="삭제">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">
        {resume.content.replace(/[#*]/g, '').slice(0, 150)}...
      </p>
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
    bullets: experience?.bullets?.join('\n') || '',
    usedInPostings: experience?.usedInPostings || [],
  });

  // Reset form data when experience changes (for editing)
  useState(() => {
    if (open) {
      setFormData({
        type: experience?.type || defaultType,
        title: experience?.title || '',
        company: experience?.company || '',
        period: experience?.period || '',
        description: experience?.description || '',
        bullets: experience?.bullets?.join('\n') || '',
        usedInPostings: experience?.usedInPostings || [],
      });
    }
  });

  // Effect to update form when experience prop changes
  if (open && experience && formData.title !== experience.title) {
    setFormData({
      type: experience.type || defaultType,
      title: experience.title || '',
      company: experience.company || '',
      period: experience.period || '',
      description: experience.description || '',
      bullets: experience.bullets?.join('\n') || '',
      usedInPostings: experience.usedInPostings || [],
    });
  }

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
            <Label htmlFor="expBullets">주요 성과</Label>
            <div className="space-y-2">
              {(formData.bullets || '').split('\n').map((bullet, idx, arr) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-primary mt-2.5 text-sm">•</span>
                  <Input
                    value={bullet}
                    onChange={(e) => {
                      const newBullets = [...arr];
                      newBullets[idx] = e.target.value;
                      setFormData({ ...formData, bullets: newBullets.join('\n') });
                    }}
                    placeholder="성과를 입력하세요"
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-destructive shrink-0"
                    onClick={() => {
                      const newBullets = arr.filter((_, i) => i !== idx);
                      setFormData({ ...formData, bullets: newBullets.join('\n') });
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setFormData({ ...formData, bullets: formData.bullets ? formData.bullets + '\n' : '' })}
              >
                <Plus className="w-4 h-4 mr-2" />
                성과 추가
              </Button>
            </div>
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

function TailoredResumePreviewDialog({ 
  resume, 
  open, 
  onOpenChange,
  userNames
}: { 
  resume: TailoredResume | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  userNames: { ko: string; en: string; display: string };
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleDownload = async () => {
    if (!resume) return;
    setIsExporting(true);
    try {
      const format: ResumeFormat = (resume as any).format ?? (resume.language === 'en' ? 'consulting' : 'narrative');
      const chosenNameDownload = resume.language === 'en'
        ? (userNames.en || userNames.display || 'Name')
        : (userNames.ko || userNames.display || '이름');
      await exportTailoredResumeToDocx(resume, chosenNameDownload, format);
      toast.success('이력서가 다운로드되었습니다');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('다운로드에 실패했습니다');
    } finally {
      setIsExporting(false);
    }
  };

  if (!resume) return null;

  const format: ResumeFormat = (resume as any).format ?? (resume.language === 'en' ? 'consulting' : 'narrative');
  const chosenName = resume.language === 'en'
    ? (userNames.en || userNames.display || 'Name')
    : (userNames.ko || userNames.display || '이름');

  const previewContent = formatResumeForPreview(resume.content, chosenName, format);

  // Make the "resume paper" look consistent with the Career resume preview
  const previewLines = previewContent.split('\n');
  const bodyContent = (() => {
    const first = (previewLines[0] || '').trim();
    const second = (previewLines[1] || '').trim();
    const looksLikeHeader = first.toLowerCase() === chosenName.trim().toLowerCase() || first.includes(chosenName);
    if (looksLikeHeader && !second) return previewLines.slice(2).join('\n');
    if (looksLikeHeader) return previewLines.slice(1).join('\n');
    return previewContent;
  })();

  return (
    <>
      {/* Main Preview Dialog */}
      <Dialog open={open && !showFeedback} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[92%] max-h-[85vh] rounded-2xl flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              이력서 미리보기
            </DialogTitle>
            <DialogDescription>
              {resume.companyName} - {resume.jobTitle} ({resume.language === 'en' ? '컨설팅형' : '서술형'})
            </DialogDescription>
          </DialogHeader>
          
           <div className="flex-1 overflow-hidden flex flex-col gap-3">
             {/* Resume Preview - styled like actual resume */}
              <div className="bg-white dark:bg-zinc-900 border-2 border-border rounded-lg p-6 flex-1 overflow-y-auto min-h-[300px] shadow-inner">
                <h1 className="text-2xl font-bold text-center text-foreground mb-6 border-b-2 border-foreground pb-2">
                  {chosenName}
                </h1>
                <pre className="text-sm whitespace-pre-wrap break-words font-sans text-foreground leading-relaxed [overflow-wrap:anywhere]" style={{ fontFamily: resume.language === 'en' ? 'Georgia, serif' : 'Pretendard, sans-serif' }}>
                  {bodyContent}
                </pre>
              </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {resume.aiFeedback && (
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setShowFeedback(true)}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  AI 피드백 보기
                </Button>
              )}
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => onOpenChange(false)}
              >
                닫기
              </Button>
              <Button className="flex-1" onClick={handleDownload} disabled={isExporting}>
                {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                DOCX 다운로드
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Separate AI Feedback Dialog with enhanced formatting */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent className="max-w-[92%] max-h-[80vh] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              채용담당자 관점 AI 피드백
            </DialogTitle>
            <DialogDescription>
              {resume.companyName} - {resume.jobTitle}
            </DialogDescription>
          </DialogHeader>
          
           <div className="space-y-3">
             <div className="rounded-lg border border-border bg-warning/10 text-warning p-3 text-xs leading-relaxed">
               이 과정에서 왜곡, 과장되는 내용이 있을 수 있으니, 스크리닝은 필수입니다!
             </div>

             <FeedbackSplitView content={resume.aiFeedback || ''} />

             <Button variant="outline" className="w-full" onClick={() => setShowFeedback(false)}>
               이력서로 돌아가기
             </Button>
           </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TailoredResumeEditDialog({ 
  resume, 
  open, 
  onOpenChange, 
  onSave 
}: { 
  resume: TailoredResume | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSave: (content: string) => void;
}) {
  const [content, setContent] = useState(resume?.content || '');

  // Reset when resume changes
  if (resume && content !== resume.content && open) {
    setContent(resume.content);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92%] max-h-[80vh] rounded-2xl flex flex-col">
        <DialogHeader>
          <DialogTitle>공고별 이력서 편집</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          {resume && (
            <p className="text-sm text-muted-foreground">
              {resume.companyName} - {resume.jobTitle}
            </p>
          )}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 min-h-[300px] resize-none"
            placeholder="이력서 내용..."
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button className="flex-1" onClick={() => onSave(content)}>
              저장
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Markdown-like formatting component for AI feedback
function FormattedFeedback({ content }: { content: string }) {
  // Parse markdown-like content into formatted elements
  const formatLine = (line: string, idx: number) => {
    // Headers (## or ###)
    if (line.startsWith('### ')) {
      return (
        <h4 key={idx} className="font-semibold text-base text-foreground mt-4 mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          {line.replace('### ', '')}
        </h4>
      );
    }
    if (line.startsWith('## ')) {
      return (
        <h3 key={idx} className="font-bold text-lg text-foreground mt-4 mb-2 border-b border-border pb-1">
          {line.replace('## ', '')}
        </h3>
      );
    }
    if (line.startsWith('# ')) {
      return (
        <h2 key={idx} className="font-bold text-xl text-foreground mt-4 mb-3">
          {line.replace('# ', '')}
        </h2>
      );
    }

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('• ')) {
      const text = line.replace(/^[-•]\s*/, '');
      return (
        <li key={idx} className="flex gap-2 mb-1.5 ml-2">
          <span className="text-primary mt-0.5">•</span>
          <span>{formatInlineText(text)}</span>
        </li>
      );
    }

    // Numbered lists
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      return (
        <li key={idx} className="flex gap-2 mb-1.5 ml-2">
          <span className="text-primary font-medium min-w-[1.2rem]">{numberedMatch[1]}.</span>
          <span>{formatInlineText(numberedMatch[2])}</span>
        </li>
      );
    }

    // Empty line
    if (!line.trim()) {
      return <div key={idx} className="h-2" />;
    }

    // Regular paragraph with inline formatting
    return (
      <p key={idx} className="mb-2">
        {formatInlineText(line)}
      </p>
    );
  };

  // Format bold (**text**) and inline code (`code`)
  const formatInlineText = (text: string) => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIndex = 0;

    // Process **bold** text
    while (remaining) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        // Text before bold
        if (boldMatch.index > 0) {
          parts.push(<span key={keyIndex++}>{remaining.slice(0, boldMatch.index)}</span>);
        }
        // Bold text
        parts.push(
          <strong key={keyIndex++} className="font-semibold text-foreground">
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      } else {
        parts.push(<span key={keyIndex++}>{remaining}</span>);
        break;
      }
    }

    return parts;
  };

  const lines = content.split('\n');

  return (
    <div className="space-y-0.5">
      {lines.map((line, idx) => formatLine(line, idx))}
    </div>
  );
}

function FeedbackSplitView({ content }: { content: string }) {
  const sections = splitFeedbackSections(content);

  return (
    <div className="grid gap-3">
      <section className="bg-accent/30 rounded-lg p-4 text-sm text-foreground leading-relaxed">
        <h3 className="font-bold text-lg text-foreground mb-2 border-b border-border pb-1">종합의견</h3>
        <div className="max-h-[22vh] overflow-y-auto">
          <FormattedFeedback content={sections.overall} />
        </div>
      </section>

      <section className="bg-accent/30 rounded-lg p-4 text-sm text-foreground leading-relaxed">
        <h3 className="font-bold text-lg text-foreground mb-2 border-b border-border pb-1">세부 수정 의견</h3>
        <div className="max-h-[22vh] overflow-y-auto">
          <FormattedFeedback content={sections.details} />
        </div>
      </section>
    </div>
  );
}

function splitFeedbackSections(raw: string): { overall: string; details: string } {
  const text = (raw || '').trim();
  if (!text) return { overall: '', details: '' };

  // Try Korean headings first
  const koOverallIdx = text.indexOf('## 종합의견');
  const koDetailIdx = text.indexOf('## 세부 수정 의견');
  if (koOverallIdx !== -1 && koDetailIdx !== -1) {
    const overall = text.slice(koOverallIdx + '## 종합의견'.length, koDetailIdx).trim();
    const details = text.slice(koDetailIdx + '## 세부 수정 의견'.length).trim();
    return { overall: overall || '—', details: details || '—' };
  }

  // English headings fallback
  const enOverallIdx = text.toLowerCase().indexOf('## overall assessment');
  const enDetailIdx = text.toLowerCase().indexOf('## detailed revision notes');
  if (enOverallIdx !== -1 && enDetailIdx !== -1) {
    const overall = text.slice(enOverallIdx + '## Overall Assessment'.length, enDetailIdx).trim();
    const details = text.slice(enDetailIdx + '## Detailed Revision Notes'.length).trim();
    return { overall: overall || '—', details: details || '—' };
  }

  // If not structured, put everything into overall
  return { overall: text, details: '—' };
}

function ResumePreviewDialog({
  open,
  onOpenChange,
  userNames,
  experiences,
  onExport,
  isExporting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userNames: { ko: string; en: string; display: string };
  experiences: Experience[];
  onExport: () => void;
  isExporting: boolean;
}) {
  const workExperiences = experiences.filter((e) => e.type === 'work');
  const projectExperiences = experiences.filter((e) => e.type === 'project');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92%] max-h-[85vh] rounded-2xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            이력서 미리보기
          </DialogTitle>
          <DialogDescription>
            경력 & Selected Projects 기반 이력서
          </DialogDescription>
        </DialogHeader>

         <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-900 border-2 border-border rounded-lg p-6 shadow-inner min-h-[300px]">
           {/* Name Header */}
           <h1 className="text-2xl font-bold text-center text-foreground mb-6 border-b-2 border-foreground pb-2">
             {userNames.display || userNames.ko || userNames.en || '이름'}
           </h1>

          {/* Work Experience */}
          {workExperiences.length > 0 && (
            <section className="mb-6">
              <h2 className="text-lg font-bold text-foreground mb-3 border-b border-border pb-1">
                WORK EXPERIENCE
              </h2>
              <div className="space-y-4">
                {workExperiences.map((exp) => (
                  <div key={exp.id}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-foreground">{exp.title}</span>
                      {exp.company && (
                        <span className="text-muted-foreground">| {exp.company}</span>
                      )}
                    </div>
                    {exp.period && (
                      <p className="text-sm text-muted-foreground mb-1">{exp.period}</p>
                    )}
                    {exp.description && (
                      <p className="text-sm text-foreground mb-1">{exp.description}</p>
                    )}
                    {exp.bullets && exp.bullets.length > 0 && (
                      <ul className="text-sm space-y-0.5 ml-4">
                        {exp.bullets.filter((b) => b.trim()).map((bullet, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-primary">•</span>
                            <span className="text-foreground">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Projects */}
          {projectExperiences.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-foreground mb-3 border-b border-border pb-1">
                SELECTED PROJECTS
              </h2>
              <div className="space-y-4">
                {projectExperiences.map((exp) => (
                  <div key={exp.id}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-foreground">{exp.title}</span>
                      {exp.company && (
                        <span className="text-muted-foreground">| {exp.company}</span>
                      )}
                    </div>
                    {exp.period && (
                      <p className="text-sm text-muted-foreground mb-1">{exp.period}</p>
                    )}
                    {exp.description && (
                      <p className="text-sm text-foreground mb-1">{exp.description}</p>
                    )}
                    {exp.bullets && exp.bullets.length > 0 && (
                      <ul className="text-sm space-y-0.5 ml-4">
                        {exp.bullets.filter((b) => b.trim()).map((bullet, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-primary">•</span>
                            <span className="text-foreground">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {experiences.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              경력 또는 프로젝트를 추가하면 여기에 표시됩니다.
            </p>
          )}
        </div>

        <div className="flex gap-2 mt-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          <Button className="flex-1" onClick={onExport} disabled={isExporting || experiences.length === 0}>
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            DOCX 다운로드
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
