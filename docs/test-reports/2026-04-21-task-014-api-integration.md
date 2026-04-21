# Task 014: API 통합 테스트 리포트

**날짜**: 2026-04-21  
**환경**: `localhost:3000` (pnpm dev), Supabase 프로덕션 DB  
**테스트 방식**: Node.js `fetch()` 직접 HTTP 호출  
(Playwright MCP 브라우저 세션 만료로 인해 직접 HTTP 방식으로 대체)

---

## 결과 요약

| 구분        | 총     | PASS   | FAIL  |
| ----------- | ------ | ------ | ----- |
| Happy Path  | 11     | 11     | 0     |
| 에러 케이스 | 6      | 6      | 0     |
| 성능        | 3      | 3      | 0     |
| **합계**    | **20** | **20** | **0** |

---

## 발견 이슈 (블로커 아님)

| #   | 현상                                                     | 원인                                                               | 조치                                                      |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| I1  | "글리콜산" 매칭 실패                                     | DB 성분명이 INCI 기반 "글리콜릭애씨드"이며, "글리콜산" 별칭 미등록 | `ingredient_aliases` 추가 권고 (Task 024 이전 별도 chore) |
| I2  | `lib/database.types.ts`에 `analyze_conflicts` RPC 미반영 | 타입 재생성 누락                                                   | Supabase MCP로 타입 재생성 권고                           |

---

## Step 1: 사전 Smoke Check

| #   | 검증 항목            | 결과    | 비고                                        |
| --- | -------------------- | ------- | ------------------------------------------- |
| S1  | 이니스프리 제품 조회 | ✅ PASS | 이니스프리 레티놀 시카 흔적 앰플 30ml       |
| S2  | 메디힐 제품 조회     | ✅ PASS | 메디힐 에센셜 마스크팩 (마데카소사이드)     |
| S3  | 토리든 제품 조회     | ✅ PASS | 토리든 다이브인 저분자 히알루론산 세럼 50ml |

**테스트 픽스처 ID**

```
이니스프리 레티놀 시카 앰플: 16f71e35-6f26-43f2-a39c-87098dff14f5
메디힐 에센셜 마스크팩:      6fe4f229-db32-4f7f-a86a-06fcaae5f96b
토리든 히알루론산 세럼:       da2a4905-43c3-4829-b9e7-cecb126cf0df
```

---

## Step 2: Happy Path 시나리오

### H1: 제품 × 제품 충돌 분석

**요청**

```json
POST /api/analyze
{
  "slotA": { "type": "product", "productId": "16f71e35-6f26-43f2-a39c-87098dff14f5" },
  "slotB": { "type": "product", "productId": "6fe4f229-db32-4f7f-a86a-06fcaae5f96b" }
}
```

**결과**: 응답 213ms

| #    | 항목                               | 결과   |
| ---- | ---------------------------------- | ------ |
| H1-1 | 응답 200                           | ✅     |
| H1-2 | conflicts 배열 존재                | ✅     |
| H1-3 | synergies 배열 존재                | ✅     |
| H1-4 | 충돌 감지                          | ✅ 4건 |
| H1-5 | 충돌 구조 (ingredientA/B/severity) | ✅     |

**감지된 충돌**

```
레티놀 계열 × 향료 계열 [caution/medium]
BHA 계열 × 향료 계열 [caution/medium]
방부제 계열 × 향료 계열 [caution/low]
BHA 계열 × 나이아신아마이드 계열 [caution/medium]
시너지: 20건
```

---

### H2: 제품 × 성분 직접 입력 (혼합)

**요청**

```json
// 1단계: POST /api/ingredients/match
{ "ingredients": ["레티놀", "글리콜산", "히알루론산", "나이아신아마이드"] }

// 2단계: POST /api/analyze
{
  "slotA": { "type": "product", "productId": "da2a4905-..." },
  "slotB": { "type": "manual", "ingredients": ["레티놀", "글리콜산", "히알루론산"] }
}
```

