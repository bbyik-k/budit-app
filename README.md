# 부딪 (Budit)

> 민감성 피부를 위한 화장품 성분 충돌 분석 서비스

두 화장품의 성분을 비교하여 충돌 여부를 즉시 확인하세요.  
The Ordinary 충돌 차트 기반 과학적 분석으로 피부 트러블을 예방합니다.

---

## 주요 기능

| 기능               | 설명                                                                       |
| ------------------ | -------------------------------------------------------------------------- |
| **제품 검색**      | pg_trgm 기반 한글 부분 문자열 검색, 올리브영 상위 120개 제품 탐색          |
| **성분 충돌 분석** | 두 제품의 성분을 그룹 단위로 매핑, The Ordinary 차트 기반 충돌·시너지 판별 |
| **성분 직접 입력** | DB에 없는 제품도 성분 텍스트를 붙여넣어 분석 가능                          |
| **결과 시각화**    | severity별 색상 코딩된 충돌 카드와 루틴 분리 권장사항 제공                 |

---

## 스크린샷

```
랜딩 페이지 (/)                    분석 페이지 (/analyze)
┌─────────────────────┐            ┌─────────────────────┐
│  [부딪 로고]  [🌙]  │            │  [부딪 로고]  [🌙]  │
├─────────────────────┤            ├─────────────────────┤
│                     │            │  슬롯 A ●──── 슬롯 B │
│  피부 트러블,        │            ├─────────────────────┤
│  미리 막으세요.      │            │  🔍 제품명 검색...   │
│                     │            │  ┌─────────────────┐ │
│  [지금 분석하기 →]  │            │  │ 검색 결과 목록  │ │
│                     │            │  └─────────────────┘ │
├─────────────────────┤            │                     │
│  How It Works       │            │  [성분 직접 입력]    │
│  1. 제품 선택        │            │                     │
│  2. 충돌 분석        │            │ [성분 충돌 분석 ▶]  │
│  3. 결과 확인        │            └─────────────────────┘
└─────────────────────┘
```

---

## 기술 스택

**프론트엔드**

