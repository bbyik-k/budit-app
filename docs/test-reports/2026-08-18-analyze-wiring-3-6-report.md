# 분석 화면 실배선 3~6번 + 6.5 + 6.7 실행 보고

> 작성일: 2026-08-18
> 대상 계획: [`docs/todo/analyze-wiring-plan.md`](../todo/analyze-wiring-plan.md)
> 상태: **3, 4, 5, 6, 6.5, 6.7 A 완료 / 6.7 B, C 미착수 (전제 불일치로 중단)**

---

## 0. 한눈에 보기

| 단계                        | 결과          | 요약                                                              |
| --------------------------- | ------------- | ----------------------------------------------------------------- |
| 3. 제품 검색 실배선         | ✅ **완료**   | `DUMMY_PRODUCTS` 6건 삭제, 실 API 배선. 함정 7건 전부 처리        |
| 4. 성분 직접 입력 실배선    | ✅ **완료**   | `KNOWN_INGREDIENTS` 7개 삭제, 4분류 미리보기, 이중 로깅 차단      |
| 5. reducer 전이 가드        | ✅ **완료**   | 전이표 7행 구현, `CLEAR_SLOT_B`·`SET_ERROR` 신설, error step 렌더 |
| 6. RPC 응답 zod 검증        | ✅ **완료**   | 스키마 4종 추가, 타입 단언 3곳 제거, throw 통일. 실 DB 검증 통과  |
| 6.5 재현 케이스 테스트 고정 | ✅ **완료**   | vitest 도입, 통합 테스트 3건 전부 통과                            |
| 6.7 A. `normalizeName` 확장 | ✅ **완료**   | 통과 조건 4건 전부 충족                                           |
| 6.7 B. 성분 분리 로직 보강  | ❌ **미착수** | **적용 대상 코드가 리포에 존재하지 않음**                         |
| 6.7 C. 358건 파싱 검증      | ❌ **미착수** | **"data/csv의 358건"에 해당하는 대상이 존재하지 않음**            |

자동 검증 상태: `pnpm type-check` ✅ / `pnpm lint` ✅ / `pnpm test` ✅ (3 passed)

---

## 1. 변경된 파일 전체 목록

이번 작업으로 변경·추가된 파일만 추린 목록이다. `data/README.md`, `shrimp_data/WebGUI.md`는 이번 작업과 **무관한 기존 변경분**이다 (세션 시작 시점부터 modified 상태였음).

| 파일                                             | 단계  | 변경                                |
| ------------------------------------------------ | ----- | ----------------------------------- |
| `components/analyze/product-search.tsx`          | 3     | 수정 (+188/-…)                      |
| `components/analyze/manual-input-dialog.tsx`     | 4     | 수정                                |
| `lib/analyze/match.ts`                           | 4, 6  | 수정                                |
| `app/api/ingredients/match/route.ts`             | 4     | 수정                                |
| `types/analyze.ts`                               | 5     | 수정                                |
| `components/analyze/analyze-container.tsx`       | 5     | 수정                                |
| `components/analyze/step-indicator.tsx`          | 5     | 수정                                |
| `lib/api/validation.ts`                          | 6     | 수정                                |
| `lib/analyze/conflict.ts`                        | 6     | 수정                                |
| `lib/ingredients/normalize.ts`                   | 6.7 A | 수정                                |
| `package.json`                                   | 6.5   | 수정 (vitest devDep, test 스크립트) |
| `pnpm-lock.yaml`                                 | 6.5   | 수정 (vitest 설치)                  |
| `vitest.config.mts`                              | 6.5   | **신규**                            |
| `tests/setup.ts`                                 | 6.5   | **신규**                            |
| `tests/integration/retinol-aha-conflict.test.ts` | 6.5   | **신규**                            |

### 참고 — 부수적으로 발생한 포맷 변경

4번 작업 중 `pnpm format`(리포 전체 대상)을 1회 실행했다. 그 결과 `docs/todo/analyze-wiring-plan.md`의 **마크다운 표 정렬**이 prettier 스타일로 재정렬됐다. 문서 내용 변화는 없다. 이후 단계부터는 변경 파일만 대상으로 `pnpm prettier --write <files>`를 사용했다.

