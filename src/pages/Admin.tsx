import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Users, CreditCard, Shield, Search, Eye, Plus } from 'lucide-react';
import { UserDetailSheet } from '@/components/admin/UserDetailSheet';

interface UserWithSubscription {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  role: 'admin' | 'user';
  planId: string;
  planName: string;
  planDisplayName: string;
  aiCreditsRemaining: number;
  aiCreditsUsed: number;
  resumeCreditsRemaining: number;
  resumeCreditsUsed: number;
  jobLimit: number;
}

interface Plan {
  id: string;
  name: string;
  displayName: string;
  price: number;
  jobLimit: number;
  aiCredits: number;
  resumeCredits: number;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState('');
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!user) {
        navigate('/auth');
        return;
      }
      if (!isAdmin) {
        toast.error('접근 권한이 없습니다');
        navigate('/');
        return;
      }
      fetchData();
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  const fetchData = async () => {
    try {
      // Fetch plans
      const { data: plansData, error: plansError } = await supabase
        .from('plans')
        .select('*')
        .order('price', { ascending: true });

      if (plansError) throw plansError;
      setPlans((plansData || []).map(p => ({
        id: p.id,
        name: p.name,
        displayName: p.display_name,
        price: p.price,
        jobLimit: p.job_limit,
        aiCredits: p.ai_credits,
        resumeCredits: p.resume_credits,
      })));

      // Fetch user emails from edge function
      const { data: emailData, error: emailError } = await supabase.functions.invoke('admin-users');
      
      if (emailError) {
        console.error('Error fetching user emails:', emailError);
      }
      
      const userEmailMap: Record<string, string> = emailData?.userEmailMap || {};

      // Fetch users with subscriptions and roles - get ALL profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      // Get all user IDs for batch queries
      const userIds = (profilesData || []).map(p => p.user_id);

      // Batch fetch ALL subscriptions (1 query instead of N)
      const { data: allSubscriptions } = await supabase
        .from('user_subscriptions')
        .select(`
          user_id,
          *,
          plans (id, name, display_name, ai_credits, resume_credits, job_limit)
        `)
        .in('user_id', userIds);

      // Batch fetch ALL roles (1 query instead of N)
      const { data: allRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      // Map data in memory (fast O(N) operation)
      const usersWithDetails: UserWithSubscription[] = (profilesData || []).map(profile => {
        const subData = allSubscriptions?.find(s => s.user_id === profile.user_id);
        const roleData = allRoles?.find(r => r.user_id === profile.user_id);
        const plan = subData?.plans as any;

        return {
          id: profile.user_id,
          name: profile.name || '이름 없음',
          email: userEmailMap[profile.user_id] || 'N/A',
          createdAt: new Date(profile.created_at),
          role: (roleData?.role as 'admin' | 'user') || 'user',
          planId: subData?.plan_id || '',
          planName: plan?.name || 'free',
          planDisplayName: plan?.display_name || 'Free',
          aiCreditsRemaining: subData?.ai_credits_remaining || 0,
          aiCreditsUsed: subData?.ai_credits_used || 0,
          resumeCreditsRemaining: subData?.resume_credits_remaining || 0,
          resumeCreditsUsed: subData?.resume_credits_used || 0,
          jobLimit: plan?.job_limit || 5,
        };
      });

      setUsers(usersWithDetails);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error('데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlanChange = async (userId: string, newPlanId: string) => {
    try {
      const userSub = users.find(u => u.id === userId);
      if (!userSub) return;

      const oldPlanId = userSub.planId;
      const newPlan = plans.find(p => p.id === newPlanId);
      if (!newPlan) return;

      // Record plan change history first
      const { error: historyError } = await supabase
        .from('plan_change_history')
        .insert({
          user_id: userId,
          from_plan_id: oldPlanId || null,
          to_plan_id: newPlanId,
          changed_by: user?.id,
          ai_credits_at_change: userSub.aiCreditsRemaining,
          resume_credits_at_change: userSub.resumeCreditsRemaining,
        });

      if (historyError) {
        console.error('Error recording plan history:', historyError);
      }

      // Update subscription with new plan and reset credits
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          plan_id: newPlanId,
          ai_credits_remaining: newPlan.aiCredits,
          ai_credits_used: 0,
          resume_credits_remaining: newPlan.resumeCredits,
          resume_credits_used: 0,
          started_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success(`플랜이 ${newPlan.displayName}(으)로 변경되었습니다`);
      fetchData();
    } catch (error) {
      console.error('Error updating plan:', error);
      toast.error('플랜 변경 중 오류가 발생했습니다');
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('권한이 변경되었습니다');
      fetchData();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('권한 변경 중 오류가 발생했습니다');
    }
  };

  const handleAddCredits = async (userId: string, creditType: 'ai' | 'resume', amount: number) => {
    try {
      const userSub = users.find(u => u.id === userId);
      if (!userSub) return;

      const updateData = creditType === 'ai' 
        ? { ai_credits_remaining: userSub.aiCreditsRemaining + amount }
        : { resume_credits_remaining: userSub.resumeCreditsRemaining + amount };

      const { error } = await supabase
        .from('user_subscriptions')
        .update(updateData)
        .eq('user_id', userId);

      if (error) throw error;

      // Record credit grant
      await supabase
        .from('credit_usage_history')
        .insert({
          user_id: userId,
          credit_type: creditType,
          amount: amount,
          action: 'admin-grant',
          description: `관리자가 ${amount} 크레딧 지급`,
        });

      toast.success(`${creditType === 'ai' ? 'AI' : '이력서'} ${amount} 크레딧이 추가되었습니다`);
      fetchData();
    } catch (error) {
      console.error('Error adding credits:', error);
      toast.error('크레딧 추가 중 오류가 발생했습니다');
    }
  };

  const openUserDetail = (userId: string, userName: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setDetailSheetOpen(true);
  };

  if (authLoading || roleLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">사용자 및 구독 관리</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">총 사용자</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">유료 사용자</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.planName !== 'free').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">관리자</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.role === 'admin').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle>사용자 관리</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="이름 또는 이메일 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>사용자</TableHead>
                  <TableHead>가입일</TableHead>
                  <TableHead>권한</TableHead>
                  <TableHead>플랜</TableHead>
                  <TableHead>AI 크레딧</TableHead>
                  <TableHead>이력서 크레딧</TableHead>
                  <TableHead>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users
                  .filter(u => {
                    if (!searchQuery.trim()) return true;
                    const query = searchQuery.toLowerCase();
                    return (
                      u.name.toLowerCase().includes(query) ||
                      u.email.toLowerCase().includes(query)
                    );
                  })
                  .map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{u.name}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>{u.createdAt.toLocaleDateString('ko-KR')}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(value) => handleRoleChange(u.id, value as 'admin' | 'user')}
                        disabled={u.id === user?.id}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.planId}
                        onValueChange={(value) => handlePlanChange(u.id, value)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue placeholder={u.planDisplayName} />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {u.aiCreditsRemaining} / {u.aiCreditsUsed + u.aiCreditsRemaining}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleAddCredits(u.id, 'ai', 10)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {u.resumeCreditsRemaining} / {u.resumeCreditsUsed + u.resumeCreditsRemaining}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleAddCredits(u.id, 'resume', 5)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUserDetail(u.id, u.name)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        상세
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Plans Table */}
        <Card>
          <CardHeader>
            <CardTitle>플랜 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>플랜명</TableHead>
                  <TableHead>가격</TableHead>
                  <TableHead>공고 제한</TableHead>
                  <TableHead>AI 크레딧</TableHead>
                  <TableHead>이력서 크레딧</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.displayName}</TableCell>
                    <TableCell>
                      {p.price === 0 ? '무료' : `₩${p.price.toLocaleString()} / 월`}
                    </TableCell>
                    <TableCell>
                      {p.jobLimit >= 999999 ? '무제한' : `${p.jobLimit}개`}
                    </TableCell>
                    <TableCell>{p.aiCredits}회</TableCell>
                    <TableCell>{p.resumeCredits}회</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* User Detail Sheet */}
      <UserDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        userId={selectedUserId}
        userName={selectedUserName}
      />
    </div>
  );
}
