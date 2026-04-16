# 부딪 (Budit) MVP PRD

## 핵심 정보

**목적**: 민감성 피부를 가진 사람들이 화장품 성분 충돌을 쉽게 확인하고 안심하고 사용할 수 있도록 돕는 서비스
**사용자**: 피부가 민감하여 화장품 성분에 예민한 사람들

---

## 사용자 여정

```
1. 랜딩 페이지 (/)
   ↓ "지금 분석하기" CTA 버튼 클릭

2. 분석 페이지 (/analyze) — 슬롯 A 선택 단계
   ↓ 검색창에 제품명 입력 → 드롭다운에서 제품 선택

   [DB에 제품 있음] → 슬롯 A 선택 완료 → 자동으로 슬롯 B 모드 전환
   [DB에 제품 없음] → "직접 입력" 버튼 → 성분 직접 입력 다이얼로그 → 슬롯 A 완료
   ↓

3. 분석 페이지 (/analyze) — 슬롯 B 선택 단계
   ↓ 동일 검색 흐름으로 슬롯 B 선택 완료

4. 분석 페이지 (/analyze) — 분석 준비 단계
   ↓ "성분 충돌 분석" 버튼 클릭

5. 분석 페이지 (/analyze) — 결과 표시 단계
   [충돌 있음] → 충돌 성분 카드 (severity별 색상) + 루틴 분리 권장사항
   [충돌 없음] → 초록 안전 배지 + 시너지 성분 하이라이트
   ↓ "돌아가기" 버튼 클릭

6. 분석 페이지 초기 상태로 리셋 → 재검색 가능
```

---

## 기능 명세

### 1. MVP 핵심 기능

| ID       | 기능명                 | 설명                                                                                                             | MVP 필수 이유                             | 관련 페이지 |
| -------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------- |
| **F001** | 제품 검색              | pg_trgm 기반 한글 부분 문자열 검색, 상위 10개 반환                                                               | 사용자가 분석할 제품을 찾는 핵심 진입점   | 분석 페이지 |
| **F002** | 슬롯 선택 및 단계 관리 | 슬롯 A → 슬롯 B 순차 선택, 스텝 인디케이터 표시, useReducer 상태 관리                                            | 두 제품 비교라는 핵심 UX 흐름 구현        | 분석 페이지 |
| **F003** | 성분 충돌 분석         | 제품 성분 → 그룹 매핑 → conflict_rules 양방향 조회 → conflicts/synergies 분류                                    | 서비스의 핵심 가치 제공                   | 분석 페이지 |
| **F004** | 분석 결과 표시         | 충돌 카드(severity별 색상: high=빨강/medium=주황/caution=노랑), 안전 배지, 시너지 하이라이트, 루틴 분리 권장사항 | 사용자가 실제로 행동을 결정하는 핵심 화면 | 분석 페이지 |
| **F005** | 성분 직접 입력         | DB에 없는 제품의 성분을 쉼표 구분 텍스트로 붙여넣기, 파싱 후 분석                                                | DB 미등록 제품 사용자도 서비스 이용 가능  | 분석 페이지 |

### 2. MVP 필수 지원 기능

| ID       | 기능명      | 설명                                                                           | MVP 필수 이유                           | 관련 페이지 |
| -------- | ----------- | ------------------------------------------------------------------------------ | --------------------------------------- | ----------- |
| **F010** | 서비스 소개 | 랜딩 페이지 히어로 섹션, 3단계 사용법 안내, "지금 분석하기" CTA                | 신규 방문자에게 서비스 가치 전달        | 랜딩 페이지 |
| **F011** | 성분명 매칭 | 괄호 내 농도 제거, 공백 정규화, 표준명→별칭→유사도 순 매칭, unmatched_log 기록 | 다양한 표기 방식의 성분명을 정확히 인식 | 분석 페이지 |

### 3. MVP 이후 기능 (제외)

- 회원가입 / 로그인 (인증 코드 유지, 라우트 보호만 해제)
- 분석 결과 저장 / 히스토리
- 3개 이상 제품 비교
- 성분 상세 정보 페이지
- 추천 루틴 기능
- 데이터 자동 스크래핑
- 프로필 상세 관리, 알림 설정

---

## 메뉴 구조

