# 부딪(Budit) 개발 가이드라인

## 프로젝트 개요

- **서비스**: 화장품 성분 충돌 분석 서비스 (MVP 단계)
- **스택**: Next.js 15 App Router + TypeScript + Supabase (@supabase/ssr) + Tailwind CSS 3 + shadcn/ui (new-york)
- **패키지 관리자**: pnpm (필수, npm/yarn 사용 금지)
- **현재 진행**: Phase 0 완료 → Phase 1 (DB 스키마) 진행 예정

---

## 프로젝트 아키텍처

### 디렉토리 구조

```
app/
  page.tsx                        # 랜딩 페이지 (/)
  layout.tsx                      # 루트 레이아웃 (ThemeProvider, 폰트 포함)
  globals.css                     # CSS 변수 (브랜드 컬러 포함)
  analyze/                        # 분석 페이지 (/analyze) — 아직 미생성
  auth/                           # 인증 라우트 (MVP 이후 활성화)
  api/                            # Route Handler — 아직 미생성
    products/search/route.ts      # GET ?q={query}
    analyze/route.ts              # POST
    ingredients/match/route.ts    # POST

components/
  ui/                             # shadcn/ui 기본 컴포넌트 (직접 수정 최소화)
  layout/                         # header.tsx — 아직 미생성
  landing/                        # hero-section.tsx, how-it-works.tsx — 아직 미생성
  analyze/                        # analyze-container.tsx 등 — 아직 미생성

lib/
  supabase/
    server.ts                     # 서버 클라이언트 (Server Component / Route Handler / Server Action)
    client.ts                     # 브라우저 클라이언트 (Client Component)
    proxy.ts                      # 미들웨어 세션 갱신 로직
  utils.ts                        # cn() 헬퍼, hasEnvVars

proxy.ts                          # Next.js 미들웨어 진입점 (루트)
tailwind.config.ts                # 커스텀 컬러 포함 Tailwind 설정
```

### 라우트 구조

| 경로       | 설명        | 인증                        |
| ---------- | ----------- | --------------------------- |
| `/`        | 랜딩 페이지 | 불필요 (공개)               |
| `/analyze` | 분석 페이지 | 불필요 (공개)               |
| `/auth/*`  | 인증 라우트 | 코드 유지, 라우트 보호 해제 |

---

## 코드 작성 규칙

### 언어 및 명명

- 변수명/함수명: **영어** (camelCase)
- 코드 주석: **한국어**
- 커밋 메시지: 컨벤셔널 스타일 + 한국어 (`feat(analyze): 제품 검색 컴포넌트 추가`)

### 컴포넌트 규칙

- Server Component 기본, 상호작용 필요 시만 `"use client"` 추가
- `/analyze` 페이지: Server Shell + Client Container 패턴 사용
  - `app/analyze/page.tsx` → Server Component (레이아웃 래퍼)
  - `components/analyze/analyze-container.tsx` → `"use client"` (상태 관리)
- 상태 관리: **useReducer 사용** (Redux/Zustand 등 외부 라이브러리 금지)
- 단계 전환: `select-a` → `select-b` → `ready` → `analyzing` → `result`

### TypeScript

- `any` 타입 사용 금지
- Supabase 타입은 `generate_typescript_types`로 생성 후 import
- API 요청/응답 타입은 별도 인터페이스로 정의

---

## Supabase 클라이언트 규칙

### 클라이언트 선택

| 상황             | 사용 클라이언트                             |
| ---------------- | ------------------------------------------- |
| Server Component | `lib/supabase/server.ts`의 `createClient()` |
| Route Handler    | `lib/supabase/server.ts`의 `createClient()` |
| Server Action    | `lib/supabase/server.ts`의 `createClient()` |
| Client Component | `lib/supabase/client.ts`의 `createClient()` |

### **절대 금지 사항**

- `lib/supabase/server.ts`의 `createClient()`를 **전역 변수에 저장 금지** (Fluid compute 호환 불가)
- 항상 함수 호출마다 새로 생성할 것

### proxy.ts 수정 규칙