---

## 2. 3번 — 제품 검색 실배선

**변경 파일:** `components/analyze/product-search.tsx` (단일)

| 항목      | 내용                                                    |
| --------- | ------------------------------------------------------- |
| 삭제 상수 | `DUMMY_PRODUCTS` (6건, 구 `:24-55`)                     |
| 타입 교체 | `(typeof DUMMY_PRODUCTS)[number]` → `ProductSearchItem` |
| 추가 상태 | `query`, `items`, `loading`, `errorMsg`                 |
| 디바운스  | `useEffect` + `setTimeout` 250ms                        |
| 요청 취소 | `AbortController` (응답 역전 방지)                      |

### 계획서가 지정한 함정 7건 처리 결과

| 함정                                                     | 처리                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `searchQuerySchema`의 `q: min(1)` — 빈 쿼리 400          | ✅ `query.trim()`이 비면 fetch 자체를 건너뜀                                 |
| cmdk 기본 필터가 서버 결과를 재필터링                    | ✅ `<Command shouldFilter={false}>`                                          |
| `shouldFilter={false}`면 `CommandEmpty`가 빈 쿼리에도 뜸 | ✅ `query.trim() && !loading && !errorMsg && items.length === 0`일 때만 렌더 |
| `AbortController.abort()`가 fetch를 reject               | ✅ catch에서 `err.name === "AbortError"` 조기 return                         |
| 응답 역전(race)                                          | ✅ cleanup에서 `clearTimeout` + `controller.abort()`                         |
| `CommandItem value` 중복                                 | ✅ `value={product.id}`                                                      |
| 500 시 Next가 HTML 반환 → `res.json()` throw             | ✅ `!res.ok` 분기 **내부**에 별도 try/catch, 실패 시 기본 문구               |

추가로 팝오버 닫힘 시(`handleOpenChange`) `query`/`items`/`loading`/`errorMsg`를 전부 초기화한다.

**미수행:** 계획서 "검증 방법" 1번의 수동 브라우저 시나리오(IME 조합 확인 등)는 실행하지 않았다. 자동 검증(`type-check`, `lint`)만 통과한 상태다.

---

## 3. 4번 — 성분 직접 입력 실배선

**변경 파일:** `components/analyze/manual-input-dialog.tsx`, `lib/analyze/match.ts`, `app/api/ingredients/match/route.ts`

| 항목            | 내용                                                                                    |
| --------------- | --------------------------------------------------------------------------------------- |
| 삭제 상수       | `KNOWN_INGREDIENTS` (7개, 구 `:19-27`)                                                  |
| 삭제 로직       | 렌더 중 동기 분류 `matched`/`unmatched` (구 `:55-58`)                                   |
| 상태 교체       | `matchPreview: boolean` → `matchResult: MatchResponse \| null` + `loading` + `errorMsg` |
| `handlePreview` | 동기 → async, `POST /api/ingredients/match`                                             |
| 미리보기        | **4분류** — 정확 일치 / 별칭 일치 / 유사 일치 / 미매칭                                  |
| 표시 형태       | exact는 `ingredient_name`, alias·fuzzy는 `raw_name → ingredient_name`                   |
| 문구 수정       | "미매칭 (n) — 분석에는 포함됩니다" → **"미매칭 (n) — 분석에서 제외됩니다"**             |
| `handleConfirm` | **현행 유지** — 원문 전체(`parsedIngredients`) 전달                                     |

### 함정 처리

| 함정                                                        | 처리                                                                              |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `matched.map(ing => <span>{ing}</span>)`가 객체 렌더 크래시 | ✅ `m.raw_name`/`m.ingredient_name`으로 교체, key는 index 기반                    |
| in-flight 중 텍스트 편집 → 늦은 응답이 새 입력을 덮음       | ✅ 로딩 중 Textarea·버튼 `disabled`                                               |
| "N개 성분 인식됨"과 `matched+unmatched` 합계 불일치         | ✅ 미리보기 후에는 **응답 기준 합계**(`matched.length + unmatched.length`)로 표시 |
| 다이얼로그 상시 마운트로 A→B 전환 시 상태 누수              | ✅ `handleOpenChange`와 Textarea `onChange` 양쪽에서 `resetPreview()`             |

