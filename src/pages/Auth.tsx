import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Phone, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const emailSchema = z.string().email('올바른 이메일 형식이 아닙니다');
const passwordSchema = z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다');
const nameSchema = z.string().min(2, '이름은 최소 2자 이상이어야 합니다');
const phoneSchema = z.string().regex(/^01[0-9]{8,9}$/, '올바른 전화번호 형식이 아닙니다 (예: 01012345678)');

export default function Auth() {
  const navigate = useNavigate();
  const { user, isLoading, signIn, signUp, signInWithPhone, verifyOtp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('phone');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    termsAgreed: false,
    privacyAgreed: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const emailValid = useMemo(() => emailSchema.safeParse(formData.email).success, [formData.email]);
  const phoneValid = useMemo(() => phoneSchema.safeParse(formData.phone).success, [formData.phone]);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !isLoading) {
      navigate('/');
    }
  }, [user, isLoading, navigate]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (authMethod === 'email') {
      const emailResult = emailSchema.safeParse(formData.email);
      if (!emailResult.success) {
        newErrors.email = emailResult.error.errors[0].message;
      }

      const passwordResult = passwordSchema.safeParse(formData.password);
      if (!passwordResult.success) {
        newErrors.password = passwordResult.error.errors[0].message;
      }

      if (mode === 'signup') {
        const nameResult = nameSchema.safeParse(formData.name);
        if (!nameResult.success) {
          newErrors.name = nameResult.error.errors[0].message;
        }
      }
    } else {
      const phoneResult = phoneSchema.safeParse(formData.phone);
      if (!phoneResult.success) {
        newErrors.phone = phoneResult.error.errors[0].message;
      }
    }

    if (mode === 'signup') {
      if (!formData.termsAgreed) {
        newErrors.termsAgreed = '이용약관에 동의해주세요';
      }
      if (!formData.privacyAgreed) {
        newErrors.privacyAgreed = '개인정보처리방침에 동의해주세요';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePhoneSubmit = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      const formattedPhone = '+82' + formData.phone.slice(1);
      const { error } = await signInWithPhone(formattedPhone);
      if (error) {
        const msg = error.message || '인증번호 발송에 실패했습니다';
        if (msg.toLowerCase().includes('sms provider') || msg.toLowerCase().includes('unable to get sms provider')) {
          toast.error('현재 SMS(문자) 인증 발송 설정이 되어있지 않습니다. 잠시 후 다시 시도하거나 이메일 로그인을 사용해주세요.');
        } else {
          toast.error(msg);
        }
      } else {
        setOtpSent(true);
        toast.success('인증번호가 발송되었습니다');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpVerify = async () => {
    if (otpCode.length !== 6) {
      toast.error('6자리 인증번호를 입력해주세요');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedPhone = '+82' + formData.phone.slice(1);
      const { error } = await verifyOtp(formattedPhone, otpCode);
      if (error) {
        toast.error(error.message || '인증에 실패했습니다');
      } else {
        toast.success('로그인되었습니다');
        navigate('/');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('이메일 또는 비밀번호가 올바르지 않습니다');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('로그인되었습니다');
          navigate('/');
        }
      } else {
        const { error } = await signUp(formData.email, formData.password, formData.name);
        if (error) {
          if (error.message.includes('User already registered')) {
            toast.error('이미 가입된 이메일입니다');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('회원가입이 완료되었습니다');
          navigate('/');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!emailValid) {
      toast.error('비밀번호 재설정 링크를 받을 이메일을 입력해주세요');
      return;
    }

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, { redirectTo });
      if (error) throw error;
      toast.success('재설정 링크를 이메일로 보냈습니다');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '재설정 링크 발송에 실패했습니다');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background px-4 py-8 safe-top">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {mode === 'login' ? '로그인' : '회원가입'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'login'
              ? '계정에 로그인하여 이직 여정을 이어가세요'
              : '커브와 함께 체계적인 이직 준비를 시작하세요'}
          </p>
        </div>

        {/* Auth Method Toggle */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={authMethod === 'phone' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => { setAuthMethod('phone'); setOtpSent(false); setOtpCode(''); }}
          >
            <Phone className="w-4 h-4 mr-2" />
            전화번호
          </Button>
          <Button
            variant={authMethod === 'email' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setAuthMethod('email')}
          >
            <Mail className="w-4 h-4 mr-2" />
            이메일
          </Button>
        </div>

        {authMethod === 'phone' ? (
          <div className="space-y-4">
            {!otpSent ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">전화번호</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                    placeholder="01012345678"
                    disabled={isSubmitting}
                    maxLength={11}
                  />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                </div>

                {mode === 'signup' && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="terms"
                        checked={formData.termsAgreed}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, termsAgreed: checked as boolean })
                        }
                        disabled={isSubmitting}
                      />
                      <label htmlFor="terms" className="text-sm text-muted-foreground leading-tight">
                        <Link to="/terms" className="text-primary font-medium hover:underline">이용약관</Link>에 동의합니다 (필수)
                      </label>
                    </div>
                    {errors.termsAgreed && <p className="text-xs text-destructive ml-6">{errors.termsAgreed}</p>}

                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="privacy"
                        checked={formData.privacyAgreed}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, privacyAgreed: checked as boolean })
                        }
                        disabled={isSubmitting}
                      />
                      <label htmlFor="privacy" className="text-sm text-muted-foreground leading-tight">
                        <Link to="/privacy" className="text-primary font-medium hover:underline">개인정보처리방침</Link>에 동의합니다 (필수)
                      </label>
                    </div>
                    {errors.privacyAgreed && <p className="text-xs text-destructive ml-6">{errors.privacyAgreed}</p>}

                    <p className="text-xs text-muted-foreground pt-1">
                      수집 항목: 전화번호 (개인정보보호법 제30조 준수)
                    </p>
                  </div>
                )}

                <Button 
                  className="w-full" 
                  onClick={handlePhoneSubmit} 
                  disabled={isSubmitting || !phoneValid}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  인증번호 받기
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>인증번호 (6자리)</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otpCode}
                      onChange={setOtpCode}
                      disabled={isSubmitting}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {formData.phone}로 발송된 인증번호를 입력하세요
                  </p>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleOtpVerify} 
                  disabled={isSubmitting || otpCode.length !== 6}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  인증 확인
                </Button>

                <Button 
                  variant="ghost" 
                  className="w-full" 
                  onClick={() => { setOtpSent(false); setOtpCode(''); }}
                >
                  다시 보내기
                </Button>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="name">이름</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="홍길동"
                  disabled={isSubmitting}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
                disabled={isSubmitting}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="6자 이상 입력"
                disabled={isSubmitting}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
            </div>

            {mode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-primary hover:underline"
                  disabled={isSubmitting}
                >
                  비밀번호 찾기
                </button>
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="termsEmail"
                    checked={formData.termsAgreed}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, termsAgreed: checked as boolean })
                    }
                    disabled={isSubmitting}
                  />
                  <label htmlFor="termsEmail" className="text-sm text-muted-foreground leading-tight">
                    <Link to="/terms" className="text-primary font-medium hover:underline">이용약관</Link>에 동의합니다 (필수)
                  </label>
                </div>
                {errors.termsAgreed && <p className="text-xs text-destructive ml-6">{errors.termsAgreed}</p>}

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="privacyEmail"
                    checked={formData.privacyAgreed}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, privacyAgreed: checked as boolean })
                    }
                    disabled={isSubmitting}
                  />
                  <label htmlFor="privacyEmail" className="text-sm text-muted-foreground leading-tight">
                    <Link to="/privacy" className="text-primary font-medium hover:underline">개인정보처리방침</Link>에 동의합니다 (필수)
                  </label>
                </div>
                {errors.privacyAgreed && <p className="text-xs text-destructive ml-6">{errors.privacyAgreed}</p>}

                <p className="text-xs text-muted-foreground pt-1">
                  수집 항목: 이메일, 비밀번호, 이름 (개인정보보호법 제30조 준수)
                </p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {mode === 'login' ? '로그인' : '회원가입'}
            </Button>
          </form>
        )}

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setErrors({});
              setOtpSent(false);
              setOtpCode('');
            }}
            className="text-sm text-primary hover:underline"
            disabled={isSubmitting}
          >
            {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </div>
      </div>
    </div>
  );
}