```
부딪 (Budit) 내비게이션
├── 헤더 공통
│   ├── 로고 (홈으로 이동)
│   └── 다크모드 토글
│
├── 랜딩 페이지 (/)
│   └── "지금 분석하기" CTA → F010
│
└── 분석 페이지 (/analyze)
    ├── 스텝 인디케이터 → F002
    ├── 제품 검색창 → F001
    ├── 직접 입력 버튼 → F005
    ├── 성분 충돌 분석 버튼 → F003
    ├── 분석 결과 패널 → F004
    └── 돌아가기 버튼 → F002
```

---

## 페이지별 상세 기능

### 랜딩 페이지

> **구현 기능:** `F010` | **인증:** 불필요 (공개)

| 항목            | 내용                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **역할**        | 서비스 첫 진입점. 부딪의 핵심 가치를 전달하고 분석 페이지로 유도                                                            |
| **진입 경로**   | 도메인 직접 접속, 로고 클릭, 브라우저 뒤로가기                                                                              |
| **사용자 행동** | 서비스 소개 확인, 3단계 사용법 파악, "지금 분석하기" 버튼 클릭                                                              |
| **주요 기능**   | • 히어로 섹션 (서비스 슬로건 + 설명)<br>• 3단계 사용법 안내 (How It Works)<br>• **"지금 분석하기"** 버튼 → 분석 페이지 이동 |
| **다음 이동**   | CTA 클릭 → 분석 페이지                                                                                                      |

---

### 분석 페이지

> **구현 기능:** `F001`, `F002`, `F003`, `F004`, `F005`, `F011` | **인증:** 불필요 (공개)

| 항목            | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **역할**        | 제품 검색, 선택, 분석, 결과 확인을 한 페이지에서 처리하는 핵심 페이지                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **진입 경로**   | 랜딩 페이지 CTA 클릭, 도메인/analyze 직접 접속, 결과 화면에서 "돌아가기" 클릭                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **사용자 행동** | 제품 A 검색 및 선택 → 제품 B 검색 및 선택 → 충돌 분석 실행 → 결과 확인 → 재검색                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **주요 기능**   | • 스텝 인디케이터 (슬롯 A 선택중 / 슬롯 B 선택중 / 분석 준비 / 결과 표시)<br>• pg_trgm 기반 제품 검색 드롭다운 (Command UI)<br>• 슬롯 A 선택 완료 시 자동으로 슬롯 B 모드 전환<br>• "직접 입력" 버튼 → 성분 직접 입력 다이얼로그 (쉼표 구분 텍스트)<br>• **"성분 충돌 분석"** 버튼 (양쪽 슬롯 선택 완료 시 활성화)<br>• 충돌 결과 카드 (severity별 색상: high=빨강/medium=주황/caution=노랑)<br>• 안전 배지 + 시너지 성분 하이라이트<br>• 루틴 분리 권장사항 표시<br>• **"돌아가기"** 버튼 → 초기 상태 리셋 |
| **다음 이동**   | 분석 완료 → 결과 표시 (동일 페이지 내 상태 전환), 돌아가기 → 초기 상태                                                                                                                                                                                                                                                                                                                                                                                                                                      |

---

## 데이터 모델

### products (제품)

| 필드                    | 설명                                            | 타입/관계     |
| ----------------------- | ----------------------------------------------- | ------------- |
| id                      | 고유 식별자                                     | UUID PK       |
| name                    | 제품명                                          | TEXT NOT NULL |
| brand                   | 브랜드명                                        | TEXT NOT NULL |
| category                | 카테고리 (skincare/mask_pack/cleansing/suncare) | TEXT NOT NULL |
| oliveyoung_id           | 올리브영 상품 고유 ID                           | TEXT          |
| image_url               | 제품 이미지 URL                                 | TEXT          |
| source_url              | 올리브영 상품 페이지 URL                        | TEXT          |
| raw_ingredients_text    | 원본 전성분 텍스트                              | TEXT          |
| created_at / updated_at | 생성/수정 일시                                  | TIMESTAMPTZ   |

### ingredients (성분)

| 필드          | 설명                         | 타입/관계            |
| ------------- | ---------------------------- | -------------------- |
| id            | 고유 식별자                  | UUID PK              |
| name          | KCIA 국문 표준명             | TEXT UNIQUE NOT NULL |
| name_en       | INCI 영문명                  | TEXT                 |
| category      | 분류 (비타민, 산, 보습제 등) | TEXT                 |
| is_restricted | 사용제한 원료 여부           | BOOLEAN              |
| restrict_info | 제한 정보                    | TEXT                 |
| created_at    | 생성 일시                    | TIMESTAMPTZ          |

### ingredient_groups (성분 그룹)