### 이중 로깅 차단

| 위치                                            | 처리                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `lib/analyze/match.ts`                          | 시그니처를 `matchIngredients(rawNames, productId?, options?: { logUnmatched?: boolean })`로 확장. 기본값 `true`로 현행 동작 보존 |
| `lib/analyze/match.ts` Step 4                   | `if (!logUnmatched) continue;`로 `log_unmatched` RPC만 건너뜀. **`unmatchedRaws.push`는 플래그와 무관하게 항상 수행**            |
| `app/api/ingredients/match/route.ts`            | `{ logUnmatched: false }` 전달 (미리보기는 읽기 동작)                                                                            |
| `app/api/analyze/route.ts`의 `resolveSlotNames` | **변경 없음** (기본값 `true` 유지)                                                                                               |

**미수행:** `unmatched_log.occurrence_count`를 미리보기 전후로 실제 조회해 증가하지 않음을 확인하는 런타임 검증은 실행하지 않았다. 코드 경로상으로만 보장된 상태다.

---

## 4. 5번 — reducer 전이 가드

**변경 파일:** `types/analyze.ts`, `components/analyze/analyze-container.tsx`, `components/analyze/step-indicator.tsx`

### 타입 변경

- `AnalyzeStep`에 `"error"` 추가
- `AnalyzeState`에 `error: { code?: string; message: string } | null` 추가, `initialState`에 `error: null`
- `AnalyzeAction`에 `{ type: "CLEAR_SLOT_B" }`, `{ type: "SET_ERROR"; payload: {...} }` 추가

### 구현된 최종 전이표 (계획서와 100% 일치)

| action          | 허용 from step   | to step     | 상태 변경                       |
| --------------- | ---------------- | ----------- | ------------------------------- |
| `SELECT_SLOT_A` | `select-a`       | `select-b`  | `slotA = payload`               |
| `SELECT_SLOT_B` | `select-b`       | `ready`     | `slotB = payload`               |
| `CLEAR_SLOT_B`  | `ready`          | `select-b`  | `slotB = null`                  |
| `START_ANALYZE` | `ready`, `error` | `analyzing` | `error = null`, `result = null` |
| `SET_RESULT`    | `analyzing`      | `result`    | `result = payload`              |
| `SET_ERROR`     | `analyzing`      | `error`     | `error = payload`               |
| `RESET`         | 모든 step        | `select-a`  | `initialState`                  |

허용되지 않는 (step, action) 조합은 전부 `return state`로 무시된다.

### 그 외 변경

- `handleAnalyze`의 `RESET` 2곳 → `SET_ERROR`. 서버 바디 `{error:{code,message}}`를 파싱하고, 파싱 실패 시 기본 문구 사용 (500 시 HTML 대비)
- `handleClearSlotB`: `dispatch({ type: "CLEAR_SLOT_B" })`로 교체. `state.slotA!` 단언과 `[state.slotA]` 의존성 제거
- error step 렌더 분기 신설 — 에러 메시지 + `재시도`(`START_ANALYZE`) + `처음부터`(`RESET`)
- `StepIndicator`: `stepOrder`를 `["select-a","select-b","ready","analyzing","error","result"]`로 (**`error`를 `result` 앞에** 배치), `steps[2].key`를 `["ready","analyzing","error"]`로 확장

### 함께 해소된 기존 버그 2건

1. `handleClearSlotB`가 `SELECT_SLOT_A`를 dispatch해 step만 바꾸고 `slotB`를 남기던 데드엔드 → `CLEAR_SLOT_B`가 `slotB: null` 명시
2. 분석 중 `RESET` 후 늦게 도착한 응답이 `SET_RESULT`로 화면을 하이재킹하던 문제 → `SET_RESULT`가 `analyzing`에서만 허용

**미수행:** 계획서 "검증 방법" 3번의 수동 브라우저 시나리오(offline으로 error step 진입 등)는 실행하지 않았다.

---

## 5. 6번 — RPC 응답 zod 검증

