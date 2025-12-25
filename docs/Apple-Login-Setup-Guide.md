# Apple 로그인 설정 가이드

> ⚠️ **중요**: Lovable Cloud는 현재 Apple 로그인을 지원하지 않습니다. Apple 로그인을 구현하려면 외부 Supabase 프로젝트에 연결해야 합니다.

---

## 사전 요구사항

1. ✅ Apple Developer Program 가입 (연 $99)
2. ✅ 외부 Supabase 프로젝트 연결 (Lovable Cloud가 아닌)
3. 도메인 소유권 (프로덕션용)

---

## 1단계: Apple Developer Console 설정

### 1.1 App ID 생성

1. [Apple Developer Console](https://developer.apple.com/account) 로그인
2. **Certificates, Identifiers & Profiles** 클릭
3. **Identifiers** → **+** 버튼 클릭
4. **App IDs** 선택 → Continue
5. **App** 타입 선택 → Continue
6. 설정 입력:
   - **Description**: `Curve App` (원하는 이름)
   - **Bundle ID**: `com.yourcompany.curve` (역방향 도메인 형식)
7. **Capabilities** 섹션에서 **Sign In with Apple** 체크 ✅
8. **Continue** → **Register**

### 1.2 Services ID 생성 (웹 로그인용)

1. **Identifiers** → **+** 버튼
2. **Services IDs** 선택 → Continue
3. 설정 입력:
   - **Description**: `Curve Web Login`
   - **Identifier**: `com.yourcompany.curve.web` (App ID와 다르게)
4. **Continue** → **Register**
5. 생성된 Services ID 클릭하여 편집
6. **Sign In with Apple** 체크 ✅ → **Configure** 클릭

### 1.3 Services ID 도메인 설정

**Configure** 화면에서:

1. **Primary App ID**: 1.1에서 생성한 App ID 선택
2. **Domains and Subdomains**:
   ```
   your-supabase-project.supabase.co
   ```
   (또는 커스텀 도메인)

3. **Return URLs** (가장 중요!):
   ```
   https://your-supabase-project.supabase.co/auth/v1/callback
   ```
   
4. **Next** → **Done** → **Continue** → **Save**

---

## 2단계: Key 생성

### 2.1 Sign in with Apple Key 생성

1. **Keys** → **+** 버튼 클릭
2. **Key Name**: `Curve Sign In Key`
3. **Sign In with Apple** 체크 ✅ → **Configure** 클릭
4. **Primary App ID**: 1.1에서 생성한 App ID 선택
5. **Save** → **Continue** → **Register**
6. ⚠️ **중요**: `.p8` 파일 다운로드 (한 번만 가능!)
7. **Key ID** 복사해두기 (예: `ABC123DEF4`)

### 2.2 필요한 정보 정리

다음 정보를 모두 기록해두세요:

| 항목 | 예시 | 설명 |
|------|------|------|
| Team ID | `ABCD1234EF` | Apple Developer 계정의 Team ID |
| Services ID | `com.yourcompany.curve.web` | 1.2에서 생성 |
| Key ID | `ABC123DEF4` | 2.1에서 생성 |
| Private Key | `.p8 파일 내용` | 다운로드한 키 파일 |

**Team ID 찾는 방법**:
- Apple Developer Console → 우측 상단 계정명 → View Account → Team ID

---

## 3단계: Supabase 설정

### 3.1 Supabase Dashboard에서 Apple Provider 활성화

1. [Supabase Dashboard](https://supabase.com/dashboard) 로그인
2. 프로젝트 선택
3. **Authentication** → **Providers**
4. **Apple** 찾아서 토글 ON
5. 정보 입력:

```
Secret Key (Signing Key):
-----BEGIN PRIVATE KEY-----
[.p8 파일의 전체 내용 붙여넣기]
-----END PRIVATE KEY-----

Apple Team ID: ABCD1234EF
Apple Key ID: ABC123DEF4
Apple Client ID (Services ID): com.yourcompany.curve.web
```

6. **Save**

### 3.2 Redirect URL 확인

Supabase에서 제공하는 Callback URL 확인:
```
https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback
```

이 URL이 Apple Developer Console의 Return URLs에 정확히 등록되어 있어야 합니다.

---

## 4단계: 프론트엔드 구현

### 4.1 로그인 버튼 추가

```typescript
import { supabase } from '@/integrations/supabase/client';

const handleAppleLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      // 스코프 옵션 (이메일, 이름)
      scopes: 'email name',
    },
  });
  
  if (error) {
    console.error('Apple login error:', error);
    toast.error('Apple 로그인 실패');
  }
};
```

### 4.2 Auth 페이지에 버튼 추가

```tsx
<Button
  variant="outline"
  className="w-full"
  onClick={handleAppleLogin}
>
  <AppleIcon className="w-5 h-5 mr-2" />
  Apple로 계속하기
</Button>
```

---

## 5단계: 콜백 처리

### 5.1 Auth Callback 페이지

```typescript
// src/pages/AuthCallback.tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/');
      }
    });
  }, [navigate]);

  return <div>로그인 처리 중...</div>;
}
```

### 5.2 라우터에 추가

```typescript
<Route path="/auth/callback" element={<AuthCallback />} />
```

---

## 트러블슈팅

### 일반적인 오류

| 오류 | 원인 | 해결 |
|------|------|------|
| `invalid_client` | Services ID 또는 Key 불일치 | Apple Developer Console에서 재확인 |
| `redirect_uri_mismatch` | Return URL 불일치 | Apple과 Supabase URL 정확히 일치시키기 |
| `invalid_grant` | Key 만료 또는 잘못된 형식 | .p8 파일 전체 내용 복사 확인 |

### 디버깅 체크리스트

- [ ] Services ID가 정확히 입력되었는가?
- [ ] Team ID가 정확한가?
- [ ] Key ID가 정확한가?
- [ ] .p8 파일 전체 내용이 복사되었는가 (BEGIN/END 포함)?
- [ ] Return URL이 정확히 일치하는가?
- [ ] 도메인이 Apple에 등록되었는가?

---

## 주의사항

1. **Apple은 이메일을 한 번만 제공합니다**: 첫 로그인 시에만 이메일을 받을 수 있습니다. 테스트 시 Apple ID Settings에서 앱 연결 해제 후 다시 시도하세요.

2. **프로덕션 배포 시**: 실제 도메인을 Apple Developer Console에 등록해야 합니다.

3. **Key 보안**: .p8 파일을 절대 공개 저장소에 커밋하지 마세요.

---

*가이드 작성일: 2025-12-25*
