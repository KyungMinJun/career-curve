# 커브 (Curve) - 디자인 시스템

> 작성일: 2025-01-07  
> 기술 스택: Tailwind CSS, shadcn/ui, HSL 색상 시스템

---

## 디자인 철학

**Clean, Minimal, Card-focused**

커브는 깔끔하고 미니멀한 카드 중심의 디자인을 지향합니다. 복잡한 커리어 관리 정보를 명확하게 전달하면서도, 사용자가 집중할 수 있는 환경을 제공합니다.

### 핵심 원칙

1. **일관성**: 모든 컴포넌트에서 동일한 색상, 간격, 타이포그래피 사용
2. **접근성**: 충분한 명암비, 키보드 네비게이션 지원
3. **반응형**: 모바일 퍼스트, 데스크톱 최적화
4. **다크 모드**: 라이트/다크 테마 완벽 지원

---

## 색상 시스템

모든 색상은 **HSL 포맷**으로 정의되며, CSS 변수를 통해 관리됩니다.

### Primary Colors

| 토큰 | Light Mode | Dark Mode | 용도 |
|------|------------|-----------|------|
| `--primary` | `239 84% 67%` | `239 84% 67%` | 주요 CTA, 브랜드 강조 |
| `--primary-foreground` | `0 0% 100%` | `0 0% 100%` | Primary 위 텍스트 |