**변경 파일:** `lib/api/validation.ts`, `lib/analyze/conflict.ts`, `lib/analyze/match.ts`

### 추가된 스키마 (`lib/api/validation.ts`)

```ts
export const analyzeConflictsRowSchema = z.object({
  ingredient_a: z.string(),
  ingredient_b: z.string(),
  a_type: z.string(),
  b_type: z.string(),
  conflict_type: z.enum(["avoid", "caution", "synergy"]),
  severity: z.enum(["high", "medium", "low"]).nullable(),
  reason_ko: z.string(), // .min(1) 금지 — synergy 행이 빈 문자열
  recommend: z.string().nullable(),
  source: z.string().nullable(),
});
export const analyzeConflictsRowsSchema = z.array(analyzeConflictsRowSchema);

export const fuzzyMatchRowSchema = z.object({
  ingredient_id: z.uuid(),
  name: z.string(),
  similarity: z.number(),
});
export const fuzzyMatchRowsSchema = z.array(fuzzyMatchRowSchema);
```

`.strict()`는 사용하지 않았다 (기본 `z.object` stripping에 의존).

### 제거된 타입 단언 — 계획서가 지목한 3곳 전부

| 위치                  | 제거된 단언                                            |
| --------------------- | ------------------------------------------------------ |
| `conflict.ts:32` (구) | `(rules ?? []) as AnalyzeConflictsRow[]`               |
| `conflict.ts:43` (구) | `r.conflict_type as "avoid" \| "caution"`              |
| `conflict.ts:44` (구) | `(r.severity ?? "low") as "high" \| "medium" \| "low"` |

`conflict_type`을 `z.enum`으로 둔 결과 synergy 분기 이후 TS가 `"avoid"|"caution"`으로 자동 좁혀, 계획서 예측대로 단언이 불필요해졌다. `Database` 타입 import와 `AnalyzeConflictsRow` 별칭도 함께 제거됐다.

**범위 밖으로 남긴 것 (계획서대로):** `match.ts`의 alias 조인 단언, `log_unmatched`의 `as string`.

### throw 통일

| 위치                         | 변경                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `conflict.ts` RPC error 분기 | `return { conflicts: [], synergies: [] }` → **throw** (계획서의 "지시 범위를 살짝 넘김" 결정 반영) |
| `conflict.ts` zod 실패       | `console.error(issues)` 후 throw                                                                   |
| `match.ts` fuzzy RPC         | `error`를 구조분해로 **새로 수신**하고 throw                                                       |
| `match.ts` fuzzy zod 실패    | `console.error(issues)` 후 throw                                                                   |

에러 코드는 기존 `DB_ERROR`를 재사용했다 (`ApiErrorCode` union 미변경).

### 실 DB 회귀 검증 결과

이니스프리 `A000000230208` × 메디힐 `A000000171427` (성분 35 vs 34) 조합으로 `analyze_conflicts`를 직접 호출:

| 항목                                   | 결과                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| 반환 행 수                             | **26행**                                                                                    |
| `analyzeConflictsRowsSchema.safeParse` | **success: true**                                                                           |
| synergy 행의 `severity`                | 전부 `null` (빈 문자열 아님) → `.nullable()` 정상 동작, `"" → null` 전처리 불필요 확인      |
| 목표 규칙                              | `AHA 계열(group) × 레티놀 계열(group)` / `conflict_type=avoid` / `severity=high` **반환됨** |

검증에 쓴 임시 tsx 스크립트는 삭제했고 리포에 남지 않았다.

---

## 6. 6.5 — 재현 케이스 테스트 고정

### 도입 내역

| 항목        | 내용                                                                               |
| ----------- | ---------------------------------------------------------------------------------- |
| 러너        | `vitest@4.1.10` (devDependency)                                                    |
| 설정        | `vitest.config.mts` — `@` alias, `environment: "node"`, `testTimeout: 30_000`      |
| 환경변수    | `tests/setup.ts`에서 dotenv로 `.env.local` 로드 (`SUPABASE_SERVICE_ROLE_KEY` 사용) |
| 테스트 파일 | `tests/integration/retinol-aha-conflict.test.ts`                                   |
| 스크립트    | `"test": "vitest run"`, `"test:watch": "vitest"`                                   |