- `lib/supabase/proxy.ts`에서 `supabase.auth.getClaims()` 호출 **절대 제거 금지**
- `createServerClient`와 `getClaims()` 사이에 코드 삽입 금지
- **이유**: 제거 시 SSR에서 사용자가 무작위 로그아웃되는 버그 발생

```typescript
// 올바른 패턴 (proxy.ts)
const supabase = createServerClient(...)
// ↑ 이 사이에 코드 넣지 말 것
const { data } = await supabase.auth.getClaims()
```

---

## 인증 규칙 (MVP)

- **MVP 기간**: 모든 라우트 공개 (인증 불필요)
- `app/auth/` 하위 라우트 코드는 **유지** (삭제 금지)
- `app/protected/` 경로에만 인증 체크 적용 (현재 미사용)
- 인증 체크 시 `getUser()` 대신 **`getClaims()`** 사용 (네트워크 호출 없이 JWT 파싱)

---

## UI/스타일링 규칙

### shadcn/ui

- 스타일: **new-york**
- 새 컴포넌트 추가: `pnpm dlx shadcn@latest add <component>`
- `components/ui/` 파일 직접 수정 최소화 (shadcn 업데이트 시 덮어씌워짐)
- 아이콘: **lucide-react** 사용 (다른 아이콘 라이브러리 추가 금지)

### 커스텀 컬러 사용

브랜드 전용 CSS 변수 사용:

| 변수명       | 용도                         | Tailwind 클래스                |
| ------------ | ---------------------------- | ------------------------------ |
| `--brand`    | 브랜드 컬러 (분홍/빨강 계열) | `bg-brand`, `text-brand`       |
| `--safe`     | 안전 (초록)                  | `bg-safe`, `text-safe`         |
| `--caution`  | 주의 (노랑/주황)             | `bg-caution`, `text-caution`   |
| `--conflict` | 충돌 (빨강)                  | `bg-conflict`, `text-conflict` |

**새 커스텀 색상 추가 시**: `app/globals.css` CSS 변수 + `tailwind.config.ts` 동시 수정 필수

### 다크모드

- `next-themes` 사용, `ThemeProvider`는 `app/layout.tsx`에 위치
- 다크모드 변수는 `app/globals.css`의 `.dark` 블록에서 관리
- 새 컬러 추가 시 라이트/다크 두 블록 모두 정의 필수

### 폰트

- 영문: `--font-geist-sans` (Geist)
- 한국어: `--font-noto-sans-kr` (Noto Sans KR)
- `body`에 `font-sans` 적용 → CSS 변수로 자동 fallback

### 반응형 디자인

- **Desktop First** 전략 (1280px 기준)
- 브레이크포인트: 데스크탑(1280px) → 태블릿(768px) → 모바일(375px)

---

## API Route Handler 규칙

### 엔드포인트 구조

| 경로                                 | 메서드           | 기능                         |
| ------------------------------------ | ---------------- | ---------------------------- |
| `app/api/products/search/route.ts`   | GET `?q={query}` | pg_trgm 제품 검색, 상위 10개 |
| `app/api/analyze/route.ts`           | POST             | 성분 충돌 분석               |
| `app/api/ingredients/match/route.ts` | POST             | 성분 텍스트 파싱 + DB 매칭   |

### Route Handler 작성 규칙

- `lib/supabase/server.ts`의 `createClient()` 사용
- 응답: `NextResponse.json()` 사용
- 에러 처리: HTTP 상태 코드 명시 (`400`, `500` 등)
- 클라이언트에서 직접 Supabase 쿼리하지 말고 Route Handler 경유

---

## DB 스키마 규칙

### 테이블 목록 (7종)

```
products                    # 화장품 제품
ingredients                 # 성분 (KCIA 표준명)
ingredient_groups           # 성분 그룹 ("레티놀 계열", "AHA 계열" 등)
ingredient_group_members    # 성분-그룹 매핑
product_ingredients         # 제품-성분 매핑
conflict_rules              # 충돌 규칙
ingredient_aliases          # 성분 별칭
unmatched_log               # 성분명 매칭 실패 로그
```

