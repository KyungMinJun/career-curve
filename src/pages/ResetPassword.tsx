import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const passwordSchema = z.string().min(6, "비밀번호는 최소 6자 이상이어야 합니다");

export default function ResetPassword() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const canSubmit = useMemo(() => ready && !isSubmitting, [ready, isSubmitting]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      // If the reset link included tokens in the URL, supabase-js will pick them up.
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setReady(Boolean(data.session));
      setIsLoading(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      // PASSWORD_RECOVERY event is fired on reset link open.
      if (event === "PASSWORD_RECOVERY") {
        setReady(Boolean(session));
        setIsLoading(false);
      }
    });

    init();

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setPasswordError(parsed.error.errors[0]?.message ?? "비밀번호를 확인해주세요");
      return;
    }

    setPasswordError(null);
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("비밀번호가 변경되었습니다. 다시 로그인해주세요.");
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "비밀번호 변경에 실패했습니다");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 safe-top-lg">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/auth", { replace: true })}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">비밀번호 재설정</h1>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-8">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              재설정 링크가 만료되었거나 유효하지 않습니다. 로그인 화면에서 다시 재설정 링크를 요청해주세요.
            </p>
            <Button className="w-full mt-4" onClick={() => navigate("/auth", { replace: true })}>
              로그인으로 돌아가기
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 safe-top-lg">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/auth", { replace: true })}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">비밀번호 재설정</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium text-foreground">새 비밀번호를 설정하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">새 비밀번호</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상 입력"
                disabled={!canSubmit}
              />
              {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              비밀번호 변경
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
