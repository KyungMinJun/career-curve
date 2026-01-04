-- 1. 전화번호 인증 및 악용 방지를 위한 테이블 생성

-- 전화번호 인증 정보 저장 테이블
CREATE TABLE public.phone_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  verified_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(phone_number) -- 동일 전화번호로 여러 계정 방지
);

ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own phone verification"
ON public.phone_verifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own phone verification"
ON public.phone_verifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all phone verifications"
ON public.phone_verifications FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 디바이스 핑거프린트 테이블
CREATE TABLE public.device_fingerprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  user_agent text,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can insert device fingerprints"
ON public.device_fingerprints FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own device fingerprints"
ON public.device_fingerprints FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all device fingerprints"
ON public.device_fingerprints FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 악용 감지 로그 테이블
CREATE TABLE public.abuse_detection_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fingerprint text,
  phone_number text,
  detection_type text NOT NULL, -- 'multi_account', 'rapid_signup', 'rapid_ai_usage', etc.
  details jsonb,
  action_taken text, -- 'blocked', 'captcha_required', 'warning', etc.
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.abuse_detection_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view abuse logs"
ON public.abuse_detection_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert abuse logs"
ON public.abuse_detection_logs FOR INSERT
WITH CHECK (true);

-- 2. user_subscriptions에 전화번호 인증 상태 컬럼 추가
ALTER TABLE public.user_subscriptions 
ADD COLUMN phone_verified boolean NOT NULL DEFAULT false,
ADD COLUMN phone_verified_at timestamp with time zone;

-- 3. 전화번호 중복 체크 함수 (보안 디파이너)
CREATE OR REPLACE FUNCTION public.check_phone_available(phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.phone_verifications
    WHERE phone_number = phone
  )
$$;

-- 4. 전화번호 인증 완료 시 호출되는 함수
CREATE OR REPLACE FUNCTION public.complete_phone_verification(phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 이미 다른 계정에서 사용 중인 전화번호인지 확인
  IF EXISTS (SELECT 1 FROM public.phone_verifications WHERE phone_number = phone AND user_id != auth.uid()) THEN
    RETURN false;
  END IF;

  -- 전화번호 인증 정보 저장
  INSERT INTO public.phone_verifications (user_id, phone_number)
  VALUES (auth.uid(), phone)
  ON CONFLICT (user_id) DO UPDATE SET phone_number = phone, verified_at = now();

  -- subscription 업데이트
  UPDATE public.user_subscriptions
  SET phone_verified = true, phone_verified_at = now()
  WHERE user_id = auth.uid();

  RETURN true;
END;
$$;

-- 5. 디바이스 핑거프린트로 다계정 감지 함수
CREATE OR REPLACE FUNCTION public.check_fingerprint_abuse(fp text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count integer;
  result jsonb;
BEGIN
  -- 동일 핑거프린트로 등록된 다른 계정 수 확인
  SELECT COUNT(DISTINCT user_id)
  INTO user_count
  FROM public.device_fingerprints
  WHERE fingerprint = fp AND user_id != auth.uid();

  result = jsonb_build_object(
    'is_suspicious', user_count > 0,
    'other_account_count', user_count
  );

  RETURN result;
END;
$$;