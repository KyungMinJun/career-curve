-- Update plans table for correct limits
-- Free: job_limit=5 (공고 5개), ai_credits=3 (AI 공고분석 3회), resume_credits는 별도 필드로 관리 필요

-- First, add resume_credits column for tracking tailored resume generation limits
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS resume_credits integer NOT NULL DEFAULT 0;

-- Add resume_credits_remaining and resume_credits_used to user_subscriptions
ALTER TABLE public.user_subscriptions 
  ADD COLUMN IF NOT EXISTS resume_credits_remaining integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resume_credits_used integer NOT NULL DEFAULT 0;

-- Update Free plan: 공고 5개, AI 분석 3회, 이력서 생성 0회 (무료는 제한)
UPDATE public.plans 
SET job_limit = 5, ai_credits = 3, resume_credits = 0
WHERE name = 'free';

-- Update Starter plan: 공고 무제한, AI 분석 무제한(충분히 큰 수), 이력서 100회
UPDATE public.plans 
SET job_limit = 999999, ai_credits = 999999, resume_credits = 100
WHERE name = 'starter';

-- Update Pro plan: 공고 무제한, AI 분석 무제한, 이력서 300회
UPDATE public.plans 
SET job_limit = 999999, ai_credits = 999999, resume_credits = 300
WHERE name = 'pro';

-- Update existing user_subscriptions to have resume_credits based on their plan
UPDATE public.user_subscriptions us
SET resume_credits_remaining = p.resume_credits, resume_credits_used = 0
FROM public.plans p
WHERE us.plan_id = p.id;