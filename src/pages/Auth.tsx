import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const emailSchema = z.string().email('올바른 이메일 형식이 아닙니다');
const passwordSchema = z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다');
const nameSchema = z.string().min(2, '이름은 최소 2자 이상이어야 합니다');

export default function Auth() {
  const navigate = useNavigate();
  const { user, isLoading, signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    termsAgreed: false,
    privacyAgreed: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if already logged in
  useEffect(() => {
    if (user && !isLoading) {
      navigate('/');
    }
  }, [user, isLoading, navigate]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

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

  const handleSubmit = async (e: React.FormEvent) => {
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

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast.error('Google 로그인에 실패했습니다');
      setIsSubmitting(false);
    }
    // OAuth redirects, so we don't need to handle success here
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

        <form onSubmit={handleSubmit} className="space-y-4">
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
                  <span className="text-primary font-medium">이용약관</span>에 동의합니다 (필수)
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
                  <span className="text-primary font-medium">개인정보처리방침</span>에 동의합니다 (필수)
                </label>
              </div>
              {errors.privacyAgreed && <p className="text-xs text-destructive ml-6">{errors.privacyAgreed}</p>}

              <p className="text-xs text-muted-foreground pt-1">
                수집 항목: 이메일, 비밀번호, 이름 (개인정보보호법 제30조 준수)
              </p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {mode === 'login' ? '로그인' : '회원가입'}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">또는</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google로 {mode === 'login' ? '로그인' : '시작하기'}
        </Button>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setErrors({});
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
