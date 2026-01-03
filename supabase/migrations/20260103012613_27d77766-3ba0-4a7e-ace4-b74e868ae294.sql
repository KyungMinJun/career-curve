-- 1. 플랜 변경 히스토리 테이블 생성
CREATE TABLE public.plan_change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_plan_id uuid REFERENCES public.plans(id),
  to_plan_id uuid NOT NULL REFERENCES public.plans(id),
  changed_by uuid NOT NULL, -- admin user who made the change
  change_reason text,
  ai_credits_at_change integer DEFAULT 0,
  resume_credits_at_change integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plan_change_history ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admins can manage
CREATE POLICY "Admins can view all plan history"
ON public.plan_change_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert plan history"
ON public.plan_change_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 2. 크레딧 사용 내역 테이블 생성
CREATE TABLE public.credit_usage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credit_type text NOT NULL, -- 'ai' or 'resume'
  amount integer NOT NULL, -- negative for usage, positive for addition
  action text NOT NULL, -- 'analyze-job', 'evaluate-fit', 'generate-resume', 'admin-grant', 'plan-change'
  description text,
  job_posting_id uuid REFERENCES public.job_postings(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_usage_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can view all credit history"
ON public.credit_usage_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own credit history"
ON public.credit_usage_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert credit history"
ON public.credit_usage_history
FOR INSERT
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- 3. 플랜 업데이트 (Free, Starter, Pro)
UPDATE public.plans 
SET 
  job_limit = 5,
  ai_credits = 3,
  resume_credits = 1,
  features = '["공고 분석/저장 5개", "AI 적합도 평가 3회", "맞춤 이력서 1회"]'::jsonb
WHERE name = 'free';

UPDATE public.plans 
SET 
  job_limit = 30,
  ai_credits = 20,
  resume_credits = 10,
  features = '["공고 분석/저장 30개", "AI 적합도 평가 20회", "맞춤 이력서 10회"]'::jsonb
WHERE name = 'starter';

UPDATE public.plans 
SET 
  job_limit = 999999,
  ai_credits = 50,
  resume_credits = 30,
  features = '["공고 분석/저장 무제한", "AI 적합도 평가 50회", "맞춤 이력서 30회"]'::jsonb
WHERE name = 'pro';

-- 4. 기존 사용자들의 크레딧을 플랜에 맞게 업데이트
UPDATE public.user_subscriptions us
SET 
  ai_credits_remaining = CASE 
    WHEN us.ai_credits_used >= p.ai_credits THEN 0
    ELSE p.ai_credits - us.ai_credits_used
  END,
  resume_credits_remaining = CASE
    WHEN us.resume_credits_used >= p.resume_credits THEN 0
    ELSE p.resume_credits - us.resume_credits_used
  END
FROM public.plans p
WHERE us.plan_id = p.id;