`vitest.config.mts` 확장자를 `.mts`로 둔 이유는 Vite의 `configLoader: 'native'` 경고를 없애기 위해서다 (`package.json`에 `"type": "module"`을 추가하지 않고 해결).

### 제품 특정 방식

`products.oliveyoung_id`로만 조회한다. 제품명은 테스트 어디에서도 기준으로 쓰지 않는다.

```ts
const OLIVEYOUNG_ID_A = "A000000230208"; // 이니스프리 레티놀 시카 흔적 앰플
const OLIVEYOUNG_ID_B = "A000000171427"; // 메디힐 더마 패드
```

### 검증 결과

| #   | 검증 내용                                                                     | 결과 | 실측값             |
| --- | ----------------------------------------------------------------------------- | ---- | ------------------ |
| 1   | 제품 A의 `product_ingredients`에 **레티놀 계열** 소속 성분 ≥ 1                | ✅   | `레티놀` 1건       |
| 1   | 제품 B의 `product_ingredients`에 **AHA 계열** 소속 성분 ≥ 1                   | ✅   | `시트릭애씨드` 1건 |
| 2   | `analyze_conflicts` 결과에 (AHA 계열, 레티놀 계열, `avoid`, `high`) 규칙 포함 | ✅   | —                  |
| 3   | 해당 매칭의 `a_type`, `b_type`이 모두 `"group"`                               | ✅   | 둘 다 `group`      |