- [Next.js 15](https://nextjs.org) (App Router) + React 19 + TypeScript
- [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) (new-york)
- [Lucide React](https://lucide.dev) + [next-themes](https://github.com/pacocoursey/next-themes)

**백엔드 / 데이터베이스**

- [Supabase](https://supabase.com) (PostgreSQL + `pg_trgm` 확장)
- GIN 트라이그램 인덱스로 한글 부분 문자열 검색 최적화

**상태 관리 / 검증**

- `useReducer` (외부 라이브러리 없음)
- [Zod](https://zod.dev) — API 스키마 검증

**패키지 관리 / 배포**

- [pnpm](https://pnpm.io) + [Vercel](https://vercel.com)

---

## 아키텍처

### 페이지 구조

```
/           랜딩 페이지 (Server Component)
             └── HeroSection + AnalyzeContainer + HowItWorks

/analyze    분석 페이지 (Server Shell + Client Container)
             └── AnalyzeContainer (useReducer 상태 관리)
                  ├── StepIndicator       슬롯 A/B 단계 표시
                  ├── ProductSearch       pg_trgm 기반 검색 UI
                  ├── ManualInputDialog   성분 직접 입력
                  ├── ResultPanel         분석 결과 패널
                  └── ConflictCard        충돌 카드 (severity별 색상)
```

### 분석 플로우

```
select-a → select-b → ready → analyzing → result
   │           │        │          │          │
슬롯 A      슬롯 B   분석 버튼   API 호출   결과 표시
검색/선택  검색/선택   활성화     /analyze   충돌 카드
```

### 충돌 분석 알고리즘

```
1. 각 슬롯의 성분 ID 확보
   - product 타입: product_ingredients 테이블 조회
   - manual 타입: /api/ingredients/match 로 텍스트 파싱 + DB 매칭

2. 각 성분의 소속 그룹 확보
   - ingredient_group_members 테이블 조회

3. 슬롯별 텀 집합 생성
   - 텀 집합 = 개별 성분명 ∪ 소속 그룹명

4. conflict_rules 양방향 조회 (RPC)
   - 슬롯 A 텀 × 슬롯 B 텀 조합으로 충돌 규칙 검색

5. 결과 분류
   - avoid / caution → conflicts 배열 (충돌 카드)
   - synergy → synergies 배열 (시너지 하이라이트)
```

---

## API 명세

### `GET /api/products/search?q={query}`

pg_trgm 기반 제품 검색, 상위 10개 결과 반환

```json
// 응답
[
  {
    "id": "uuid",
    "name": "코스알엑스 어드밴스드 스네일 뮤신",
    "brand": "COSRX",
    "category": "skincare",
    "image_url": "https://..."
  }
]
```

### `POST /api/ingredients/match`

성분 텍스트 파싱 및 DB 매칭 (4단계: 정확 매칭 → 별칭 → pg_trgm 유사도 90%↑ → unmatched_log)

```json
// 요청
{ "ingredients": ["레티놀(500IU/g)", "나이아신아마이드", "글리콜산"] }

// 응답
{
  "matched": [
    { "rawName": "레티놀(500IU/g)", "standardName": "레티놀", "id": "uuid" }
  ],
  "unmatched": ["알 수 없는 성분명"]
}
```

### `POST /api/analyze`

핵심 충돌 분석 API

```json
// 요청
{
  "slotA": { "type": "product", "productId": "uuid" },
  "slotB": { "type": "manual", "ingredients": ["레티놀", "AHA"] }
}

// 응답
{
  "conflicts": [
    {
      "ingredientA": "레티놀 계열",
      "ingredientB": "AHA 계열",
      "conflictType": "avoid",
      "severity": "high",
      "reasonKo": "레티놀과 AHA를 함께 사용하면 자극이 강해질 수 있습니다.",
      "recommend": "AM/PM으로 루틴을 분리하세요."
    }
  ],
  "synergies": [...],
  "productA": { "name": "...", "ingredients": [...] },
  "productB": { "name": "...", "ingredients": [...] }
}
```

---

## 데이터베이스 스키마

```
products              ─┐
  id, name, brand      │
  category             │
  raw_ingredients_text │
                       ├── product_ingredients ──► ingredients
ingredient_groups     ─┤     product_id              id, name (KCIA 표준명)
  id, group_name       │     ingredient_id            name_en (INCI명)
                       │     display_order             category
ingredient_group_members    raw_name             ◄─── ingredient_aliases
  group_id                                             alias → ingredient_id
  ingredient_id        conflict_rules
                         ingredient_a (그룹명 or 성분명)
                         ingredient_b
                         conflict_type: avoid | caution | synergy
                         severity: high | medium | low
                         reason_ko, recommend
```

**인덱스**: `products.name`, `products.brand`, `ingredients.name` — GIN 트라이그램 인덱스 적용

---

## 로컬 개발 환경 설정

### 사전 요구사항

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Supabase 계정 및 프로젝트

### 1. 저장소 클론

```bash
git clone https://github.com/bbyik-k/budit-app.git
cd budit-app
pnpm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 아래 값을 입력합니다:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

> Supabase 대시보드의 **Project Settings → API** 에서 확인할 수 있습니다.

### 3. 개발 서버 실행

```bash
pnpm dev
```

`http://localhost:3000` 에서 확인합니다.

---

## 시드 데이터 투입

데이터베이스에 초기 데이터를 삽입하려면:

```bash
pnpm tsx scripts/seed.ts
```

삽입 순서 (FK 의존성 고려):

```
ingredients → ingredient_groups → ingredient_group_members
           → ingredient_aliases → products → product_ingredients
           → conflict_rules
```

**포함된 데이터**:

- `ingredients.csv` — KCIA 기준 성분 21,805개
- `products.csv` — 올리브영 상위 120개 제품 (스킨케어/마스크팩/클렌징/선케어 각 30개)
- `conflict_rules.csv` — The Ordinary 충돌 차트 기반 규칙 52개
- `ingredient_groups.csv` — 핵심 성분 그룹 18종

---

## 프로젝트 구조

```
budit-app/
├── app/
│   ├── page.tsx                    랜딩 페이지
│   ├── analyze/page.tsx            분석 페이지
│   ├── layout.tsx                  루트 레이아웃
│   └── api/
│       ├── products/search/        제품 검색 API
│       ├── ingredients/match/      성분 매칭 API
│       └── analyze/                충돌 분석 API
├── components/
│   ├── analyze/
│   │   ├── analyze-container.tsx   상태 관리 최상위 컨테이너
│   │   ├── step-indicator.tsx      슬롯 A/B 단계 표시
│   │   ├── product-search.tsx      검색 UI (shadcn/ui Command)
│   │   ├── result-panel.tsx        분석 결과 패널
│   │   ├── conflict-card.tsx       충돌 카드
│   │   └── manual-input-dialog.tsx 성분 직접 입력 다이얼로그
│   ├── landing/
│   │   ├── hero-section.tsx        히어로 섹션
│   │   └── how-it-works.tsx        3단계 사용법 안내
│   ├── layout/
│   │   └── header.tsx              공통 헤더
│   └── ui/                         shadcn/ui 기본 컴포넌트
├── lib/
│   ├── supabase/
│   │   ├── client.ts               브라우저 클라이언트
│   │   └── server.ts               서버 클라이언트
│   ├── database.types.ts           Supabase 자동 생성 타입
│   └── utils.ts                    cn() 헬퍼
├── data/csv/                       시드 데이터 CSV 7종
├── scripts/seed.ts                 시드 스크립트
├── docs/
│   ├── PRD.md                      제품 요구사항 문서
│   └── ROADMAP.md                  개발 로드맵
└── proxy.ts                        Next.js 미들웨어 (세션 관리)
```

---

## 개발 명령어

```bash
pnpm dev        # 개발 서버 시작
pnpm build      # 프로덕션 빌드
pnpm start      # 프로덕션 서버 시작
pnpm lint       # ESLint 실행
```

---

## 개발 현황

| Phase   | 내용                                  | 상태    |
| ------- | ------------------------------------- | ------- |
| Phase 0 | 프로젝트 초기 설정                    | ✅ 완료 |
| Phase 1 | 목업 UI (인터랙티브 프로토타입)       | ✅ 완료 |
| Phase 2 | DB 스키마 + 시드 인프라               | ✅ 완료 |
| Phase 3 | API 3개 구현                          | ✅ 완료 |
| Phase 4 | UI 레이아웃 + 랜딩 + 분석 검색        | ✅ 완료 |
| Phase 5 | UI 분석 결과 + 성분 직접 입력         | ✅ 완료 |
| Phase 6 | 반응형 + 다크모드 + E2E 테스트 + 배포 | 진행 중 |

---

## 라이선스

MIT