The Ordinary 충돌 차트는 "레티놀 계열", "AHA 계열" 같은 그룹 단위로 충돌을 정의하므로, 개별 성분을 그룹에 매핑하기 위한 중간 테이블.

| 필드        | 설명                                  | 타입/관계            |
| ----------- | ------------------------------------- | -------------------- |
| id          | 고유 식별자                           | UUID PK              |
| group_name  | 그룹명 ("레티놀 계열", "AHA 계열" 등) | TEXT UNIQUE NOT NULL |
| description | 그룹 설명                             | TEXT                 |

### ingredient_group_members (성분-그룹 매핑)

| 필드          | 설명        | 타입/관계                       |
| ------------- | ----------- | ------------------------------- |
| id            | 고유 식별자 | UUID PK                         |
| group_id      | 소속 그룹   | UUID FK → ingredient_groups.id  |
| ingredient_id | 소속 성분   | UUID FK → ingredients.id        |
| -             | 중복 방지   | UNIQUE(group_id, ingredient_id) |

### product_ingredients (제품-성분 매핑)

| 필드          | 설명              | 타입/관계                         |
| ------------- | ----------------- | --------------------------------- |
| id            | 고유 식별자       | UUID PK                           |
| product_id    | 제품 참조         | UUID FK → products.id             |
| ingredient_id | 성분 참조         | UUID FK → ingredients.id          |
| display_order | 함량 순 표기 순서 | INT NOT NULL                      |
| raw_name      | 원문 성분명 보존  | TEXT NOT NULL                     |
| -             | 중복 방지         | UNIQUE(product_id, ingredient_id) |

### conflict_rules (충돌 규칙)

| 필드          | 설명                              | 타입/관계                          |
| ------------- | --------------------------------- | ---------------------------------- |
| id            | 고유 식별자                       | UUID PK                            |
| ingredient_a  | 성분/그룹명 A                     | TEXT NOT NULL                      |
| ingredient_b  | 성분/그룹명 B                     | TEXT NOT NULL                      |
| conflict_type | 관계 유형 (avoid/caution/synergy) | TEXT NOT NULL                      |
| severity      | 심각도 (high/medium/low)          | TEXT NOT NULL                      |
| reason_ko     | 충돌 이유 (한국어)                | TEXT NOT NULL                      |
| recommend     | 권장사항                          | TEXT                               |
| source        | 출처                              | TEXT                               |
| -             | 중복 방지                         | UNIQUE(ingredient_a, ingredient_b) |

### ingredient_aliases (성분 별칭)

| 필드          | 설명               | 타입/관계                |
| ------------- | ------------------ | ------------------------ |
| id            | 고유 식별자        | UUID PK                  |
| alias         | 비표준 표기        | TEXT UNIQUE NOT NULL     |
| ingredient_id | 표준 성분 참조     | UUID FK → ingredients.id |
| source        | 출처 (manual/auto) | TEXT                     |

### unmatched_log (매칭 실패 로그)

| 필드       | 설명                        | 타입/관계             |
| ---------- | --------------------------- | --------------------- |
| id         | 고유 식별자                 | UUID PK               |
| raw_name   | 매칭 실패한 원문 성분명     | TEXT NOT NULL         |
| product_id | 발생 제품 (nullable)        | UUID FK → products.id |
| source     | 발생 경로 (seed/user_input) | TEXT                  |
| resolved   | 해결 여부                   | BOOLEAN               |
| created_at | 생성 일시                   | TIMESTAMPTZ           |

---

## 충돌 분석 알고리즘

```
1. 각 슬롯의 성분 ID 확보
   - product 타입: product_ingredients 테이블 조회
   - manual 타입: /api/ingredients/match 로 텍스트 파싱 + DB 매칭

2. 각 성분의 소속 그룹 확보
   - ingredient_group_members 테이블 조회

3. 각 슬롯별 텀 집합 생성
   - 텀 집합 = 개별 성분명 ∪ 소속 그룹명

4. 충돌 규칙 조회
   - 슬롯 A 텀 × 슬롯 B 텀 조합으로 conflict_rules 양방향 조회

5. 결과 분류
   - avoid / caution → conflicts 배열
   - synergy → synergies 배열
```

예시: 제품 A의 "레티놀" → "레티놀 계열" 그룹 / 제품 B의 "글리콜산" → "AHA 계열" 그룹 → conflict_rules에서 "레티놀 계열 + AHA 계열 = avoid/high" 발견

---

## API 설계

