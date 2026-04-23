# 부딪 (Budit) 개발 히스토리 및 기술 철학

> 이 문서는 부딪 프로젝트의 탄생부터 현재까지의 개발 여정을 기록한 문서입니다.
> 새로 합류하는 팀원이 "왜 이렇게 만들었는가"를 이해하고 프로젝트에 빠르게 녹아들 수 있도록
> 기술적 결정의 배경과 맥락을 중심으로 작성되었습니다.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 철학](#2-기술-철학)
3. [아키텍처 결정 기록 (ADR)](#3-아키텍처-결정-기록-adr)
4. [개발 단계별 히스토리](#4-개발-단계별-히스토리)
5. [핵심 알고리즘 설명](#5-핵심-알고리즘-설명)
6. [주요 트러블슈팅 기록](#6-주요-트러블슈팅-기록)
7. [데이터 인프라](#7-데이터-인프라)
8. [현재 상태 및 남은 작업](#8-현재-상태-및-남은-작업)
9. [온보딩 가이드](#9-온보딩-가이드)

---

## 1. 프로젝트 개요

### 무엇을 만드는가

**부딪**은 민감성 피부를 가진 사람들이 화장품 성분 충돌을 10초 안에 확인할 수 있는 서비스입니다.

두 제품을 골라 "성분 충돌 분석" 버튼을 누르면, 레티놀과 AHA처럼 함께 사용하면 안 되는 성분 조합을 severity(고위험/주의/시너지)별로 즉시 알려줍니다.

### 왜 만들었는가

민감성 피부를 가진 사람은 화장품 성분표를 직접 비교하고 싶어도 전문 지식이 없으면 어렵습니다. 기존 대안들은 각각 한계가 있었습니다.

| 기존 대안            | 한계                                            |
| -------------------- | ----------------------------------------------- |
| 화해 앱              | 성분 정보 조회는 가능하지만 충돌 분석 기능 없음 |
| 올리브영 상품 페이지 | 성분 나열만, 조합 위험도 정보 없음              |
| 구글/블로그 검색     | 단편적이고 신뢰도가 불균일한 정보               |
| 피부과 상담          | 비용과 접근성 장벽이 높음                       |

충돌 정보는 흩어진 블로그와 커뮤니티에만 존재하고, 루틴을 잘못 구성하면 트러블이 발생한 뒤에야 인지하게 됩니다. 부딪은 이 문제를 해결하기 위해 만들어졌습니다.

### 누구를 위한 서비스인가

- **핵심 타겟**: 피부가 민감하여 화장품 성분에 예민한 20~40대 여성
- **얼리 어답터**: 화장품 성분에 관심이 많고 직접 루틴을 리서치하는 뷰티 덕후, 민감성 피부 트러블 경험이 있는 사용자

### 핵심 가치 제안

> **두 화장품을 고르면 10초 안에 충돌 여부를 알려드립니다.**
> 성분 공부 없이도 안심하고 스킨케어 루틴을 구성할 수 있는 가장 빠른 방법.

---

## 2. 기술 철학

### 왜 이 기술 스택을 선택했는가

**Next.js 15 (App Router) + TypeScript + Supabase + Tailwind CSS + shadcn/ui**

이 조합은 "MVP를 가장 빠르게 만들고, 필요한 시점에 확장할 수 있는" 구성입니다.

#### Next.js App Router

Server Component와 Route Handler를 함께 사용할 수 있어 API 서버를 별도로 구성하지 않아도 됩니다. 분석 API(`/api/analyze`)를 Next.js Route Handler로 구현하여 인프라를 단순하게 유지했습니다.

#### Supabase

PostgreSQL 기반 BaaS로, DB 스키마 마이그레이션부터 RLS(행 수준 보안) 정책까지 SQL로 직접 제어할 수 있습니다. 특히 `pg_trgm` 확장을 활성화하여 한글 부분 문자열 검색을 별도 검색 엔진 없이 구현한 것이 핵심입니다.

#### useReducer — 외부 상태 라이브러리를 선택하지 않은 이유

분석 플로우는 `select-a → select-b → ready → analyzing → result`라는 명확한 상태 머신 구조입니다. Zustand나 Jotai 같은 외부 라이브러리를 추가하면 의존성이 늘고 번들 크기가 증가합니다. React 내장 `useReducer`만으로 이 상태 머신을 충분히 표현할 수 있었고, 팀이 외부 라이브러리 없이도 예측 가능한 상태 전환을 유지할 수 있다는 판단이었습니다.

#### shadcn/ui

헤드리스 컴포넌트 기반으로 소스 코드를 직접 소유하는 방식입니다. 디자인 시스템과 강결합되지 않으면서 Command(cmdk) 같은 고품질 인터랙션을 빠르게 가져올 수 있었습니다. 검색 드롭다운의 키보드 탐색 UX가 대표적인 예입니다.

### pg_trgm을 선택한 이유

한글 성분명 검색에는 특수한 어려움이 있습니다. "나이아신아마이드"를 찾으려는 사용자가 "나이아"만 입력해도 결과가 나와야 합니다. 형태소 분석 기반 검색(Elasticsearch 등)은 인프라 복잡도를 크게 높입니다.

`pg_trgm`은 PostgreSQL 확장으로, 문자열을 3-gram(세 글자 단위)으로 분해하여 GIN 인덱스를 구축합니다. 별도 검색 엔진 없이 PostgreSQL 하나로 부분 문자열 검색과 유사도 매칭을 모두 처리할 수 있습니다. 성분명 매칭의 90% 유사도 임계값도 이 확장 덕분에 구현할 수 있었습니다.

---

## 3. 아키텍처 결정 기록 (ADR)

### ADR-001: `/analyze` 라우트 제거, 단일 페이지 아키텍처로 통합

**상태**: 승인됨 (2026-04-16)

**컨텍스트**: 초기 PRD에는 랜딩 페이지(`/`)와 분석 페이지(`/analyze`)가 분리된 2페이지 구조로 설계되어 있었습니다. 랜딩에서 CTA 버튼을 클릭하면 `/analyze`로 이동하는 흐름이었습니다.

**결정**: `/analyze` 라우트를 제거하고, 랜딩 페이지의 히어로 섹션 바로 아래에 분석 컨테이너(`AnalyzeContainer`)를 배치하여 모든 플로우를 `/` 한 페이지에서 처리하도록 변경했습니다. `/analyze` 접근 시 `/`로 리다이렉트합니다.

**고려한 대안**: 기존 2페이지 구조 유지

**전환 이유**:

- 사용자가 서비스를 처음 방문했을 때 "CTA 버튼을 클릭해야 검색창이 나온다"는 불필요한 단계를 제거했습니다.
- 랜딩 페이지의 슬로건과 분석 도구가 한 화면에서 보이므로 서비스의 핵심 가치를 즉시 체험할 수 있습니다.
- 페이지 라우팅이 없으므로 상태가 URL에 의존하지 않고, 분석 플로우 전체가 클라이언트 상태로 관리됩니다.

**결과**: 페이지 구조가 `히어로(브랜딩) → 검색/분석 플로우(AnalyzeContainer) → 서비스 소개(HowItWorks)`로 단순화되었습니다.

---

### ADR-002: conflict_rules 조회 방식을 Supabase .or()에서 RPC로 전환

**상태**: 승인됨 (2026-04-21)

**컨텍스트**: 충돌 분석 API는 두 슬롯의 성분명과 그룹명을 합친 "텀 집합(terms)"을 만들고, `conflict_rules` 테이블에서 양방향으로 조회합니다. 초기 구현에서는 Supabase JavaScript 클라이언트의 `.or()` 메서드로 이 조회를 수행했습니다.

```typescript
// 기존 방식: URL 파라미터로 배열 직렬화
const { data: rules } = await supabase
  .from("conflict_rules")
  .select("*")
  .or(
    `and(ingredient_a.in.(${csvA}),ingredient_b.in.(${csvB})),` +
      `and(ingredient_a.in.(${csvB}),ingredient_b.in.(${csvA}))`
  );
```

**문제**: 이니스프리 레티놀 앰플(35개 성분) × 메디힐 더마패드(34개 성분) 조합에서 각 성분의 그룹명까지 추가하면 텀 집합이 각각 40~50개에 달합니다. 한국어 성분명은 UTF-8 인코딩 후 퍼센트 인코딩을 거치면 실제 요청 URL이 **10,101자**에 달해 Supabase REST API(PostgREST)의 HTTP 헤더 한계(~16KB)를 초과합니다. Supabase는 에러를 조용히 반환하고(`data = null`), 코드는 이를 "충돌 없음"으로 해석했습니다.

**결정**: `analyze_conflicts(names_a TEXT[], names_b TEXT[])` PostgreSQL 함수를 생성하고, Supabase `.rpc()` 호출로 전환했습니다. 배열을 POST 요청 바디로 전달하므로 URL 길이 제한이 없습니다.

```typescript
// 수정 후: RPC 함수 호출 (POST 요청)
const { data: rules, error } = await supabase.rpc("analyze_conflicts", {
  names_a: namesA,
  names_b: namesB,
});
```

**고려한 대안**: URL 길이를 줄이기 위해 텀 집합을 사전 필터링하거나, 배치로 나눠 여러 번 호출하는 방법

**전환 이유**: RPC 방식이 근본 원인을 해결하면서 성분 수 증가에도 안전합니다. 또한 그룹 확장 로직(성분 ID → 그룹명 조회)을 DB 함수 내부로 이동시켜 네트워크 왕복 횟수도 줄었습니다.

**규칙 정립**: 한국어/CJK 문자열이 포함된 배열을 10개 이상 필터 조건으로 사용할 때는 반드시 RPC 방식을 사용합니다.

---

### ADR-003: conflict_rules 테이블의 ingredient_a/b를 TEXT로 저장 (폴리모픽 FK 없음)

**상태**: 승인됨 (2026-04-17)

**컨텍스트**: 충돌 규칙은 개별 성분(`ingredients.name`)과 그룹(`ingredient_groups.group_name`)을 양쪽 피연산자로 사용합니다. 예를 들어 "레티놀 계열(그룹) vs AHA 계열(그룹)", "살리실산(개별 성분) vs 레티놀 계열(그룹)" 같은 형태입니다.

**결정**: `ingredient_a`, `ingredient_b`를 UUID FK가 아닌 `TEXT`로 저장하고, `a_type`, `b_type` 컬럼(`'ingredient' | 'group'`)으로 텀 종류를 명시합니다.

**고려한 대안**: 폴리모픽 FK 패턴(ingredient_a_ingredient_id + ingredient_a_group_id 컬럼 분리)

**선택 이유**:

- 충돌 분석 알고리즘은 성분명과 그룹명을 하나의 "텀 집합"으로 평탄화해서 처리합니다. TEXT 참조 + 양방향 쿼리가 현 데이터 규모(52개 규칙)에 가장 단순하고 적합합니다.
- `a_type`/`b_type` 컬럼은 시드 후 데이터 정합성 검증과 향후 관리 화면 개발에 활용됩니다.
- 폴리모픽 FK는 쿼리 복잡도를 높이고 RPC 함수 작성도 어렵게 만듭니다.

---

### ADR-004: MVP에서 인증 라우트를 유지하되 보호를 해제

**상태**: 승인됨 (2026-04-16)

**컨텍스트**: 부딪 MVP는 인증이 불필요한 공개 서비스입니다. 그러나 스타터킷(Next.js + Supabase 템플릿)에 포함된 인증 코드(`app/auth/`, `proxy.ts`, Supabase 클라이언트 분리 패턴)가 이미 존재했습니다.

**결정**: 인증 코드를 삭제하지 않고 유지합니다. 미들웨어(`proxy.ts`)의 보호 라우트 목록에서 앱 라우트를 제외하여 비인증 접근을 허용합니다.

**이유**: 추후 "분석 결과 저장/히스토리" 기능을 추가할 때 인증 인프라를 처음부터 다시 구축하지 않아도 됩니다. `getClaims()`를 미들웨어에서 제거하면 SSR 시 사용자가 무작위로 로그아웃될 수 있으므로, 코드를 그대로 유지하는 것이 안전합니다.

---

## 4. 개발 단계별 히스토리

### Phase 0: 프로젝트 초기 설정 (2026-04-16)

**기간**: 약 반나절  
**커밋 수**: 5개

**무슨 일이 있었는가**

Next.js + Supabase 스타터킷에서 시작했습니다. 스타터킷은 인증 보일러플레이트, 샘플 페이지, 기본 스타일 등이 포함되어 있어 "백지에서 시작"이 아니라 "불필요한 것을 걷어내는" 작업이었습니다.

도구 체인을 먼저 잡았습니다. ESLint + Prettier + Husky + lint-staged + commitlint를 설정하여 코드 포맷과 커밋 메시지 컨벤션을 자동으로 강제합니다. 이 설정은 이후 모든 작업의 기반이 됩니다.

브랜드 컬러 시스템은 `globals.css`에 CSS 변수로 정의하고 Tailwind 테마 확장으로 연결했습니다. 다크모드 팔레트를 처음부터 함께 설계했습니다.

**배운 점**

도구 체인은 처음부터 잡아두는 것이 맞습니다. 나중에 추가하면 기존 코드 전체를 포맷해야 하는 대규모 커밋이 생깁니다.

---

### Phase 1: 목업 UI — 인터랙티브 프로토타입 (2026-04-16)

**기간**: 하루  
**커밋 수**: 6개 (feat 위주)

**무슨 일이 있었는가**

API와 DB 없이, 하드코딩된 더미 데이터로 실제처럼 동작하는 인터랙티브 목업을 먼저 만들었습니다. "UI를 먼저, 데이터 연결은 나중에" 전략입니다.

이 단계에서 가장 중요한 결정이 나왔습니다. 바로 `/analyze` 라우트를 제거하고 단일 페이지 아키텍처로 전환한 것입니다. (ADR-001 참조)

`useReducer` 기반 상태 머신을 구현했습니다. 분석 플로우의 5가지 상태(`select-a`, `select-b`, `ready`, `analyzing`, `result`)와 전환 규칙을 액션 타입으로 명확히 정의했습니다.

```typescript
// 상태 타입 정의 — 유효하지 않은 상태는 타입 시스템이 방지
type AnalyzeStep = "select-a" | "select-b" | "ready" | "analyzing" | "result";

// 액션 타입 — 가능한 전환만 표현
type AnalyzeAction =
  | { type: "SELECT_SLOT_A"; payload: SlotState }
  | { type: "SELECT_SLOT_B"; payload: SlotState }
  | { type: "START_ANALYZE" }
  | { type: "SET_RESULT"; payload: AnalyzeResult }
  | { type: "RESET" };
```

shadcn/ui의 Command(cmdk) 컴포넌트로 검색 드롭다운 UI를 구현했습니다. 키보드 탐색이 기본 내장되어 있습니다.

충돌 카드는 severity별로 색상이 다릅니다: `high`=빨강, `medium`=주황, `caution`=노랑. 시너지는 초록 배지로 표시합니다.

**배운 점**

더미 데이터로 먼저 만들어보면 UX 흐름의 어색한 부분을 데이터 없이 빠르게 발견할 수 있습니다. 이 단계에서 "CTA 버튼 클릭 → 페이지 이동" 흐름이 불필요하다는 것을 깨달았고, 단일 페이지 아키텍처로 전환했습니다.

---

### Phase 2: DB 스키마 + 시드 인프라 (2026-04-17 ~ 2026-04-20)

**기간**: 3일  
**커밋 수**: 5개

**무슨 일이 있었는가**

8개 테이블 스키마를 설계하고 Supabase MCP를 통해 마이그레이션을 실행했습니다. 스키마 설계에서 가장 고민한 부분은 `conflict_rules` 테이블이었습니다. (ADR-003 참조)

`pg_trgm` 확장을 활성화하고 GIN 인덱스를 구성했습니다. 인덱스는 세 가지 용도로 구분됩니다:

- **제품 검색용**: `products.name`, `products.brand`, `name || ' ' || brand` (통합 검색)
- **성분 매칭용**: `ingredients.name`, `ingredients.name_en`, `ingredient_aliases.alias`
- **충돌 조회용**: `conflict_rules.ingredient_a`, `conflict_rules.ingredient_b` (양방향)

RLS(행 수준 보안) 정책을 모든 테이블에 적용했습니다. 참조 데이터 7개 테이블은 `anon` 역할로 읽기만 허용합니다. `unmatched_log`는 RLS 정책 없이 API Route의 `service_role` 클라이언트로만 접근합니다.

시드 데이터 준비는 이 단계의 가장 큰 작업이었습니다. 7종 CSV 파일을 수동으로 구성했습니다:

- `ingredients.csv`: KCIA 기준 21,805개 성분
- `products.csv`: 올리브영 상위 120개 제품
- `conflict_rules.csv`: The Ordinary 충돌 차트 기반 52개 규칙
- 나머지 4개: 그룹, 그룹-성분 매핑, 별칭, 제품-성분 매핑

시드 스크립트(`scripts/seed.ts`)는 FK 의존성 순서를 명시적으로 따릅니다.

**배운 점**

데이터 마이그레이션 과정에서 성분명 표기 방식이 달라질 때(`구연산` → `시트릭애씨드`) 연관 CSV 파일이 함께 업데이트되지 않으면 조용한 데이터 불일치가 생깁니다. 나중에 이것이 실제 버그로 이어졌습니다. (트러블슈팅 섹션 참조)

---

### Phase 3: API 구현 (2026-04-20 ~ 2026-04-21)

**기간**: 이틀  
**커밋 수**: 7개

**무슨 일이 있었는가**

세 개의 API를 구현했습니다.

**1. 제품 검색 API** (`GET /api/products/search?q={query}`)

pg_trgm 기반 한글 부분 문자열 검색. Zod로 쿼리 파라미터를 검증합니다. 빈 쿼리와 특수문자 입력을 방어합니다.

**2. 성분 매칭 API** (`POST /api/ingredients/match`)

사용자가 직접 입력한 성분 텍스트를 파싱하여 DB와 매칭합니다. 4단계 우선순위 매칭 엔진을 구현했습니다.

```
1단계: ingredients.name 정확 매칭
2단계: ingredient_aliases.alias 정확 매칭
3단계: pg_trgm 유사도 90% 이상 (fuzzy 매칭)
4단계: 매칭 실패 → unmatched_log 기록
```

전처리 단계에서 "레티놀(500IU/g)"의 농도 표기를 제거하고 공백을 정규화합니다.

**3. 충돌 분석 API** (`POST /api/analyze`)

이 API가 서비스의 핵심입니다. 처음에는 Supabase `.or()` 방식으로 구현했으나, URL 길이 초과 버그를 RPC 전환으로 해결했습니다. (ADR-002, 트러블슈팅 섹션 참조)

API 통합 테스트 결과 20/20 PASS. 응답 시간은 검색 121ms / 매칭 221ms / 분석 108ms였습니다.

**배운 점**

Supabase JavaScript 클라이언트의 `.or()` 필터는 URL 파라미터로 직렬화됩니다. 한국어 문자열 배열처럼 인코딩 후 크기가 커지는 경우 예상보다 빠르게 URL 한계에 도달합니다. 대용량 배열 필터는 처음부터 RPC를 고려해야 합니다.

---

### Phase 4: UI 데이터 연결 (2026-04-20 ~ 2026-04-21)

**기간**: 이틀  
**커밋 수**: 3개 (feat 위주)

**무슨 일이 있었는가**

Phase 1에서 더미 데이터로 동작하던 UI를 실제 API에 연결했습니다.

- 제품 검색 드롭다운 → `GET /api/products/search` 연동, 디바운스 처리
- 분석 버튼 클릭 → `POST /api/analyze` 호출
- 성분 직접 입력 다이얼로그 → `POST /api/ingredients/match` 연동
- 결과 패널 → 실제 충돌 데이터 렌더링

슬롯 A 선택 완료 시 자동으로 슬롯 B 모드로 전환되는 UX도 이 단계에서 완성되었습니다.

---

### Phase 5: 배포 및 SEO (2026-04-22)

**기간**: 반나절  
**커밋 수**: 5개

**무슨 일이 있었는가**

Vercel에 배포했습니다. GitHub 연동으로 main 브랜치 푸시 시 자동 배포됩니다. 환경 변수 3종을 등록했습니다.

SEO를 위해 openGraph와 Twitter Card 메타데이터를 추가했습니다. OG 이미지(`opengraph-image.png`)와 Twitter 이미지(`twitter-image.png`)를 App Router 컨벤션에 따라 `app/` 디렉토리에 배치했습니다.

로고 클릭 시 분석 상태를 초기화하는 기능(`RESET` 액션 디스패치)을 추가했습니다. 홈으로 돌아갈 때 이전 분석 결과가 남아있지 않도록 합니다.

**배포 주소**: https://budit.vercel.app

---

## 5. 핵심 알고리즘 설명

### 충돌 분석 알고리즘

두 제품의 성분을 비교하는 핵심 로직입니다. 단순히 성분을 1:1로 비교하지 않고, "그룹" 단위로 확장하는 것이 핵심입니다.

```
1단계: 각 슬롯의 성분 ID 확보
   - product 타입 → product_ingredients 테이블 조회
   - manual 타입 → /api/ingredients/match로 텍스트 파싱 후 DB 매칭

2단계: 각 성분의 소속 그룹명 확보
   - ingredient_group_members 테이블 조회 (성분 ID → 그룹명)

3단계: 슬롯별 텀 집합(terms) 생성
   - terms = { 개별 성분명 } ∪ { 소속 그룹명 }
   - 예) "레티놀" → terms에 "레티놀" + "레티놀 계열" 포함

4단계: analyze_conflicts RPC 호출 (POST 요청)
   - DB 함수가 내부에서 양방향 매칭 수행:
     (A의 텀 × B의 텀) OR (B의 텀 × A의 텀)

5단계: 결과 분류
   - conflict_type = 'avoid' / 'caution' → conflicts 배열
   - conflict_type = 'synergy' → synergies 배열
```

**왜 그룹 단위로 확장하는가?**

The Ordinary 충돌 차트는 개별 성분이 아닌 계열(그룹) 단위로 충돌을 정의합니다. "레티놀 계열 + AHA 계열은 사용 금지"라고 정의되면, 레티놀이 속한 계열과 글리콜산이 속한 계열을 매핑해야 합니다. 개별 성분 간 충돌 규칙을 모두 정의하는 것보다 그룹 단위로 관리하는 것이 데이터 유지보수 측면에서 훨씬 효율적입니다.

**예시**: 이니스프리 레티놀 앰플 × 메디힐 더마패드

```
슬롯 A 텀 집합:
  성분: [레티놀, 나이아신아마이드, ...]
  그룹: [레티놀 계열, ...]

슬롯 B 텀 집합:
  성분: [시트릭애씨드, 마데카소사이드, ...]
  그룹: [AHA 계열, ...]

conflict_rules 조회:
  "레티놀 계열" × "AHA 계열" = avoid, high
  → "레티놀과 AHA는 함께 사용 시 피부 자극이 우려됩니다"
```

### 성분 매칭 전략

사용자가 성분 텍스트를 직접 입력할 때, 표기 방식이 제각각입니다.

| 입력 예시               | 처리 방법                                         |
| ----------------------- | ------------------------------------------------- |
| "레티놀(500IU/g)"       | 전처리: 괄호 내 농도 제거 → "레티놀"              |
| "살리실산(BHA)"         | 전처리: 괄호 내 설명어 제거 → "살리실산"          |
| "나이아신아마이드 5%"   | 전처리: 농도 제거 → "나이아신아마이드"            |
| "구연산"                | Step 2: ingredient_aliases에서 → "시트릭애씨드"   |
| "Citric Acid"           | Step 2: ingredient_aliases에서 → "시트릭애씨드"   |
| "나이아신아마이" (오타) | Step 3: pg_trgm 90% 유사도로 → "나이아신아마이드" |
| 매칭 불가               | Step 4: unmatched_log 기록 (추후 DB 보강 대상)    |

`unmatched_log`의 `occurrence_count`를 내림차순 정렬하면 DB에 추가해야 할 성분의 우선순위를 파악할 수 있습니다.

---

## 6. 주요 트러블슈팅 기록

### 충돌 분석 미감지 버그 (2026-04-21, 약 3시간 소요)

**증상**: 이니스프리 레티놀 앰플과 메디힐 더마패드를 분석하면 "충돌 없음"이 표시됨. 이 두 제품은 AHA 계열 vs 레티놀 계열 충돌이 반드시 감지되어야 함.

이 버그는 **세 가지 독립적인 문제가 겹쳐** 발생한 것이었습니다.

#### 문제 1: 시트릭애씨드가 AHA 계열 그룹에 미등록

성분 데이터 마이그레이션 과정에서 표기 방식이 `구연산` → `시트릭애씨드`로 변경되었지만, `ingredient_group_members.csv`가 이를 반영하지 못했습니다. 시드 스크립트가 `구연산`을 찾지 못하면 경고 후 스킵하므로, 시트릭애씨드가 AHA 계열에 삽입되지 않았습니다.

추가로 `ingredient_group_members` upsert에 `onConflict`가 지정되지 않아 복합 키 테이블에서 의도대로 동작하지 않는 숨겨진 버그도 함께 발견되었습니다.

```typescript
// 버그: onConflict 미지정
await supabase.from("ingredient_group_members").upsert(rows, {
  ignoreDuplicates: true,
});

// 수정: 복합 키 명시
await supabase.from("ingredient_group_members").upsert(rows, {
  onConflict: "group_id,ingredient_id",
  ignoreDuplicates: true,
});
```

#### 문제 2: 레티놀이 AHA 계열에 잘못 등록된 DB 오염

과거 어느 시점에 `레티놀 → AHA 계열` 매핑이 잘못 삽입되어 있었습니다. `upsert + ignoreDuplicates` 전략은 "없으면 삽입, 있으면 무시"이므로, 잘못된 기존 레코드는 시드 재실행으로 제거되지 않습니다.

SQL로 직접 삭제 후 시드 재실행으로 해결했습니다.

#### 문제 3: URL 길이 초과로 충돌 조회 쿼리 조용히 실패 (핵심 버그)

두 문제를 모두 수정하고 나서도 여전히 "충돌 없음"이 표시되었습니다. `console.log`로 서버 로그를 확인하자 Supabase가 다음 에러를 반환하고 있었습니다:

```
hint: "HTTP headers exceeded server limits (typically 16KB).
Your request URL is 10101 characters.
If filtering with large arrays, consider using an RPC function instead."
```

Supabase `.or()` 방식으로 성분명 배열을 URL 파라미터로 전달하면, 한국어 문자열이 퍼센트 인코딩되면서 URL이 급격히 길어집니다. Supabase는 에러를 조용히 반환(`data = null`)하고, 코드는 이를 "충돌 없음"으로 해석했습니다.

이 문제를 해결하기 위해 PostgreSQL 함수를 생성하고 `.rpc()` 호출로 전환했습니다. (ADR-002 참조)

**정립된 규칙**:

1. 외부 API 호출 결과는 항상 `error` 체크 후 명시적으로 로깅한다.
2. 복합 키 테이블에 upsert할 때는 `onConflict`를 반드시 명시한다.
3. 한국어 문자열 배열을 10개 이상 필터 조건으로 사용할 때는 RPC를 기본으로 선택한다.
4. 시드 데이터 마이그레이션 시 참조 무결성 검증(에러로 중단)을 사전에 수행한다.

자세한 내용은 `docs/troubleshooting/2026-04-21-conflict-analysis-fix.md`를 참조하세요.

---

## 7. 데이터 인프라

### 제품 DB: 올리브영 상위 120개 제품

올리브영 랭킹 기준 4개 카테고리에서 각 30개를 수동으로 수집했습니다.

| 카테고리  | 수집 기준               |
| --------- | ----------------------- |
| skincare  | 스킨케어 랭킹 상위 30개 |
| mask_pack | 마스크팩 랭킹 상위 30개 |
| cleansing | 클렌징 랭킹 상위 30개   |
| suncare   | 선케어 랭킹 상위 30개   |

각 제품의 전성분 텍스트를 올리브영 상품 상세 페이지 > 상품정보 제공고시에서 직접 수집했습니다.

### 성분 DB: KCIA 21,805개 성분

대한화장품협회(KCIA) 화장품성분사전 기준으로 21,805개 성분을 구축했습니다. 한국어 표준명(`name`)과 영문 INCI명(`name_en`)을 함께 저장합니다.

### 충돌 규칙 DB: The Ordinary 충돌 차트 기반 52개 규칙

The Ordinary의 공식 성분 충돌 차트를 기반으로 핵심 규칙을 구축했습니다. 현재 18개 성분 그룹과 52개 충돌/시너지 규칙이 등록되어 있습니다.

| 규칙 유형 | 설명                                   |
| --------- | -------------------------------------- |
| avoid     | 함께 사용 금지 (피부 자극, 효과 감소)  |
| caution   | 주의 필요 (민감한 경우 분리 사용 권장) |
| synergy   | 시너지 (함께 사용 시 효과 증대)        |

추후 Paula's Choice, 피부과학 문헌으로 규칙을 확장할 수 있습니다.

### 시드 실행 순서

FK 의존성을 고려한 필수 실행 순서입니다:

```
ingredients
  → ingredient_groups
    → ingredient_group_members
    → ingredient_aliases
products
  → product_ingredients
conflict_rules  (독립적, 마지막에 실행)
```

### 시드 스크립트 실행

```bash
# scripts/seed.ts
pnpm tsx scripts/seed.ts
```

시드 전 FK 참조 무결성 검증이 수행됩니다. 참조 불일치 시 에러로 중단됩니다.

---

## 8. 현재 상태 및 남은 작업

### 현재까지 완료된 작업 (22/26)

| Phase   | 내용                                  | 상태      |
| ------- | ------------------------------------- | --------- |
| Phase 0 | 프로젝트 초기 설정                    | 완료      |
| Phase 1 | 목업 UI (인터랙티브 프로토타입)       | 완료      |
| Phase 2 | DB 스키마 + 시드 인프라               | 완료      |
| Phase 3 | API 3개 구현                          | 완료      |
| Phase 4 | UI 레이아웃 + 분석 검색               | 완료      |
| Phase 5 | UI 분석 결과 + 성분 직접 입력         | 일부 완료 |
| Phase 6 | 반응형 + 다크모드 + E2E 테스트 + 배포 | 일부 완료 |

서비스는 https://budit.vercel.app 에서 라이브로 운영 중입니다. 핵심 기능(제품 검색, 충돌 분석, 성분 직접 입력)은 모두 동작합니다.

### 남은 작업

**Task 021: 사용자 플로우 통합 테스트** (Phase 5)

- Playwright MCP를 사용한 전체 사용자 여정 E2E 테스트
- 시나리오: 제품 검색 → 슬롯 선택 → 분석 → 결과 → 돌아가기

**Task 022: 반응형 디자인 완성** (Phase 6)

- 데스크탑 우선(Desktop First) 전략
- 브레이크포인트: 1280px → 768px → 375px

**Task 023: 다크모드 완성** (Phase 6)

- 모든 컴포넌트 다크모드 스타일 검증
- 충돌 카드 severity 색상 다크모드 대응

**Task 024: E2E 테스트 스위트 작성** (Phase 6)

- Playwright 테스트 환경 설정
- 전체 분석 플로우 + 반응형 + 다크모드 테스트

### 알려진 성능 이슈 및 개선 계획

`POST /api/analyze`에서 manual 타입 슬롯(성분 직접 입력)의 경우 2~3초의 지연이 발생합니다.

**원인**: `lib/analyze/match.ts`의 4단계 매칭 엔진에서 fuzzy 매칭 RPC를 성분마다 순차 호출합니다. 미매칭 성분 10개 기준 Step 3만 약 1초 누적됩니다.

**개선 방향** (`docs/todo/performance-analyze-api.md` 참조):

- Step 3 fuzzy 매칭을 `Promise.all()`로 병렬화 (예상 단축: 500~900ms)
- Step 4 `log_unmatched` 병렬화 (예상 단축: 100~300ms)
- 배치 fuzzy 매칭 RPC 도입으로 네트워크 왕복 횟수 1회로 축소

목표: 2~3초 → 1초 이내

---

## 9. 온보딩 가이드

### 사전 요구사항

- Node.js 18 이상
- pnpm (`npm install -g pnpm`)
- Supabase 계정 및 프로젝트

### 로컬 실행 순서

**1. 저장소 클론 및 의존성 설치**

```bash
git clone <repository-url>
cd budit-app
pnpm install
```

**2. 환경 변수 설정**

`.env.example`을 복사하여 `.env.local`을 생성합니다:

```bash
cp .env.example .env.local
```

`.env.local`에 Supabase 프로젝트 정보를 입력합니다:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 대시보드 > Project Settings > API > Project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: anon 키 (public)
- `SUPABASE_SERVICE_ROLE_KEY`: service_role 키 (서버 전용, 절대 클라이언트에 노출하지 말 것)

**3. DB 마이그레이션**

Supabase MCP 또는 Supabase 대시보드 SQL 에디터에서 마이그레이션을 실행합니다. 마이그레이션 파일은 Supabase MCP로 관리됩니다.

**4. 시드 데이터 투입**

```bash
pnpm tsx scripts/seed.ts
```

FK 의존성 순서에 따라 7개 테이블에 데이터가 삽입됩니다. 완료 시 각 테이블의 행 수를 출력합니다.

**5. 개발 서버 실행**

```bash
pnpm dev
```

http://localhost:3000 에서 확인합니다.

### 주요 명령어

```bash
pnpm dev        # 개발 서버 시작 (localhost:3000)
pnpm build      # 프로덕션 빌드
pnpm start      # 프로덕션 서버 시작
pnpm lint       # ESLint 실행
```

### 코드 구조 한눈에 보기

```
budit-app/
├── app/
│   ├── page.tsx                    # 메인 페이지 (랜딩 + 분석 플로우)
│   ├── layout.tsx                  # 루트 레이아웃 (ThemeProvider)
│   ├── globals.css                 # 브랜드 컬러 CSS 변수
│   ├── analyze/page.tsx            # /analyze → / 리다이렉트
│   ├── api/
│   │   ├── products/search/        # GET: pg_trgm 제품 검색
│   │   ├── ingredients/match/      # POST: 성분 텍스트 매칭
│   │   └── analyze/                # POST: 충돌 분석
│   └── auth/                       # 인증 라우트 (MVP에서 보호 해제)
│
├── components/
│   ├── analyze/
│   │   ├── analyze-container.tsx   # 분석 플로우 최상위 (useReducer)
│   │   ├── step-indicator.tsx      # 슬롯 A/B 단계 표시
│   │   ├── product-search.tsx      # Command 기반 검색 드롭다운
│   │   ├── result-panel.tsx        # 분석 결과 패널
│   │   ├── conflict-card.tsx       # 충돌 카드 (severity별 색상)
│   │   └── manual-input-dialog.tsx # 성분 직접 입력 다이얼로그
│   ├── landing/
│   │   ├── hero-section.tsx        # 브랜딩 히어로 섹션
│   │   └── how-it-works.tsx        # 3단계 사용법 안내
│   └── layout/
│       └── header.tsx              # 로고 + 다크모드 토글
│
├── lib/
│   ├── analyze/
│   │   ├── conflict.ts             # analyzeConflicts() — RPC 호출
│   │   └── match.ts                # matchIngredients() — 4단계 매칭
│   ├── supabase/
│   │   ├── server.ts               # 서버 컴포넌트용 클라이언트
│   │   └── client.ts               # 클라이언트 컴포넌트용 클라이언트
│   └── database.types.ts           # Supabase 자동 생성 타입
│
├── data/
│   └── csv/                        # 7종 시드 CSV 파일
│
├── docs/
│   ├── PRD.md                      # 제품 요구사항 문서
│   ├── ROADMAP.md                  # 개발 로드맵 및 태스크 관리
│   ├── DB_SCHEMA.md                # DB 스키마 상세 설계
│   ├── LEANCANVAS.md               # 린 캔버스 (비즈니스 모델)
│   ├── UPDATE.md                   # 이 문서 — 개발 히스토리
│   ├── troubleshooting/            # 트러블슈팅 기록
│   └── todo/                       # 성능 개선 등 미해결 이슈
│
├── proxy.ts                        # Next.js 미들웨어 (세션 갱신)
└── scripts/
    └── seed.ts                     # 시드 스크립트
```

### 자주 묻는 질문

**Q. `/analyze`로 접속하면 왜 `/`로 리다이렉트되나요?**

A. 단일 페이지 아키텍처 결정(ADR-001)에 따라 모든 분석 플로우가 `/`에서 동작합니다. 기존 URL을 공유받은 사용자도 서비스를 사용할 수 있도록 리다이렉트를 유지합니다.

**Q. `getClaims()`를 `getUser()`로 바꾸면 안 되나요?**

A. `getClaims()`는 네트워크 호출 없이 로컬에서 JWT를 파싱합니다. `getUser()`는 매 요청마다 Supabase Auth 서버를 호출하므로 느립니다. 또한 `proxy.ts` 미들웨어에서 `getClaims()` 호출을 제거하면 SSR 시 사용자가 무작위로 로그아웃될 수 있습니다. 절대 제거하지 마세요.

**Q. 성분 매칭이 느린데 왜 그런가요?**

A. manual 타입 슬롯은 4단계 매칭 엔진을 순차 실행합니다. 특히 fuzzy 매칭 RPC를 성분마다 개별 호출하는 것이 병목입니다. `Promise.all()` 병렬화로 개선 예정입니다. (`docs/todo/performance-analyze-api.md` 참조)

**Q. 새로운 충돌 규칙을 추가하려면 어떻게 하나요?**

A. `data/csv/conflict_rules.csv`에 행을 추가하고 시드 스크립트를 재실행합니다. `ingredient_a < ingredient_b` (가나다/알파벳 오름차순)의 canonical 순서를 지켜야 합니다. 삽입 전 시드 스크립트가 자동으로 정렬합니다.

---

_마지막 업데이트: 2026-04-23_  
_기준 커밋: `6df9651` (로고 클릭 시 분석 상태 초기화 기능 추가)_