### Supabase MCP 사용 규칙

- 스키마 변경: `mcp__supabase__apply_migration` 사용
- 마이그레이션 파일 생성 후 적용 (직접 SQL 실행 지양)
- 타입 생성: `mcp__supabase__generate_typescript_types` → `lib/database.types.ts`에 저장

### conflict_rules severity 매핑

| severity          | UI 색상 | Tailwind 클래스        |
| ----------------- | ------- | ---------------------- |
| `high`            | 빨강    | `bg-conflict`          |
| `medium`          | 주황    | `bg-caution` (주황 톤) |
| `low` / `caution` | 노랑    | `bg-caution` (노랑 톤) |
| `synergy`         | 초록    | `bg-safe`              |

---

## 분석 페이지 구현 규칙

### 상태 머신 (useReducer)

```
select-a → select-b → ready → analyzing → result
```

- `analyze-container.tsx`에 useReducer 중앙 집중
- 하위 컴포넌트는 dispatch 함수를 prop으로 받음
- 전역 상태 관리 라이브러리(Redux, Zustand, Jotai 등) 사용 금지

### 검색 UI

- shadcn/ui `Command` 컴포넌트 (cmdk 기반) 사용
- 검색 API: `/api/products/search?q={query}` (디바운스 적용)
- 드롭다운에서 제품 선택 → 슬롯 A/B에 자동 반영

### 성분 직접 입력

- shadcn/ui `Dialog` 컴포넌트 사용
- 입력 형식: 쉼표(`,`) 구분 텍스트
- 전처리: 괄호 내 농도 제거, 공백 정규화 후 `/api/ingredients/match`에 전송

---

## 파일 동시 수정 규칙

| 작업                       | 수정해야 할 파일                                       |
| -------------------------- | ------------------------------------------------------ |
| 새 커스텀 색상 추가        | `app/globals.css` + `tailwind.config.ts`               |
| 새 shadcn/ui 컴포넌트 추가 | `components/ui/` (자동 생성)                           |
| DB 스키마 변경             | Supabase 마이그레이션 + `lib/database.types.ts` 재생성 |
| 새 API 엔드포인트 추가     | `app/api/.../route.ts` + 타입 정의                     |
| 새 라우트 페이지 추가      | `app/.../page.tsx` + 필요 시 `proxy.ts` matcher 확인   |

---

## 코드 품질 도구

### 커밋 전 자동 실행 (lint-staged + husky)

- `*.{ts,tsx}`: ESLint fix + Prettier 포맷
- `*.{js,mjs,cjs,jsx}`: ESLint fix + Prettier 포맷
- `*.{json,md,css}`: Prettier 포맷

### 커밋 메시지 규칙 (commitlint)

```
feat(scope): 한국어 설명
fix(auth): 로그인 오류 수정
chore(deps): 의존성 업데이트
style(analyze): Prettier 포맷 적용
```

### 수동 실행

```bash
pnpm lint          # ESLint 실행
pnpm format        # Prettier 포맷
pnpm type-check    # TypeScript 타입 체크
pnpm check-all     # 전체 검사 (type-check + lint + format:check)
```

---

## 금지 사항

- `npm` 또는 `yarn` 명령어 사용 금지 → `pnpm` 사용
- Supabase 서버 클라이언트를 전역 변수/모듈 레벨 변수에 저장 금지
- `proxy.ts`(루트) 또는 `lib/supabase/proxy.ts`에서 `getClaims()` 호출 제거 금지
- `any` 타입 사용 금지
- Client Component에서 직접 Supabase DB 쿼리 금지 → Route Handler 경유
- 상태 관리 외부 라이브러리 추가 금지 (useReducer 사용)
- `components/ui/` 파일 임의 수정 최소화 (shadcn 재생성 시 손실)
- MVP 기간 중 `app/auth/` 코드 삭제 금지 (나중에 활성화 예정)
- `createServerClient`와 `getClaims()` 사이 코드 삽입 금지
- `lucide-react` 외 아이콘 라이브러리 추가 금지
