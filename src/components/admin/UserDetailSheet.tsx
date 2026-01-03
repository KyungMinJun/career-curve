import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { History, CreditCard, FileText, BarChart3 } from 'lucide-react';

interface UserDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string;
}

interface PlanChangeRecord {
  id: string;
  fromPlanName: string | null;
  toPlanName: string;
  changedByName: string;
  aiCreditsAtChange: number;
  resumeCreditsAtChange: number;
  createdAt: Date;
}

interface CreditUsageRecord {
  id: string;
  creditType: 'ai' | 'resume';
  amount: number;
  action: string;
  description: string | null;
  createdAt: Date;
}

interface UserStats {
  totalJobPostings: number;
  totalFitEvaluations: number;
  totalResumesGenerated: number;
}

export function UserDetailSheet({ open, onOpenChange, userId, userName }: UserDetailSheetProps) {
  const [planHistory, setPlanHistory] = useState<PlanChangeRecord[]>([]);
  const [creditHistory, setCreditHistory] = useState<CreditUsageRecord[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && userId) {
      fetchUserDetails();
    }
  }, [open, userId]);

  const fetchUserDetails = async () => {
    if (!userId) return;
    setIsLoading(true);

    try {
      // Fetch plan change history
      const { data: planData, error: planError } = await supabase
        .from('plan_change_history')
        .select(`
          id,
          from_plan_id,
          to_plan_id,
          changed_by,
          ai_credits_at_change,
          resume_credits_at_change,
          created_at
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (planError) throw planError;

      // Get plan names and changer names
      const planIds = new Set<string>();
      const userIds = new Set<string>();
      
      planData?.forEach(record => {
        if (record.from_plan_id) planIds.add(record.from_plan_id);
        planIds.add(record.to_plan_id);
        userIds.add(record.changed_by);
      });

      const { data: plansData } = await supabase
        .from('plans')
        .select('id, display_name')
        .in('id', Array.from(planIds));

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', Array.from(userIds));

      const planMap = new Map(plansData?.map(p => [p.id, p.display_name]) || []);
      const profileMap = new Map(profilesData?.map(p => [p.user_id, p.name]) || []);

      setPlanHistory((planData || []).map(record => ({
        id: record.id,
        fromPlanName: record.from_plan_id ? planMap.get(record.from_plan_id) || '알 수 없음' : null,
        toPlanName: planMap.get(record.to_plan_id) || '알 수 없음',
        changedByName: profileMap.get(record.changed_by) || '관리자',
        aiCreditsAtChange: record.ai_credits_at_change,
        resumeCreditsAtChange: record.resume_credits_at_change,
        createdAt: new Date(record.created_at),
      })));

      // Fetch credit usage history
      const { data: creditData, error: creditError } = await supabase
        .from('credit_usage_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (creditError) throw creditError;

      setCreditHistory((creditData || []).map(record => ({
        id: record.id,
        creditType: record.credit_type as 'ai' | 'resume',
        amount: record.amount,
        action: record.action,
        description: record.description,
        createdAt: new Date(record.created_at),
      })));

      // Fetch user stats
      const { count: jobCount } = await supabase
        .from('job_postings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { count: fitCount } = await supabase
        .from('job_postings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('fit_score', 'is', null);

      const { count: resumeCount } = await supabase
        .from('tailored_resumes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      setStats({
        totalJobPostings: jobCount || 0,
        totalFitEvaluations: fitCount || 0,
        totalResumesGenerated: resumeCount || 0,
      });
    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'analyze-job': '공고 분석',
      'evaluate-fit': '적합도 평가',
      'generate-resume': '이력서 생성',
      'admin-grant': '관리자 지급',
      'plan-change': '플랜 변경',
    };
    return labels[action] || action;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{userName} 상세 정보</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-muted-foreground">로딩 중...</div>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold">{stats.totalJobPostings}</div>
                    <div className="text-xs text-muted-foreground">저장 공고</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold">{stats.totalFitEvaluations}</div>
                    <div className="text-xs text-muted-foreground">적합도 평가</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold">{stats.totalResumesGenerated}</div>
                    <div className="text-xs text-muted-foreground">이력서 생성</div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Tabs defaultValue="plan" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="plan" className="gap-2">
                  <History className="h-4 w-4" />
                  플랜 변경
                </TabsTrigger>
                <TabsTrigger value="credit" className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  크레딧 사용
                </TabsTrigger>
              </TabsList>

              <TabsContent value="plan" className="mt-4">
                {planHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    플랜 변경 내역이 없습니다
                  </div>
                ) : (
                  <div className="space-y-3">
                    {planHistory.map(record => (
                      <Card key={record.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {record.fromPlanName && (
                                <>
                                  <Badge variant="outline">{record.fromPlanName}</Badge>
                                  <span className="text-muted-foreground">→</span>
                                </>
                              )}
                              <Badge>{record.toPlanName}</Badge>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground space-y-1">
                            <div>변경자: {record.changedByName}</div>
                            <div>변경 시점 크레딧: AI {record.aiCreditsAtChange}, 이력서 {record.resumeCreditsAtChange}</div>
                            <div>{format(record.createdAt, 'yyyy.MM.dd HH:mm', { locale: ko })}</div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="credit" className="mt-4">
                {creditHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    크레딧 사용 내역이 없습니다
                  </div>
                ) : (
                  <div className="space-y-2">
                    {creditHistory.map(record => (
                      <Card key={record.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant={record.creditType === 'ai' ? 'default' : 'secondary'}>
                                {record.creditType === 'ai' ? 'AI' : '이력서'}
                              </Badge>
                              <span className="text-sm">{getActionLabel(record.action)}</span>
                            </div>
                            <span className={`font-medium ${record.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {record.amount > 0 ? '+' : ''}{record.amount}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {format(record.createdAt, 'yyyy.MM.dd HH:mm', { locale: ko })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