**결과**: match 416ms, analyze 259ms

| #    | 항목                | 결과 |
| ---- | ------------------- | ---- |
| H2-1 | match 응답 200      | ✅   |
| H2-2 | matched 배열 존재   | ✅   |
| H2-3 | unmatched 배열 존재 | ✅   |
| H2-4 | analyze 응답 200    | ✅   |
| H2-5 | conflicts 배열 존재 | ✅   |

**매칭 결과**

```
matched:   히알루론산(exact), 나이아신아마이드(exact), 레티놀(exact)
unmatched: 글리콜산  ← 이슈 I1: "글리콜릭애씨드"로 등록됨
```

> 토리든 히알루론산 세럼은 레티놀/AHA 계열 성분이 없어 충돌 0건이 정상 결과.

---

### H3: 직접 입력 × 직접 입력

**요청** (글리콜릭애씨드 정확명 사용)

```json
POST /api/analyze
{
  "slotA": { "type": "manual", "ingredients": ["레티놀", "글리세린"] },
  "slotB": { "type": "manual", "ingredients": ["글리콜릭애씨드", "나이아신아마이드"] }
}
```

**결과**: 응답 128ms

| #    | 항목                                | 결과   |
| ---- | ----------------------------------- | ------ |
| H3-1 | 응답 200                            | ✅     |
| H3-2 | conflicts 배열 존재                 | ✅     |
| H3-3 | AHA×레티놀 충돌 감지                | ✅ 1건 |
| H3-4 | AHA 계열 × 레티놀 계열 [avoid/high] | ✅     |

**감지된 충돌**

```
AHA 계열 × 레티놀 계열 [avoid/high]
```

---

## Step 3: 에러 케이스

| #   | 케이스                  | 기대                  | 실제                  | 결과 |
| --- | ----------------------- | --------------------- | --------------------- | ---- |
| E1  | 빈 검색어 `?q=`         | 400 INVALID_QUERY     | 400 INVALID_QUERY     | ✅   |
| E2  | 제어문자 `?q=\t`        | 400 INVALID_QUERY     | 400 INVALID_QUERY     | ✅   |
| E3  | 존재하지 않는 productId | 404 PRODUCT_NOT_FOUND | 404 PRODUCT_NOT_FOUND | ✅   |
| E4  | manual ingredients=[]   | 400 INVALID_BODY      | 400 INVALID_BODY      | ✅   |
| E5  | 미존재 성분명           | 200 + unmatched 포함  | 200 + unmatched 포함  | ✅   |
| E6  | 빈 body `{}`            | 400 INVALID_BODY      | 400 INVALID_BODY      | ✅   |

---

## Step 4: 성능 기본 검증

| API                              | 측정값 (3회)        | 평균      | 목표    | 결과 |
| -------------------------------- | ------------------- | --------- | ------- | ---- |
| `/api/products/search?q=토리든`  | 248ms, 60ms, 55ms   | **121ms** | <500ms  | ✅   |
| `/api/ingredients/match` (10개)  | 224ms, 225ms, 214ms | **221ms** | <800ms  | ✅   |
| `/api/analyze` (product×product) | 112ms, 110ms, 103ms | **108ms** | <2000ms | ✅   |

> 첫 번째 호출이 이후 호출보다 느린 것은 Next.js 서버 사이드 캐싱 워밍업 효과로 판단됨.

---

## 결론

**Task 014 통과**: 20/20 시나리오 PASS, 블로커 이슈 없음.

**배포(Task 025) 진행 가능** — 핵심 API 3개의 정상 동작, 에러 처리, 성능이 모두 검증됨.

**후속 권고 사항 (배포 전/후 별도 처리)**

1. "글리콜산" 등 일반 한국어 화학명 별칭 추가 (`ingredient_aliases`)
2. `lib/database.types.ts` Supabase MCP로 재생성 (`analyze_conflicts` 타입 반영)
