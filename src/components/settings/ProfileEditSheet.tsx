import { useState } from 'react';
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
import { toast } from 'sonner';

interface ProfileEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileEditSheet({ open, onOpenChange }: ProfileEditSheetProps) {
  const { userName, setUserName } = useJobStore();
  const [name, setName] = useState(userName);

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
              disabled
              placeholder="로그인 후 표시됩니다"
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              이메일은 로그인 후 변경할 수 있습니다
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
