import { useState } from 'react';
import { Target, Calendar, Edit2, History, ChevronDown, ChevronUp } from 'lucide-react';
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
import { CareerGoal } from '@/types/job';

function toDateInputValue(date: Date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatKoreanDate(date: Date) {
  return new Date(date).toLocaleDateString('ko-KR');
}

function createBlankGoal(): CareerGoal {
  const now = new Date();
  return {
    id: Date.now().toString(),
    type: 'immediate',
    reason: '',
    searchPeriod: '3개월',
    companyEvalCriteria: [
      { name: '성장 가능성', weight: 5 },
      { name: '기술 스택', weight: 4 },
      { name: '보상', weight: 4 },
      { name: '워라밸', weight: 3 },
      { name: '회사 문화', weight: 4 },
    ],
    startDate: now,
    endDate: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function GoalsTab() {
  const { currentGoal, setGoal, goalHistory, archiveGoal } = useJobStore();
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const startDate = currentGoal?.startDate ? new Date(currentGoal.startDate) : null;
  const daysSinceStart = startDate
    ? Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 pt-safe-top pb-4 bg-background safe-top">
        <h1 className="text-xl font-bold text-foreground">이직 목표</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          목표를 정하고 기록하세요
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-4 scrollbar-hide">
        {/* Current Goal Card */}
        <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-foreground">현재 목표</h2>
              </div>
              <Badge variant="secondary" className="text-xs">
                {daysSinceStart}일째
              </Badge>
            </div>
          </div>

          {currentGoal && (
            <div className="p-4 space-y-4">
              {/* Search Period */}
              <div className="flex items-center gap-2 bg-primary/10 rounded-lg p-3">
                <Calendar className="w-4 h-4 text-primary" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">현재 목표 기간</p>
                  <p className="text-sm font-medium text-foreground">
                    {formatKoreanDate(currentGoal.startDate)}부터
                    {currentGoal.endDate ? ` · ${formatKoreanDate(currentGoal.endDate)}까지` : ''}
                  </p>
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">이직 이유</p>
                <p className="text-sm text-foreground">{currentGoal.reason || '아직 입력되지 않았습니다'}</p>
                {currentGoal.careerPath && (
                  <p className="text-xs text-primary">{currentGoal.careerPath}</p>
                )}
              </div>

              {/* Company Eval Criteria - Priority Order */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  회사 평가 기준 (우선순위)
                </p>
                <div className="space-y-1.5">
                  {[...currentGoal.companyEvalCriteria]
                    .sort((a, b) => b.weight - a.weight)
                    .map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="flex-1 text-foreground">{c.name}</span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <div
                              key={n}
                              className={cn(
                                'w-2 h-2 rounded-full',
                                n <= c.weight ? 'bg-primary' : 'bg-muted'
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setIsEditingGoals(true)}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  목표 수정
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    // 새 목표 시작 = 현재 목표를 이전 기록으로 보내고 새로 시작
                    if (currentGoal.reason.trim() || currentGoal.careerPath?.trim()) {
                      archiveGoal({ ...currentGoal, endDate: currentGoal.endDate ?? new Date(), updatedAt: new Date() });
                    }
                    setGoal(createBlankGoal());
                    setIsEditingGoals(true);
                  }}
                >
                  <Target className="w-4 h-4 mr-2" />
                  새 목표 시작
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Goal History */}
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <div className="bg-card rounded-xl border border-border card-shadow overflow-hidden">
            <CollapsibleTrigger className="w-full flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">이전 기록</h2>
                <Badge variant="secondary" className="text-xs">
                  {goalHistory.length}
                </Badge>
              </div>
              {historyOpen ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-3">
                {goalHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    아직 기록이 없습니다
                  </p>
                ) : (
                  goalHistory.map((record) => (
                    <div
                      key={record.id}
                      className="bg-secondary/30 rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">
                          {record.goal.reason}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {record.archivedAt.toLocaleDateString('ko-KR')}
                        </Badge>
                      </div>
                      {record.goal.careerPath && (
                        <p className="text-xs text-muted-foreground">
                          {record.goal.careerPath}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </div>

      {/* Goals Edit Dialog */}
      {currentGoal && (
        <GoalsEditDialog
          open={isEditingGoals}
          onOpenChange={setIsEditingGoals}
          goal={currentGoal}
          onSave={(newGoal) => {
            // 종료일이 입력되면 자동으로 "이전 기록"으로 이동 + 새 목표 생성
            if (newGoal.endDate) {
              archiveGoal(newGoal);
              setGoal(createBlankGoal());
              setHistoryOpen(true);
              setIsEditingGoals(false);
              return;
            }

            setGoal(newGoal);
          }}
        />
      )}
    </div>
  );
}

interface GoalsEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: CareerGoal;
  onSave: (goal: CareerGoal) => void;
}

function GoalsEditDialog({ open, onOpenChange, goal, onSave }: GoalsEditDialogProps) {
  const [formData, setFormData] = useState({
    reason: goal.reason,
    careerPath: goal.careerPath || '',
    searchPeriod: goal.searchPeriod || '',
    companyEvalCriteria: [...goal.companyEvalCriteria],
    startDate: toDateInputValue(goal.startDate),
    endDate: goal.endDate ? toDateInputValue(goal.endDate) : '',
  });

  const updateCriteriaWeight = (index: number, weight: number) => {
    const updated = [...formData.companyEvalCriteria];
    updated[index] = { ...updated[index], weight };
    setFormData({ ...formData, companyEvalCriteria: updated });
  };

  const updateCriteriaName = (index: number, name: string) => {
    const updated = [...formData.companyEvalCriteria];
    updated[index] = { ...updated[index], name };
    setFormData({ ...formData, companyEvalCriteria: updated });
  };

  const handleSave = () => {
    const startDate = formData.startDate ? new Date(formData.startDate) : new Date();
    const endDate = formData.endDate ? new Date(formData.endDate) : undefined;

    onSave({
      ...goal,
      reason: formData.reason,
      careerPath: formData.careerPath || undefined,
      searchPeriod: formData.searchPeriod || undefined,
      companyEvalCriteria: formData.companyEvalCriteria,
      startDate,
      endDate,
      updatedAt: new Date(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90%] max-h-[80vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>이직 목표 수정</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>현재 목표 기간</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">시작일</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">종료일(입력 시 이전 기록으로 이동)</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>이직 탐색 기간(선택)</Label>
            <Select
              value={formData.searchPeriod}
              onValueChange={(v) => setFormData({ ...formData, searchPeriod: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="기간 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1개월">1개월</SelectItem>
                <SelectItem value="3개월">3개월</SelectItem>
                <SelectItem value="6개월">6개월</SelectItem>
                <SelectItem value="1년">1년</SelectItem>
                <SelectItem value="상시">상시</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">이직 이유</Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="careerPath">커리어 패스</Label>
            <Input
              id="careerPath"
              value={formData.careerPath}
              onChange={(e) => setFormData({ ...formData, careerPath: e.target.value })}
              placeholder="예: 시니어 엔지니어 → 테크 리드"
            />
          </div>

          {/* Company Eval Criteria */}
          <div className="space-y-3">
            <Label>회사 평가 기준 (가중치 클릭으로 조절)</Label>
            {formData.companyEvalCriteria.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={c.name}
                  onChange={(e) => updateCriteriaName(i, e.target.value)}
                  className="flex-1 h-9"
                />
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => updateCriteriaWeight(i, n)}
                      className={cn(
                        'w-6 h-6 rounded-full transition-colors',
                        n <= c.weight
                          ? 'bg-primary'
                          : 'bg-muted hover:bg-muted-foreground/20'
                      )}
                    />
                  ))}
                </div>
              </div>
            ))}
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
