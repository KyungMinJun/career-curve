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
import { ArrowLeft, Users, CreditCard, Shield, Search } from 'lucide-react';

interface UserWithSubscription {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  role: 'admin' | 'user';
  planName: string;
  planDisplayName: string;
  aiCreditsRemaining: number;
  aiCreditsUsed: number;
  totalCreditsGranted: number;
}

interface Plan {
  id: string;
  name: string;
  displayName: string;
  price: number;
  jobLimit: number;
  aiCredits: number;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
      
      console.log('Fetched profiles count:', profilesData?.length || 0);

      const usersWithDetails: UserWithSubscription[] = [];

      for (const profile of profilesData || []) {
        // Get subscription with plan details
        const { data: subData } = await supabase
          .from('user_subscriptions')
          .select(`
            *,
            plans (name, display_name, ai_credits)
          `)
          .eq('user_id', profile.user_id)
          .maybeSingle();

        // Get role
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.user_id)
          .maybeSingle();

        // Calculate total credits granted (plan credits + remaining - used + used = plan credits + any bonus)
        const planCredits = (subData?.plans as any)?.ai_credits || 0;
        const remaining = subData?.ai_credits_remaining || 0;
        const used = subData?.ai_credits_used || 0;
        // Total granted = used + remaining (this represents what they've been given in total)
        const totalGranted = used + remaining;

        usersWithDetails.push({
          id: profile.user_id,
          name: profile.name || '이름 없음',
          email: userEmailMap[profile.user_id] || 'N/A',
          createdAt: new Date(profile.created_at),
          role: (roleData?.role as 'admin' | 'user') || 'user',
          planName: (subData?.plans as any)?.name || 'free',
          planDisplayName: (subData?.plans as any)?.display_name || 'Free',
          aiCreditsRemaining: remaining,
          aiCreditsUsed: used,
          totalCreditsGranted: totalGranted,
        });
      }

      setUsers(usersWithDetails);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error('데이터를 불러오는 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlanChange = async (userId: string, planId: string) => {
    try {
      const plan = plans.find(p => p.id === planId);
      if (!plan) return;

      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          plan_id: planId,
          ai_credits_remaining: plan.aiCredits,
          ai_credits_used: 0,
          started_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('플랜이 변경되었습니다');
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

  const handleAddCredits = async (userId: string, amount: number) => {
    try {
      const userSub = users.find(u => u.id === userId);
      if (!userSub) return;

      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          ai_credits_remaining: userSub.aiCreditsRemaining + amount,
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast.success(`${amount} 크레딧이 추가되었습니다`);
      fetchData();
    } catch (error) {
      console.error('Error adding credits:', error);
      toast.error('크레딧 추가 중 오류가 발생했습니다');
    }
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
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>사용자</TableHead>
                  <TableHead>가입일</TableHead>
                  <TableHead>권한</TableHead>
                  <TableHead>플랜</TableHead>
                  <TableHead>크레딧 (사용/부여)</TableHead>
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
                        value={plans.find(p => p.name === u.planName)?.id || ''}
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
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline">
                          {u.aiCreditsUsed} / {u.totalCreditsGranted}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          잔여: {u.aiCreditsRemaining}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddCredits(u.id, 100)}
                      >
                        +100 크레딧
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
                    <TableCell>{p.aiCredits}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
