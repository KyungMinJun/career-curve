import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Loader2, Phone, Shield, ArrowLeft } from 'lucide-react';
import { usePhoneVerification } from '@/hooks/usePhoneVerification';

interface PhoneVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified?: () => void;
  triggerReason?: 'ai_evaluation' | 'resume_generation';
}

export function PhoneVerificationDialog({
  open,
  onOpenChange,
  onVerified,
  triggerReason,
}: PhoneVerificationDialogProps) {
  const { isVerifying, otpSent, sendOtp, verifyOtp, resetOtp } = usePhoneVerification();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  const triggerMessages = {
    ai_evaluation: 'AI 적합도 평가 기능',
    resume_generation: '맞춤 이력서 생성 기능',
  };

  const handleSendOtp = async () => {
    if (!phone.trim()) return;
    const success = await sendOtp(phone);
    if (success) {
      setOtp('');
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    const success = await verifyOtp(otp);
    if (success) {
      onVerified?.();
      onOpenChange(false);
      setPhone('');
      setOtp('');
    }
  };

  const handleBack = () => {
    resetOtp();
    setOtp('');
  };

  const handleClose = () => {
    onOpenChange(false);
    resetOtp();
    setPhone('');
    setOtp('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            전화번호 인증
          </DialogTitle>
          <DialogDescription className="text-left">
            {triggerReason && (
              <span className="text-primary font-medium">
                {triggerMessages[triggerReason]}
              </span>
            )}
            을 이용하시려면 전화번호 인증이 필요합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-secondary/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" />
            무료 정책 악용 방지 목적으로만 사용됩니다
          </p>
          <p>• 마케팅 목적으로 사용되지 않습니다</p>
          <p>• 동일 전화번호로 1계정만 인증 가능합니다</p>
        </div>

        {!otpSent ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">휴대폰 번호</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="01012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                disabled={isVerifying}
                maxLength={11}
              />
              <p className="text-xs text-muted-foreground">
                '-' 없이 숫자만 입력해주세요
              </p>
            </div>

            <Button
              className="w-full"
              onClick={handleSendOtp}
              disabled={isVerifying || phone.length < 10}
            >
              {isVerifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              인증번호 받기
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 -ml-2 text-muted-foreground"
              onClick={handleBack}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              전화번호 다시 입력
            </Button>

            <div className="space-y-2">
              <Label>인증번호 6자리</Label>
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                disabled={isVerifying}
              >
                <InputOTPGroup className="gap-2 justify-center w-full">
                  <InputOTPSlot index={0} className="w-10 h-12 text-lg" />
                  <InputOTPSlot index={1} className="w-10 h-12 text-lg" />
                  <InputOTPSlot index={2} className="w-10 h-12 text-lg" />
                  <InputOTPSlot index={3} className="w-10 h-12 text-lg" />
                  <InputOTPSlot index={4} className="w-10 h-12 text-lg" />
                  <InputOTPSlot index={5} className="w-10 h-12 text-lg" />
                </InputOTPGroup>
              </InputOTP>
              <p className="text-xs text-muted-foreground text-center">
                SMS로 전송된 인증번호를 입력해주세요
              </p>
            </div>

            <Button
              className="w-full"
              onClick={handleVerifyOtp}
              disabled={isVerifying || otp.length !== 6}
            >
              {isVerifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              인증 완료
            </Button>

            <Button
              variant="ghost"
              className="w-full text-sm text-muted-foreground"
              onClick={handleSendOtp}
              disabled={isVerifying}
            >
              인증번호 다시 받기
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
