# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 언어 및 커뮤니케이션 규칙

- 기본 응답 언어: 한국어
- 코드 주석: 한국어로 작성
- 커밋 메시지: 컨벤셔널 스타일, 괄호 스코프 사용, 한국어로 작성
  - 예시: `feat(auth): 소셜 로그인 기능 추가`
- 변수명/함수명: 영어 (코드 표준 준수)

## 명령어

```bash
pnpm dev        # 개발 서버 시작 (localhost:3000)
pnpm build      # 프로덕션 빌드
pnpm start      # 프로덕션 서버 시작
pnpm lint       # ESLint 실행
```

패키지 관리자는 **pnpm**을 사용한다.

## 환경 변수

`.env.local` 파일에 아래 두 값이 필요하다:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`lib/utils.ts`의 `hasEnvVars`는 이 두 값의 존재 여부를 확인하며, 설정되지 않은 경우 UI에서 경고를 표시하고 인증 기능을 비활성화한다.

## 아키텍처 개요

**스택**: Next.js 15 (App Router) + TypeScript + Supabase (`@supabase/ssr`) + Tailwind CSS + shadcn/ui

### Supabase 클라이언트 패턴

두 가지 클라이언트가 목적에 따라 분리되어 있다:

- `lib/supabase/server.ts` — Server Component, Route Handler, Server Action에서 사용. `cookies()`를 통해 세션을 읽고 쓴다. **Fluid compute 호환을 위해 전역 변수에 저장하지 말고 함수 호출마다 새로 생성해야 한다.**
- `lib/supabase/client.ts` — Client Component에서 사용하는 브라우저 클라이언트.

### 세션 프록시 (미들웨어)

`proxy.ts` (루트) — Next.js 미들웨어 역할. 모든 요청마다 `lib/supabase/proxy.ts`의 `updateSession()`을 호출하여 사용자 세션을 갱신한다.

**중요**: `proxy.ts`에서 `getClaims()` 호출을 절대 제거하면 안 된다. 이 호출이 없으면 서버 사이드 렌더링 시 사용자가 무작위로 로그아웃될 수 있다.

`updateSession()` 내부의 인증 로직: `/`, `/login`, `/auth/*` 경로를 제외한 모든 경로에서 미인증 사용자를 `/auth/login`으로 리다이렉트한다.

### 인증 흐름

`app/auth/` 하위 라우트가 전체 인증 플로우를 담당한다:

- `/auth/login` — 로그인
- `/auth/sign-up` — 회원가입
- `/auth/sign-up-success` — 이메일 확인 안내
- `/auth/forgot-password` — 비밀번호 재설정 요청
- `/auth/update-password` — 새 비밀번호 설정
- `/auth/confirm` (Route Handler) — 이메일 OTP 토큰 검증 후 리다이렉트
- `/auth/error` — 인증 오류 표시

### 보호된 라우트

`app/protected/` — 인증된 사용자만 접근 가능. `supabase.auth.getClaims()`로 세션을 확인하고, 없으면 `/auth/login`으로 리다이렉트한다. `getUser()` 대신 `getClaims()`를 사용하는 이유는 네트워크 호출 없이 로컬에서 JWT를 파싱하므로 더 빠르기 때문이다.

### 컴포넌트 구조

- `components/ui/` — shadcn/ui 기반 기본 UI 컴포넌트 (Button, Input, Label 등)
- `components/` — 앱 수준 컴포넌트 (AuthButton, LoginForm, SignUpForm 등)
- `lib/utils.ts` — `cn()` 헬퍼 (clsx + tailwind-merge)와 `hasEnvVars` 유틸리티

### next.config.ts

`cacheComponents: true` 설정이 활성화되어 있다 (Fluid compute용 컴포넌트 캐싱).
