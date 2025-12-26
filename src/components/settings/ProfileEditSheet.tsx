import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useJobStore } from '@/stores/jobStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProfileEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileEditSheet({ open, onOpenChange }: ProfileEditSheetProps) {
  const { userName, setUserName } = useJobStore();
  const [name, setName] = useState(userName);
  const [email, setEmail] = useState('');

  useEffect(() => {
    // Fetch current user email when sheet opens
    if (open) {
      supabase.auth.getUser().then(({ data }) => {
        setEmail(data.user?.email || '');
      });
    }
  }, [open]);

  const handleSave = () => {
    if (name.trim()) {
      setUserName(name.trim());
      toast.success('개인정보가 저장되었습니다');
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-w-md mx-auto h-[70vh]">
        <SheetHeader className="text-left pb-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => onOpenChange(false)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <SheetTitle>개인정보 변경</SheetTitle>
          </div>
        </SheetHeader>

        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="userName">이름</Label>
            <Input
              id="userName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="userEmail">이메일</Label>
            <Input
              id="userEmail"
              type="email"
              value={email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              이메일은 계정 설정에서 변경할 수 없습니다
            </p>
          </div>

          <Button className="w-full" onClick={handleSave}>
            저장
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