```
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

### 구현 중 확인된 사실

- `ingredient_groups` 테이블의 그룹명 컬럼은 `name`이 아니라 **`group_name`**이다.
- RPC가 양방향 매칭이므로 테스트는 `(a, b)` 순서를 고정하지 않고 **조합**으로 판정한다.

---

## 7. 6.7 A — `normalizeName` 확장

**변경 파일:** `lib/ingredients/normalize.ts` (단일)

```ts
.replace(/[([{][\d.,\s]*(?:%|ppm|ppb|iu\/g|iu|mg|ml)?\s*[)\]}]/gi, "")
```

`iu\/g`를 `iu`보다 **먼저** 배치해야 `/g`가 남지 않는다.

### 지정된 통과 조건 — 실제 반환값

| 입력                           | 실제 반환값           | 통과 조건            | 판정 |
| ------------------------------ | --------------------- | -------------------- | ---- |
| `"레티놀(500IU/g)"`            | `"레티놀"`            | `"레티놀"`           | ✅   |
| `"나이아신아마이드(1,000ppm)"` | `"나이아신아마이드"`  | `"나이아신아마이드"` | ✅   |
| `"티트리잎가루(3 ppm)"`        | `"티트리잎가루"`      | `"티트리잎가루"`     | ✅   |
| `"토코페롤(비타민E)"`          | `"토코페롤(비타민E)"` | 변경 없음            | ✅   |

### 회귀 확인 (추가 실측)

| 입력                     | 실제 반환값          | 비고                           |
| ------------------------ | -------------------- | ------------------------------ |
| `"레티놀"`               | `"레티놀"`           | 변화 없음                      |
| `"레티놀 (500IU/g)"`     | `"레티놀"`           | 공백 분리형도 처리             |
| `"나이아신아마이드(2%)"` | `"나이아신아마이드"` | 기존 동작 유지                 |
| `"정제수(물)"`           | `"정제수(물)"`       | 기존 동작 유지 (문자는 미제거) |
| `"성분[0.5%]"`           | `"성분"`             | 대괄호 유지                    |
| `"성분{1.0%}"`           | `"성분"`             | 중괄호 유지                    |
| `"성분(50 mg)"`          | `"성분"`             | mg                             |
| `"성분(10ML)"`           | `"성분"`             | 대문자 무시                    |
| `"성분(2 PPB)"`          | `"성분"`             | 대문자 무시                    |

---

## 8. 6.7 B — 성분 분리 로직 보강 ❌ **미착수**

> 지시: "먼저 `raw_ingredients_text`를 성분 배열로 자르는 코드 위치를 보고하라. 그 다음 아래 세 케이스를 처리한다."

### 결론: **그런 코드는 리포에 존재하지 않는다.**

`raw_ingredients_text`를 성분 배열로 자르는 코드를 리포 전체에서 검색한 결과다.

| 위치                                                  | 실제 동작                                                                                                                                                          | 자르는가?       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| `scripts/seed.ts:323`                                 | `raw_ingredients_text: emptyToNull(row["raw_ingredients_text"])` — CSV 값을 **원문 그대로 DB에 저장만** 함                                                         | ❌              |
| `app/api/analyze/route.ts:76-82` (`resolveSlotNames`) | 제품 슬롯은 `product_ingredients` 테이블을 조인해 성분명을 읽음. `raw_ingredients_text` **미사용**                                                                 | ❌              |
| `data/toyfiles/toy_product_ingredients.csv`           | 222행이 **이미 분리된 상태**로 CSV에 제공됨 (컬럼: `product_name, ingredient_name, display_order, raw_name`)                                                       | — (분리 불필요) |
| `components/analyze/manual-input-dialog.tsx:40`       | `.split(",").map(s => s.trim()).filter(Boolean)` — 리포 내 **유일한 성분 토크나이저**. 단 입력은 `raw_ingredients_text`가 아니라 **사용자가 textarea에 친 텍스트** | △ (대상이 다름) |
| `scripts/seed.ts:51`                                  | `content.split("\n")` — CSV 줄 분리. 성분 분리와 무관                                                                                                              | ❌              |

전체 검색 결과 `split(` 호출은 리포 통틀어 위 2곳(`seed.ts:51`, `manual-input-dialog.tsx:40`)뿐이다.

### 따라서 지시한 세 케이스를 **적용할 대상이 없다**

| 케이스                                  | 상태                |
| --------------------------------------- | ------------------- |
| 1. 괄호 안 쉼표 유지 (괄호 깊이 카운트) | 적용 대상 코드 없음 |
| 2. 쉼표 0개 전성분 → 공백 분리          | 적용 대상 코드 없음 |
| 3. 대괄호 노이즈 `[알로에수딩]` 제거    | 적용 대상 코드 없음 |

### 추가 확인 — 세 케이스가 실제 데이터에 존재하는가

`data/toyfiles/toy_products.csv`의 `raw_ingredients_text` 6건 실측:

| oliveyoung_id | 쉼표 수 | 소괄호 `()` 개수 | 대괄호 `[]` 개수 |
| ------------- | ------- | ---------------- | ---------------- |
| A000000222833 | 41      | 0                | 0                |
| A000000189261 | 33      | 0                | 0                |
| A000000230208 | 35      | 0                | 0                |
| A000000223414 | 41      | 0                | 0                |
| A000000171427 | 34      | 0                | 0                |
| A000000234422 | 37      | 0                | 0                |

**현재 리포의 전성분 원문 데이터에는 세 케이스가 단 한 건도 존재하지 않는다.** 괄호·대괄호가 0개이고, 쉼표가 0개인 행도 없다.

### 판단이 필요한 지점

세 케이스를 **어디에** 구현할지가 정해지지 않았다. 후보:

1. `lib/ingredients/parse.ts`를 신설하고 `manual-input-dialog.tsx:40`을 이 함수 호출로 교체
2. `lib/ingredients/parse.ts`만 신설하고 기존 호출부는 무변경
3. `manual-input-dialog.tsx:40`을 인라인으로 확장

---

## 9. 6.7 C — 358건 파싱 검증 ❌ **미착수**

> 지시: "`data/csv`의 358건 전체를 파싱해 표로 보고하라."

### 결론: **`data/csv`에 358건인 대상이 존재하지 않는다.**

`data/csv` 전 파일 실측 (헤더 제외 데이터 행 수):

| 파일                                     | 행 수 | 컬럼                                                                                                | 전성분 텍스트인가                   |
| ---------------------------------------- | ----- | --------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `conflict_rules.csv`                     | 52    | `ingredient_a, ingredient_b, a_type, b_type, conflict_type, severity, reason_ko, recommend, source` | ❌ 충돌 규칙                        |
| `ingredient_aliases.csv`                 | 50    | `alias, ingredient_name, source`                                                                    | ❌ 별칭                             |
| `ingredient_group_members.csv`           | 158   | `group_name, ingredient_name`                                                                       | ❌ 그룹 매핑                        |
| `ingredient_groups.csv`                  | 26    | `group_name, description`                                                                           | ❌ 그룹 정의                        |
| `_ingredients.csv` (백업)                | 38    | `name, name_en, category, is_restricted, restrict_info`                                             | ❌ 성분 마스터                      |
| `_product_ingredients.csv` (백업)        | 26    | `product_name, ingredient_name, display_order, raw_name`                                            | ❌ 이미 분리됨                      |
| `_products.csv` (백업)                   | 14    | `..., raw_ingredients_text`                                                                         | △ 컬럼은 있으나 **14행 전부 빈 값** |
| `ingredient_group_members_v0.csv` (백업) | 24    | `group_name, ingredient_name`                                                                       | ❌ 그룹 매핑                        |

### 358과의 대조

| 조합                                       | 합계    | 358과 일치             |
| ------------------------------------------ | ------- | ---------------------- |
| `data/csv` 실사용 4파일                    | **286** | ❌                     |
| `data/csv` 백업 4파일                      | **102** | ❌                     |
| `data/csv` 전체 8파일                      | **388** | ❌                     |
| `data/toyfiles` 3파일 (128+222+6)          | **356** | ❌ (가장 근접, 2 차이) |
| `toy_products.csv` 6건의 쉼표 분리 토큰 합 | **227** | ❌                     |
| `toy_product_ingredients.csv`              | **222** | ❌                     |

**어떤 조합도 358이 되지 않는다.** 가장 가까운 값은 `data/toyfiles` 3파일 합계 356이다.

### 추가로: `data/csv`는 전성분 파싱 대상이 아니다

`data/csv`에 있는 것은 그룹·별칭·충돌 규칙이며, 전성분 원문(`raw_ingredients_text`)은 **`data/toyfiles/toy_products.csv`**에 있다. C의 검증 항목("괄호가 남아 있는 고유 토큰", "A000000230208 파싱 결과") 과 의미가 맞는 유일한 대상이 이쪽이다.

### 참고 — 대상을 `toy_products.csv`로 가정했을 때의 실측치

지시 이행이 아니라, 판단 근거로 제공하는 **현재 상태 실측**이다. 6.7 B의 분리 로직이 없으므로 단순 쉼표 분리 기준이다.

| 항목                                             | 값                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| 대상                                             | `data/toyfiles/toy_products.csv`의 `raw_ingredients_text` **6건** |
| 총 토큰 수                                       | **227**                                                           |
| 고유 토큰 수                                     | **130**                                                           |
| 괄호가 남아 있는 고유 토큰 수                    | **0**                                                             |
| 괄호 남은 토큰 목록                              | (없음)                                                            |
| `A000000230208` 파싱 결과에 `"레티놀"` 정확 포함 | ✅ **포함됨** (토큰 36개 중 `레티놀` 정확히 1건)                  |

즉 현재 데이터 기준으로는 단순 쉼표 분리만으로도 괄호 잔여 토큰이 0이고 `레티놀`이 정확히 추출된다.

---

## 10. 미확인 / 미수행 항목 정리

| 항목                                                                                               | 사유                                                        |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 3·4·5번의 수동 브라우저 시나리오 (`pnpm dev` 기반)                                                 | 실행하지 않음. 자동 검증(`type-check`/`lint`/`test`)만 통과 |
| `unmatched_log.occurrence_count` 증가 여부 런타임 확인                                             | 실행하지 않음. 코드 경로상으로만 보장                       |
| 6.7 B 구현                                                                                         | 적용 대상 코드 부재 — 구현 위치 결정 필요                   |
| 6.7 C 검증                                                                                         | "358건" 대상 불명 — 파싱 대상 파일 확정 필요                |
| `conflict_rules.csv`의 필드 밀림 (synergy 행 `reason_ko`가 빈 문자열, 설명이 `recommend`에 들어감) | 계획서가 **이번 범위 밖**으로 명시. 미수정                  |