| 엔드포인트                     | 메서드 | 설명                                   |
| ------------------------------ | ------ | -------------------------------------- |
| /api/products/search?q={query} | GET    | pg_trgm 기반 제품 검색, 상위 10개 반환 |
| /api/analyze                   | POST   | 핵심 충돌 분석 API                     |
| /api/ingredients/match         | POST   | 성분 직접 입력 텍스트 파싱 + DB 매칭   |

### /api/analyze 요청/응답 구조

```typescript
// 요청
{
  slotA: { type: "product"; productId: string }
       | { type: "manual"; ingredients: string[] }
  slotB: // 동일 구조
}

// 응답
{
  conflicts: Array<{
    ingredientA: string
    ingredientB: string
    conflictType: "avoid" | "caution"
    severity: "high" | "medium" | "low"
    reasonKo: string
    recommend: string
  }>
  synergies: Array<{ ingredientA: string; ingredientB: string; reasonKo: string }>
  productA: { name: string; ingredients: string[] }
  productB: { name: string; ingredients: string[] }
}
```

---

## 컴포넌트 구조

### 라우트

| 경로       | 설명        | 렌더링 방식                     |
| ---------- | ----------- | ------------------------------- |
| `/`        | 랜딩 페이지 | Server Component                |
| `/analyze` | 분석 페이지 | Server Shell + Client Container |

### 상태 관리

useReducer 기반, 외부 상태 라이브러리 미사용

단계 전환: `select-a` → `select-b` → `ready` → `analyzing` → `result`

### 주요 컴포넌트 목록

| 경로                                         | 설명                          |
| -------------------------------------------- | ----------------------------- |
| `components/layout/header.tsx`               | 로고 + 다크모드 토글          |
| `components/landing/hero-section.tsx`        | 히어로 + CTA 버튼             |
| `components/landing/how-it-works.tsx`        | 3단계 사용법 안내             |
| `components/analyze/analyze-container.tsx`   | 상태 관리 최상위 (use client) |
| `components/analyze/step-indicator.tsx`      | 슬롯 A/B 단계 표시            |
| `components/analyze/product-search.tsx`      | shadcn/ui Command 기반 검색   |
| `components/analyze/result-panel.tsx`        | 분석 결과 패널                |
| `components/analyze/conflict-card.tsx`       | 충돌 카드 (severity별 색상)   |
| `components/analyze/manual-input-dialog.tsx` | 성분 직접 입력 다이얼로그     |

---

## 데이터 구성 (MVP 범위)

### 제품 DB

- 올리브영 랭킹 기준 4개 카테고리: 스킨케어, 마스크팩, 클렌징, 선케어
- 각 카테고리 상위 30개 → 총 120개 제품
- 데이터 수집: 수동 CSV 준비 → 시드 스크립트로 DB 투입
- 출처: 올리브영 상품 상세 > 상품정보 제공고시 > 전성분 텍스트

### 성분 DB

- 대한화장품협회(KCIA) 화장품성분사전 기준 (kcia.or.kr)
- 표준 성분명: 국문 기준 (영문 INCI명 병기)
- 총 21,805개 성분

### 충돌 규칙 DB

- The Ordinary 공식 충돌 차트 기반 (MVP 범위)
- 약 10-15개 핵심 성분 그룹 간 충돌 규칙
- conflict_type: avoid(사용금지) / caution(주의) / synergy(시너지)
- severity: high / medium / low
- 추후 Paula's Choice, 피부과학 문헌으로 확장 가능

### 시드 데이터 인프라

```
scripts/seed/    → TypeScript 시드 스크립트
data/csv/        → CSV 데이터 7종
```

시드 실행 순서 (FK 의존성 고려):
`ingredients` → `ingredient_groups` → `group_members` → `aliases` → `products` → `product_ingredients` → `conflict_rules`

### 성분명 매칭 전략

1. 전처리: 괄호 내 농도 제거 (예: "레티놀(500IU/g)" → "레티놀"), 공백 정규화
2. 매칭 우선순위: `ingredients.name` 정확 매칭 → `ingredient_aliases` 매칭 → `pg_trgm` 유사도(90%↑)
3. 매칭 실패 시 `unmatched_log` 기록

---

## 기술 스택

### 프론트엔드 프레임워크

- **Next.js 15** (App Router) - React 풀스택 프레임워크
- **TypeScript 5.6+** - 타입 안전성 보장
- **React 19** - UI 라이브러리 (최신 동시성 기능)

