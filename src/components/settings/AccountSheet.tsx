import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, KeyRound, UserCog, UserX, ChevronRight } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { ProfileEditSheet } from './ProfileEditSheet';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface AccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountSheet({ open, onOpenChange }: AccountSheetProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);

  const userEmail = useMemo(() => user?.email ?? null, [user]);

  const handleLogout = async () => {
    await signOut();

    // 로그아웃 시 데이터를 삭제하지 않음 - 유저별 storageKey로 저장되어 있으므로
    // 다른 유저로 로그인하면 해당 유저의 데이터가 로드됨

    toast.success('로그아웃되었습니다');
    onOpenChange(false);

    // Navigate to auth page
    navigate('/auth', { replace: true });
  };

  const handleSendPasswordReset = async () => {
    if (!userEmail) {
      toast.info('로그인 후 사용 가능합니다');
      return;
    }

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, { redirectTo });
      if (error) throw error;
      toast.success('재설정 링크를 이메일로 보냈습니다');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '재설정 링크 발송에 실패했습니다');
    }
  };

  const menuItems = [
    {
      icon: UserCog,
      label: '개인 정보 변경',
      description: '이름, 연락처 등 수정',
      onClick: () => setShowProfileEdit(true),
    },
    {
      icon: KeyRound,
      label: user ? '비밀번호 변경' : '비밀번호 찾기',
      description: '이메일로 재설정 링크 발송',
      onClick: handleSendPasswordReset,
    },
    {
      icon: LogOut,
      label: user ? '로그아웃' : '로그인',
      description: user ? '현재 계정에서 로그아웃' : '계정에 로그인하세요',
      onClick: () => {
        if (user) {
          handleLogout();
        } else {
          onOpenChange(false);
          navigate('/auth', { replace: true });
        }
      },
    },
    {
      icon: UserX,
      label: '회원 탈퇴',
      description: '계정 및 모든 데이터 삭제',
      onClick: () => setShowDeleteDialog(true),
      danger: true,
    },
  ];

  const handleDeleteAccount = async () => {
    try {
      if (!user) {
        toast.error('로그인이 필요합니다');
        return;
      }

      // Call backend function to delete account
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) {
        console.error('Delete account error:', error);
        throw new Error(error.message);
      }

      // 1) Sign out (token/session may be stale after deletion)
      await supabase.auth.signOut();

      // 2) Clear all per-user persisted data keys
      try {
        const keys = Object.keys(localStorage);
        keys
          .filter((k) => k === 'jobflow-storage' || k.startsWith('jobflow-storage'))
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        // ignore
      }

      toast.success('계정이 삭제되었습니다');
      setShowDeleteDialog(false);
      onOpenChange(false);

      // Force a clean app state
      navigate('/auth', { replace: true });
      setTimeout(() => window.location.reload(), 50);
    } catch (error) {
      console.error('Error during account deletion:', error);
      toast.error(error instanceof Error ? error.message : '계정 삭제에 실패했습니다');
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-md mx-auto">
          <SheetHeader className="text-left pb-4">
            <SheetTitle>계정</SheetTitle>
          </SheetHeader>

          <div className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="flex items-center justify-between w-full px-3 py-3 rounded-lg hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <item.icon
                    className={`w-5 h-5 ${
                      item.danger ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  />
                  <div className="text-left">
                    <p
                      className={`text-sm font-medium ${
                        item.danger ? 'text-destructive' : 'text-foreground'
                      }`}
                    >
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 탈퇴하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              모든 데이터(이력서, 채용공고, 목표 등)가 영구적으로 삭제됩니다.
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              탈퇴하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProfileEditSheet open={showProfileEdit} onOpenChange={setShowProfileEdit} />
    </>
  );
}

