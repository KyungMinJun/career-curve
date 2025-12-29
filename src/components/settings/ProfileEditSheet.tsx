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
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProfileEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileEditSheet({ open, onOpenChange }: ProfileEditSheetProps) {
  const { user } = useAuth();
  const [nameKo, setNameKo] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fetch current profile when sheet opens
    if (open && user) {
      setIsLoading(true);
      Promise.all([
        supabase.auth.getUser(),
        supabase.from('profiles').select('name_ko, name_en').eq('user_id', user.id).maybeSingle()
      ]).then(([authResult, profileResult]) => {
        setEmail(authResult.data.user?.email || '');
        if (profileResult.data) {
          setNameKo(profileResult.data.name_ko || '');
          setNameEn(profileResult.data.name_en || '');
        }
        setIsLoading(false);
      });
    }
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;
    
    if (!nameKo.trim() && !nameEn.trim()) {
      toast.error('최소 하나의 이름을 입력해주세요');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          name_ko: nameKo.trim() || null, 
          name_en: nameEn.trim() || null,
          name: nameKo.trim() || nameEn.trim() // Keep name field for backward compatibility
        })
        .eq('user_id', user.id);

      if (error) throw error;
      
      toast.success('개인정보가 저장되었습니다');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('저장 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-w-md mx-auto h-[80vh]">
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
            <Label htmlFor="nameKo">이름 (국문)</Label>
            <Input
              id="nameKo"
              value={nameKo}
              onChange={(e) => setNameKo(e.target.value)}
              placeholder="홍길동"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              국문 공고에 사용됩니다
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nameEn">이름 (영문)</Label>
            <Input
              id="nameEn"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="Gildong Hong"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              영문 공고에 사용됩니다
            </p>
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

          <Button className="w-full" onClick={handleSave} disabled={isLoading}>
            {isLoading ? '저장 중...' : '저장'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