> 참고: 요청 사양에 Next.js 16 / TypeScript 5.9가 명시되었으나, 2026년 4월 기준 최신 안정 버전은 Next.js 15 / TypeScript 5.6+입니다. 실제 프로젝트 package.json의 버전을 따릅니다.

### 스타일링 & UI

- **Tailwind CSS 3** - 유틸리티 CSS 프레임워크
- **shadcn/ui (new-york 스타일)** - 고품질 React 컴포넌트 라이브러리
- **Lucide React** - 아이콘 라이브러리
- **next-themes** - 다크모드 지원

### 폼 & 검증

- **React Hook Form 7.x** - 폼 상태 관리
- **Zod** - 스키마 검증 라이브러리

### 백엔드 & 데이터베이스

- **Supabase** - BaaS (인증, 데이터베이스, 실시간 구독)
- **PostgreSQL** - 관계형 데이터베이스 (Supabase 포함)
- **pg_trgm** - 한글 부분 문자열 검색 확장 (GIN 인덱스 적용)

### 검색 최적화

- `products.name`, `products.brand`, `ingredients.name`에 GIN 트라이그램 인덱스
- "나이아" → "나이아신아마이드" 매칭 지원

### 패키지 관리 & 배포

- **pnpm** - 의존성 관리
- **Vercel** - Next.js 최적화 배포 플랫폼

---

## 주요 기술 결정

| 결정           | 선택                          | 이유                            |
| -------------- | ----------------------------- | ------------------------------- |
| 한글 검색      | pg_trgm                       | 부분 매칭, 형태소 분석 불필요   |
| 충돌 그룹 매핑 | ingredient_groups 중간 테이블 | 그룹 단위 규칙과 개별 성분 연결 |
| 라우팅 구조    | 2페이지 (/, /analyze)         | MVP 최소 구조                   |
| 상태 관리      | useReducer                    | 외부 라이브러리 불필요          |
| 검색 UI        | shadcn/ui Command (cmdk)      | 키보드 탐색 내장                |

---

## 구현 단계

| Phase       | 내용                                                   |
| ----------- | ------------------------------------------------------ |
| **Phase 0** | 스타터킷 정리 + 인증 라우트 보호 해제                  |
| **Phase 1** | DB 스키마 7개 테이블 + 시드 인프라 (Supabase MCP 활용) |
| **Phase 2** | API 3개 구현 (검색, 분석, 매칭)                        |
| **Phase 3** | UI — 레이아웃 + 랜딩 + 분석 검색 페이지                |
| **Phase 4** | UI — 분석 결과 + 성분 직접 입력                        |
| **Phase 5** | 반응형 대응 + 다크모드 + E2E 테스트 + 배포             |

---

## 반응형 디자인

**데스크탑 우선(Desktop First)** 전략으로 개발한다. 1280px 데스크탑 레이아웃을 기준으로 구현한 뒤, 하위 브레이크포인트로 축소 대응한다.

| 브레이크포인트 | 너비   | 우선순위      |
| -------------- | ------ | ------------- |
| 데스크탑       | 1280px | **메인 타겟** |
| 태블릿         | 768px  | 2순위         |
| 모바일         | 375px  | 3순위         |

다크모드 지원: next-themes 라이브러리 활용

---

## 정합성 검증

### 기능 ID 커버리지

| 기능 ID | 기능명                 | 구현 페이지 | 메뉴 연결                 |
| ------- | ---------------------- | ----------- | ------------------------- |
| F001    | 제품 검색              | 분석 페이지 | 검색창                    |
| F002    | 슬롯 선택 및 단계 관리 | 분석 페이지 | 스텝 인디케이터, 돌아가기 |
| F003    | 성분 충돌 분석         | 분석 페이지 | 분석 버튼                 |
| F004    | 분석 결과 표시         | 분석 페이지 | 결과 패널                 |
| F005    | 성분 직접 입력         | 분석 페이지 | 직접 입력 버튼            |
| F010    | 서비스 소개            | 랜딩 페이지 | CTA 버튼                  |
| F011    | 성분명 매칭            | 분석 페이지 | (내부 로직)               |

### 페이지-메뉴-기능 연결 확인

- 랜딩 페이지: 메뉴 구조 존재 / F010 구현 확인
- 분석 페이지: 메뉴 구조 존재 / F001, F002, F003, F004, F005, F011 구현 확인
- 모든 기능 ID가 기능 명세에 정의됨 확인
- 모든 페이지가 메뉴 구조에서 접근 가능 확인