**시각적 표현**: Deep Indigo (#4F46E5)

### Background & Foreground

| 토큰 | Light Mode | Dark Mode | 용도 |
|------|------------|-----------|------|
| `--background` | `0 0% 98%` | `230 25% 8%` | 페이지 배경 |
| `--foreground` | `230 25% 15%` | `210 40% 98%` | 기본 텍스트 |
| `--card` | `0 0% 100%` | `230 25% 12%` | 카드 배경 |
| `--card-foreground` | `230 25% 15%` | `210 40% 98%` | 카드 내 텍스트 |

### Secondary & Muted

| 토큰 | Light Mode | Dark Mode | 용도 |
|------|------------|-----------|------|
| `--secondary` | `220 14% 96%` | `230 25% 18%` | 보조 버튼, 배경 |
| `--muted` | `220 14% 96%` | `230 25% 18%` | 비활성 상태 |
| `--muted-foreground` | `220 9% 46%` | `220 9% 60%` | 부가 설명 텍스트 |

### Accent

| 토큰 | Light Mode | Dark Mode | 용도 |
|------|------------|-----------|------|
| `--accent` | `239 100% 97%` | `239 60% 20%` | 호버/포커스 배경 |
| `--accent-foreground` | `239 84% 50%` | `239 84% 80%` | 강조 텍스트 |

### Status Colors (시맨틱 컬러)

| 토큰 | Light Mode | Dark Mode | 용도 |
|------|------------|-----------|------|
| `--destructive` | `0 72% 51%` | `0 62% 30%` | 삭제, 에러 |
| `--success` | `142 71% 45%` | `142 50% 35%` | 성공, 완료 |
| `--warning` | `38 92% 50%` | `38 70% 40%` | 경고, 주의 |
| `--info` | `199 89% 48%` | `199 70% 40%` | 정보, 안내 |

### Border & Input

| 토큰 | Light Mode | Dark Mode | 용도 |
|------|------------|-----------|------|
| `--border` | `220 13% 91%` | `230 25% 20%` | 테두리 |
| `--input` | `220 13% 91%` | `230 25% 20%` | 입력 필드 테두리 |
| `--ring` | `239 84% 67%` | `239 84% 67%` | 포커스 링 |

---

## 사용 예시

### ✅ 올바른 사용법

```tsx
// Tailwind 시맨틱 토큰 사용
<div className="bg-background text-foreground" />
<div className="bg-card text-card-foreground" />
<button className="bg-primary text-primary-foreground" />
<span className="text-muted-foreground" />
<div className="border-border" />
<span className="text-destructive" />
<span className="text-success" />
```

### ❌ 잘못된 사용법

```tsx
// 직접 색상 값 사용 금지!
<div className="bg-white text-black" />
<div className="bg-[#4F46E5]" />
<button className="bg-indigo-600" />
<span className="text-gray-500" />
```

---

## 타이포그래피

### 폰트 패밀리

```css
font-family: -apple-system, BlinkMacSystemFont, "Pretendard Variable", 
             Pretendard, system-ui, sans-serif;
```

- **Pretendard**: 한글 최적화 시스템 폰트
- **System UI**: 네이티브 앱 느낌 제공
- **Apple 폰트 우선**: iOS/macOS 사용자 경험 최적화

### 폰트 사이즈 (Tailwind 기본)

| 클래스 | 크기 | 용도 |
|--------|------|------|
| `text-xs` | 12px | 캡션, 레이블 |
| `text-sm` | 14px | 본문 보조 |
| `text-base` | 16px | 기본 본문 |
| `text-lg` | 18px | 강조 본문 |
| `text-xl` | 20px | 섹션 제목 |
| `text-2xl` | 24px | 페이지 부제목 |
| `text-3xl` | 30px | 페이지 제목 |

---

## 간격 (Spacing)

### Border Radius

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--radius` | `0.75rem` (12px) | 기본 라운딩 |
| `rounded-sm` | `calc(var(--radius) - 4px)` | 작은 요소 |
| `rounded-md` | `calc(var(--radius) - 2px)` | 중간 요소 |
| `rounded-lg` | `var(--radius)` | 카드, 버튼 |
| `rounded-xl` | `calc(var(--radius) + 4px)` | 큰 카드 |
| `rounded-2xl` | `calc(var(--radius) + 8px)` | 모달, 시트 |

### Safe Area (iOS)

```css
.safe-top { padding-top: max(1rem, env(safe-area-inset-top)); }
.safe-top-lg { padding-top: max(1.5rem, env(safe-area-inset-top)); }
.safe-bottom { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
```

---

## 애니메이션

### 정의된 키프레임

| 이름 | 효과 | 용도 |
|------|------|------|
| `accordion-down/up` | 높이 확장/축소 | 아코디언 컴포넌트 |
| `slide-up` | 아래에서 위로 슬라이드 | 토스트, 바텀시트 |
| `fade-in` | 페이드 인 | 모달, 오버레이 |
| `pulse-soft` | 부드러운 펄스 | 로딩 인디케이터 |

### 사용 예시

```tsx
<div className="animate-fade-in" />
<div className="animate-slide-up" />
<div className="animate-pulse-soft" />
```

---

## 유틸리티 클래스

### 커스텀 유틸리티

| 클래스 | 설명 |
|--------|------|
| `.glass` | iOS 스타일 블러 배경 (80% 배경 + backdrop-blur-xl) |
| `.card-shadow` | 미묘한 카드 그림자 |
| `.card-shadow-lg` | 강조된 카드 그림자 |
| `.scrollbar-hide` | 스크롤바 숨김 (기능 유지) |
| `.text-balance` | 텍스트 줄바꿈 균형 |

### 사용 예시

```tsx
// 글래스 효과
<nav className="glass sticky top-0" />

// 카드 그림자
<div className="bg-card card-shadow rounded-lg p-4" />
<div className="bg-card card-shadow-lg rounded-lg p-6" />

// 스크롤 숨김
<div className="overflow-auto scrollbar-hide" />
```

---

## 컴포넌트 가이드라인

### 버튼 변형 (shadcn/ui)

| Variant | 용도 |
|---------|------|
| `default` | 주요 액션 (Primary 색상) |
| `secondary` | 보조 액션 |
| `destructive` | 삭제, 위험한 액션 |
| `outline` | 테두리만 있는 버튼 |
| `ghost` | 배경 없는 버튼 |
| `link` | 링크 스타일 버튼 |

### 카드

```tsx
<Card className="bg-card text-card-foreground card-shadow">
  <CardHeader>
    <CardTitle>제목</CardTitle>
    <CardDescription className="text-muted-foreground">
      설명
    </CardDescription>
  </CardHeader>
  <CardContent>내용</CardContent>
</Card>
```

### 입력 필드

```tsx
<Input 
  className="border-input bg-background focus-visible:ring-ring"
  placeholder="입력하세요"
/>
```

---

## 반응형 브레이크포인트

| 브레이크포인트 | 값 | 용도 |
|----------------|-----|------|
| `sm` | 640px | 모바일 가로 |
| `md` | 768px | 태블릿 |
| `lg` | 1024px | 작은 데스크톱 |
| `xl` | 1280px | 데스크톱 |
| `2xl` | 1400px | 큰 데스크톱 (컨테이너 max-width) |

---

## 다크 모드

다크 모드는 `.dark` 클래스를 `<html>` 요소에 추가하여 활성화됩니다.

```tsx
// next-themes 사용
import { useTheme } from "next-themes";

const { theme, setTheme } = useTheme();
setTheme("dark"); // 또는 "light", "system"
```

### 색상 자동 전환

시맨틱 토큰을 사용하면 다크 모드에서 자동으로 색상이 전환됩니다:

```tsx
// 라이트: 흰색 배경, 어두운 텍스트
// 다크: 어두운 배경, 밝은 텍스트
<div className="bg-background text-foreground" />
```

---

## 파일 구조

```
src/
├── index.css              # CSS 변수 및 전역 스타일
├── components/
│   └── ui/                # shadcn/ui 컴포넌트
│       ├── button.tsx
│       ├── card.tsx
│       └── ...
tailwind.config.ts         # Tailwind 설정 및 확장
```

---

## 체크리스트

새 컴포넌트 작성 시 확인사항:

- [ ] 색상에 시맨틱 토큰 사용 (bg-primary, text-foreground 등)
- [ ] 하드코딩된 색상 없음 (bg-white, text-black, #hex 등)
- [ ] 다크 모드에서 정상 표시 확인
- [ ] 반응형 레이아웃 적용
- [ ] 키보드 접근성 확인
- [ ] 애니메이션에 정의된 키프레임 사용

---

*문서 버전: 1.0*  
*최종 수정: 2025-01-07*
