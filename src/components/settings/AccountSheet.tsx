import { useState } from 'react';
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
import { useJobStore } from '@/stores/jobStore';
import { toast } from 'sonner';

interface AccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountSheet({ open, onOpenChange }: AccountSheetProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { userName, setUserName } = useJobStore();

  const menuItems = [
    {
      icon: UserCog,
      label: '개인 정보 변경',
      description: '이름, 연락처 등 수정',
      onClick: () => {
        const newName = prompt('새 이름을 입력하세요', userName);
        if (newName !== null && newName.trim()) {
          setUserName(newName.trim());
          toast.success('이름이 변경되었습니다');
        }
      },
    },
    {
      icon: KeyRound,
      label: '비밀번호 찾기',
      description: '이메일로 재설정 링크 발송',
      onClick: () => {
        toast.info('로그인 기능 구현 후 사용 가능합니다');
      },
    },
    {
      icon: LogOut,
      label: '로그아웃',
      description: '현재 계정에서 로그아웃',
      onClick: () => {
        toast.info('로그인 기능 구현 후 사용 가능합니다');
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

  const handleDeleteAccount = () => {
    // Clear all data from localStorage
    localStorage.removeItem('job-store');
    toast.success('모든 데이터가 삭제되었습니다');
    setShowDeleteDialog(false);
    onOpenChange(false);
    // Reload to reset state
    window.location.reload();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl">
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
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
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
    </>
  );
}
