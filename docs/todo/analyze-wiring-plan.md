# BUDIT — 분석 화면 실배선 작업 계획 (1~6번)

> 작성일: 2026-08-14 · 상태: **1~2번 완료, 3~6번 대기**
> 아래 "확인 불가 항목" 3건은 2번 실행으로 **전부 해소**됐다 (해당 섹션의 갱신 표 참조).

## Context

BUDIT의 분석 화면은 현재 **혼합 상태**다. 서버 API 3종(`/api/products/search`, `/api/ingredients/match`, `/api/analyze`)은 모두 구현·동작하지만, UI 두 곳은 아직 Phase 1 목업 하드코딩에 묶여 있어 실제로는 호출되지 않는다.

- `components/analyze/product-search.tsx:24-55` — `DUMMY_PRODUCTS` 6건 하드코딩
- `components/analyze/manual-input-dialog.tsx:19-27` — `KNOWN_INGREDIENTS` 7개 하드코딩

여기에 두 가지 신뢰성 문제가 겹쳐 있다.

1. `analyze-container.tsx:112-122` — API 오류·fetch 예외 시 `RESET`을 dispatch해 사용자가 고른 슬롯 A/B가 전부 날아가고 에러는 콘솔에만 남는다. reducer에 전이 가드가 없어 어떤 step에서든 어떤 action이든 통과한다.
2. `lib/analyze/conflict.ts:32,43,44`와 `lib/analyze/match.ts` — RPC 응답을 zod 없이 타입 단언(`as`)으로 신뢰한다. `docs/troubleshooting/2026-04-21-conflict-analysis-fix.md`의 회고 4번은 바로 이 "조용한 실패"가 3시간짜리 버그의 원인이었다고 기록한다.

1~2번은 현재 상태를 사실대로 확인만 하고, 3~6번으로 위 네 지점을 실제로 배선·보강한다.

---

---

# 반박 — 지시와 코드가 충돌하는 지점 6건

## 반박 1. 5번 가드는 지시대로 넣으면 기존 기능이 죽는다

`analyze-container.tsx:131-133`의 `handleClearSlotB`는 "슬롯 B 취소" 용도로 **`ready` 단계에서 `SELECT_SLOT_A`를 dispatch**한다.

```ts
const handleClearSlotB = useCallback(() => {
  dispatch({ type: "SELECT_SLOT_A", payload: state.slotA! });
}, [state.slotA]);
```

즉 `SELECT_SLOT_A`가 "슬롯 A 설정"과 "슬롯 B 취소" 두 의미로 오버로드돼 있다. "SELECT_SLOT_A는 `select-a`에서만"이라는 가드를 넣으면 이 dispatch가 **완전 무반응**이 되어 슬롯 B 취소 버튼이 죽는다.

→ **결정: `CLEAR_SLOT_B` 액션 신설.** 1액션 1의미로 분리한다.

## 반박 2. 그 코드에는 이미 버그가 있다 (가드가 악화시킨다)

reducer `:36`은 `{ ...state, slotA: action.payload, step: "select-b" }`를 반환한다. **`slotB`를 지우지 않는다.** 결과:

- 렌더 `:194`의 `state.slotB ?`가 여전히 truthy → **B 슬롯 뱃지가 그대로 남는다**
- `step`만 `select-b`가 되어 `:226`의 분석 버튼만 사라진다
- 다시 X를 눌러도 같은 전이 → **슬롯 A의 X(RESET) 외에는 복구 불가능한 데드엔드**

가드만 넣으면 최소한 버튼이라도 사라지던 반응조차 없어진다. `CLEAR_SLOT_B`가 `slotB: null`을 명시하면서 이 버그도 함께 해소된다.

## 반박 3. 4번의 "유사도"는 현재 API로 표시할 수 없다

- `types/api.ts:16-21`의 `MatchedItem`에는 `match_type`(`"exact"|"alias"|"fuzzy"`)만 있고 **점수 필드가 없다**
- `match_ingredient_fuzzy` RPC는 `similarity FLOAT`를 반환하지만 `lib/analyze/match.ts:93-98`이 **읽지 않고 버린다**

숫자를 표시하려면 `types/api.ts` → `lib/analyze/match.ts` → route 응답 → 6번 zod 스키마까지 4단계가 연쇄로 바뀐다. 특히 `MatchedItem.similarity`를 필수 필드로 만들면 `match.ts:42-47`(exact)과 `:71-76`(alias) 두 push 지점이 컴파일 에러가 된다.

→ **결정: 라벨만 4분류** (정확 일치 / 별칭 일치 / 유사 일치 / 미매칭). 점수는 표시하지 않는다.

## 반박 4. `AnalyzeStep`에 `"error"`를 추가해도 컴파일 에러가 0건이다

이게 5번에서 가장 위험한 지점이다. `AnalyzeStep` 소비처는 `types/analyze.ts:21`과 `step-indicator.tsx` 둘뿐이고, `step-indicator.tsx:18-25`는 exhaustive switch가 아니라 **배열 + `indexOf`**다.

```ts
const stepOrder: AnalyzeStep[] = [
  "select-a",
  "select-b",
  "ready",
  "analyzing",
  "result",
];
const currentIndex = stepOrder.indexOf(step); // "error" → -1
```

`currentIndex = -1`이면 모든 단계에서 `isActive = false`, `isDone = -1 > n` = false → **4개 단계가 전부 회색 비활성**으로 렌더된다. TS는 아무 경고도 주지 않고 **런타임에 조용히 깨진다.**

→ `stepOrder`를 `["select-a","select-b","ready","analyzing","error","result"]`로, `steps[2].key`를 `["ready","analyzing","error"]`로 함께 수정한다. `error`를 `result` 뒤에 두면 실패했는데 "결과 확인"에 ✓가 찍히므로 이 배치가 유일한 정합 배치다.

## 반박 5. 6번 스키마에서 `severity`를 enum으로 두면 시너지가 전부 죽는다

`lib/database.types.ts:304-314`는 `analyze_conflicts` 반환 9컬럼을 **전부 non-nullable `string`**으로 선언한다. 그러나 실제 DDL(`docs/DB_SCHEMA.md:290-310`)은 `severity`/`recommend`/`source`가 NULL 허용이고, `data/csv/conflict_rules.csv`의 **synergy 29행은 severity가 빈칸**이다 (`:38-50` 참조).

자동생성 타입이 거짓말을 하고 있으므로, 이를 그대로 zod로 옮기면 시너지 행이 전부 검증 실패한다. 배열 단위 parse였다면 시너지가 하나만 걸려도 분석 결과 전체가 날아간다.

→ `severity`/`recommend`/`source`는 `.nullable()`. 빈 문자열이 오는지는 **2번의 실 DB 조회로 먼저 확인**한 뒤 필요 시 `"" → null` 전처리를 넣는다.

## 반박 6. 6번을 throw로 하면 `conflict.ts` 안에 비대칭이 남는다

`conflict.ts:24-27`은 RPC 에러 시 빈 결과를 반환한다.

```ts
if (error) {
  console.error("[conflict] RPC error:", error);
  return { conflicts: [], synergies: [] };
}
```

이 빈 결과는 200으로 내려가고 `result-panel.tsx:22,80-90`이 **"안전한 조합입니다!" 초록 패널**로 렌더한다. 성분 충돌 서비스에서 최악의 false negative이며, `docs/troubleshooting/2026-04-21-conflict-analysis-fix.md`의 회고 4번이 지목한 바로 그 "조용한 실패"다.

zod 검증 실패만 throw로 바꾸면 **같은 DB 장애가 스키마 불일치면 500, RPC 에러면 "안전"**으로 갈린다.

→ **결정: 지시 범위를 살짝 넘겨 `:24-27`의 error 분기도 throw로 통일한다.**

---

# 확인 불가 항목 — 2번 실행으로 전부 해소됨 (2026-08-14)

| 항목                                                           | 당시 사유                                                        | **실측 결과**                                                                                                                                                                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 실 DB의 `analyze_conflicts` 배포본 SQL 본문                    | 리포에 `.sql` 파일 없음, supabase CLI 미설치·미링크              | 직접 호출로 간접 확인 완료. 문서의 동작과 일치 (그룹 확장 + 양방향 매칭 정상)                                                                                                                                 |
| `severity` 실제 값이 `NULL`인지 빈 문자열인지                  | 위와 동일                                                        | **`null`** (빈 문자열 아님). synergy 19행 전부 null → `z.enum([...]).nullable()` 확정, `"" → null` 전처리 **불필요**                                                                                          |
| `conflict_rules` 컬럼 순서와 `RETURNS TABLE` 9컬럼의 일치 여부 | `SELECT DISTINCT cr.*` 방식이라 `id` 컬럼 포함 시 어긋날 수 있음 | **일치.** 반환 키가 정확히 9개(`ingredient_a, ingredient_b, a_type, b_type, conflict_type, severity, reason_ko, recommend, source`). `id`/`created_at`/`updated_at`은 오지 않음 → 추가 키 stripping 우려 없음 |

## 2번에서 추가로 발견된 사항 (6번 스키마에 반영 필요)

`conflict_rules`의 synergy 행은 **`reason_ko`가 빈 문자열 `""`이고 설명 텍스트가 `recommend` 컬럼에 들어가 있으며 `source`는 `null`**이다. 원인은 `data/csv/conflict_rules.csv`의 필드 수 불일치(헤더 9필드 vs synergy 행 10필드)로 값이 한 칸씩 밀린 것.

→ 6번 스키마에서 `reason_ko`는 반드시 `z.string()` (min 없음). `.min(1)`을 걸면 synergy 행이 전부 검증 실패한다.
→ `lib/analyze/conflict.ts:37`이 `reasonKo: r.reason_ko`로 매핑하므로 시너지 설명이 UI에 빈칸으로 렌더되는 상태다. **데이터 수정은 이번 작업 범위 밖.**

---

## 사전 확정 사실 (조사 완료)

| 항목                     | 사실                                                                                                                                                                                                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 테스트 러너              | **없음.** vitest/jest/playwright 미설치, `package.json`에 `test` 스크립트 없음                                                                                                                                                                                                |
| zod                      | `^4.3.6`. 사용처는 `lib/api/validation.ts` 단일 파일(요청 검증만)                                                                                                                                                                                                             |
| 디바운스/페칭 라이브러리 | **없음.** SWR·react-query·lodash 전무 → `useEffect` + `setTimeout` 직접 구현                                                                                                                                                                                                  |
| shadcn ui                | badge/button/card/checkbox/command/dialog/dropdown-menu/input/label/popover/separator/textarea. **skeleton·spinner·alert·toast 없음** → 로딩은 `Loader2 + animate-spin` (기존 관행 `analyze-container.tsx:244`), 패널은 `rounded-xl border bg-card` (`result-panel.tsx` 패턴) |
| 마이그레이션 SQL         | 리포에 `.sql` 파일 **없음**. RPC 정의는 문서에만 존재                                                                                                                                                                                                                         |
| DB 접근                  | `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 있음 → `tsx` 스크립트로 실 DB 조회 가능                                                                                                                                                                                            |

## 사용자 결정 사항

| 쟁점                         | 결정                                                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4번 "유사도" 표시            | **라벨만 4분류.** similarity 점수 미노출. `types/api.ts`·`match.ts`·route 무변경                                                                                        |
| 5번 `SELECT_SLOT_A` 오버로드 | **`CLEAR_SLOT_B` 액션 신설**                                                                                                                                            |
| 6번 zod 검증 실패            | **throw → 500**                                                                                                                                                         |
| 6번 기존 RPC error 분기      | **함께 throw로 통일** (지시 범위를 살짝 넘김)                                                                                                                           |
| 4번 미매칭 안내 문구         | **사실에 맞게 수정**                                                                                                                                                    |
| 4번 이중 로깅                | **`matchIngredients()`에 로깅 제어 옵션 추가.** 미리보기(`/api/ingredients/match`)는 로깅 끔, 실제 분석(`/api/analyze`)은 켬. `handleConfirm`은 현행대로 원문 전체 전달 |

---

# 1. `normalizeName()` 정규식 — 확인만 (완료)

`lib/ingredients/normalize.ts:7-12` 전문:

```ts
export function normalizeName(raw: string): string {
  return raw
    .replace(/[\(\[\{][\d.\s]*%?\s*[\)\]\}]/g, "") // :9
    .replace(/\s+/g, " ") // :10
    .trim(); // :11
}
```

`node -e` 실측 반환값:

| 입력                     | 반환값                | 괄호 제거 |
| ------------------------ | --------------------- | --------- |
| `"레티놀"`               | `"레티놀"`            | —         |
| `"레티놀(500IU/g)"`      | `"레티놀(500IU/g)"`   | ✗         |
| `"레티놀 (500IU/g)"`     | `"레티놀 (500IU/g)"`  | ✗         |
| `"나이아신아마이드(2%)"` | `"나이아신아마이드"`  | ✓         |
| `"토코페롤(비타민E)"`    | `"토코페롤(비타민E)"` | ✗         |
| `"정제수(물)"`           | `"정제수(물)"`        | ✗         |

`[\d.\s]*%?`는 괄호 안이 **숫자·점·공백·%로만** 구성될 때만 매칭. `IU/g`·`비타민E`·`물`처럼 문자가 섞이면 제거되지 않는다.

# 2. 재현 경로 현재 상태 — 확인만

**실행 방법:** 스크래치패드에 임시 `tsx` 스크립트를 작성하고 `SUPABASE_SERVICE_ROLE_KEY`로 실 DB를 조회한다. **레포에는 파일을 남기지 않는다.**

a~d를 표로 보고. RPC는 **성분명 배열**과 **그룹명 배열** 두 방식으로 각각 호출해 대조한다 (`analyze_conflicts`의 `terms_a = unnest(names_a) UNION groups_a` 구조상 둘 다 매칭 가능). d 판정에는 RPC가 반환하는 `a_type`/`b_type` 컬럼을 사용한다 — 이 컬럼은 `conflict.ts`가 현재 읽지 않는다.

e는 코드 조사로 이미 확정:

- 테스트로 고정돼 있지 **않음** (테스트 파일·러너 자체가 없음)
- 문서로는 고정됨: `docs/troubleshooting/2026-04-21-conflict-analysis-fix.md:24`, `docs/DATA_STATUS.md:13`
- 특정 방식은 **제품명**. 올리브영 코드 `A000000230208`/`A000000171427`은 `data/toyfiles/toy_products.csv:4,6`에만 있고 코드·문서 어디에도 없음

---

# 3. 제품 검색 실배선

**대상:** `components/analyze/product-search.tsx`

- `:24-55` `DUMMY_PRODUCTS` 삭제. `:73` `(typeof DUMMY_PRODUCTS)[number]` → `ProductSearchItem`, `:115` `.map` 대상 교체 (이 3곳은 같은 커밋에서 처리해야 컴파일이 통과한다)
- 상태 추가: `query`, `items`, `loading`, `errorMsg`
- `:111` `CommandInput`에 `value`/`onValueChange` 바인딩, `:110` `<Command shouldFilter={false}>`
- `useEffect` + `setTimeout` 250ms 디바운스 + `AbortController`
- `:92` 팝오버 닫힘 시 `query`/`items` 초기화

**반드시 처리할 함정 (Plan 에이전트 확인):**

| 함정                                                            | 대응                                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `searchQuerySchema`는 `q: min(1)` — 빈 쿼리로 호출하면 400      | `query.trim()`이 비면 fetch 자체를 건너뜀                                                                           |
| cmdk 기본 필터가 서버 결과를 재필터링                           | `shouldFilter={false}` 필수. 라우트가 `%_,()`를 공백 치환(`route.ts:22`)하므로 원문으로 재필터하면 결과가 전부 탈락 |
| `shouldFilter={false}`면 `CommandEmpty`가 빈 쿼리에서도 즉시 뜸 | `query.trim() && !loading && items.length === 0`일 때만 렌더                                                        |
| `AbortController.abort()`가 fetch를 reject                      | catch에서 `err.name === "AbortError"` 제외                                                                          |
| 응답 역전(race)                                                 | AbortController로 이전 요청 취소                                                                                    |
| `CommandItem value` 중복                                        | `value={product.id}` (`shouldFilter={false}` 전제)                                                                  |
| 500 시 Next가 HTML 반환 → `res.json()` throw                    | `!res.ok` 분기 내부에도 try/catch                                                                                   |

# 4. 성분 직접 입력 실배선

**대상:** `components/analyze/manual-input-dialog.tsx` (+ 로깅 옵션은 아래 별항)

- `:19-27` `KNOWN_INGREDIENTS` 삭제, `:55-58` 렌더 중 동기 분류 삭제
- `:46` `matchPreview: boolean` → `matchResult: MatchResponse | null` + `loading` + `errorMsg`
- `:70-73` `handlePreview` → async, `POST /api/ingredients/match`
- `:119-161` 미리보기를 **4분류**로 재구성: 정확 일치(`exact`) / 별칭 일치(`alias`) / 유사 일치(`fuzzy`) / 미매칭. alias·fuzzy는 `raw_name → ingredient_name` 형태로 표시
- `:146` 문구 → **"미매칭 (n) — 분석에서 제외됩니다"** (서버 `resolveSlotNames`가 매칭분만 쓰는 실제 동작에 맞춤)
- `:61-67` `handleOpenChange`와 `:103-107` Textarea onChange에서 `matchResult`/`loading`/`errorMsg` 전부 초기화 (다이얼로그가 `analyze-container.tsx:262-267`에서 상시 마운트라 A→B 전환 시 누수 위험)
- `:76-83` `handleConfirm`은 **현행 유지** — 원문 전체 전달

**반드시 처리할 함정:**

- `:129` `matched.map(ing => <span key={ing}>{ing}</span>)` — `matched`가 `MatchedItem[]`가 되면 `{ing}`는 "Objects are not valid as a React child" 런타임 크래시. `m.raw_name`/`m.ingredient_name`으로 교체, key는 index 기반
- 응답 in-flight 중 텍스트 편집 → 늦은 응답이 새 입력 결과를 덮음. 로딩 중 Textarea/버튼 disabled
- `:112-116` "N개 성분 인식됨"과 `matched+unmatched` 합계가 안 맞을 수 있음 (`match.ts:22-27`의 `normalizedMap`이 같은 정규화 결과를 덮어씀). 합계는 응답 기준으로 표시

**이중 로깅 차단 (사용자 지시):**

- `lib/analyze/match.ts:13-16` — `matchIngredients(rawNames, productId, options?: { logUnmatched?: boolean })`. 기본값 `true`로 현행 동작 보존
- `:106-115` Step 4의 `log_unmatched` 호출을 이 플래그로 감쌈. `unmatchedRaws.push`는 플래그와 무관하게 항상 수행
- `app/api/ingredients/match/route.ts` — `{ logUnmatched: false }`로 호출 (미리보기는 읽기 동작)
- `app/api/analyze/route.ts`의 `resolveSlotNames` — 변경 없음(기본값 `true`)

# 5. reducer 전이 가드

**대상:** `types/analyze.ts`, `components/analyze/analyze-container.tsx`, `components/analyze/step-indicator.tsx`

- `types/analyze.ts:2-7` `AnalyzeStep`에 `"error"` 추가
- `:20-25` `AnalyzeState`에 `error: { code?: string; message: string } | null` 추가, `initialState`(`analyze-container.tsx:20-25`)에 `error: null`
- `:28-33` `AnalyzeAction`에 `{ type: "SET_ERROR"; payload: {...} }`, `{ type: "CLEAR_SLOT_B" }` 추가
- `analyze-container.tsx:30-48` reducer를 전이표 기반으로 재작성. **허용되지 않는 조합은 `state`를 그대로 반환**
- `:112-122` `RESET` → `SET_ERROR`. 서버 에러 바디 `{error:{code,message}}`를 파싱해 메시지로 사용(파싱 실패 시 기본 문구)
- `:131-133` `handleClearSlotB` → `dispatch({ type: "CLEAR_SLOT_B" })`. `state.slotA!` 단언과 `[state.slotA]` 의존성 제거
- `:161-163`/`:242`/`:252` 옆에 **error step 렌더 분기 신설** — 에러 메시지 + `재시도`(START_ANALYZE) + `처음부터`(RESET) 버튼

## 최종 전이표

| action          | 허용 from step   | to step     | 상태 변경                       |
| --------------- | ---------------- | ----------- | ------------------------------- |
| `SELECT_SLOT_A` | `select-a`       | `select-b`  | `slotA = payload`               |
| `SELECT_SLOT_B` | `select-b`       | `ready`     | `slotB = payload`               |
| `CLEAR_SLOT_B`  | `ready`          | `select-b`  | `slotB = null`                  |
| `START_ANALYZE` | `ready`, `error` | `analyzing` | `error = null`, `result = null` |
| `SET_RESULT`    | `analyzing`      | `result`    | `result = payload`              |
| `SET_ERROR`     | `analyzing`      | `error`     | `error = payload`               |
| `RESET`         | 모든 step        | `select-a`  | `initialState`                  |

**이 변경으로 함께 고쳐지는 기존 버그 2건:**

1. `handleClearSlotB`가 `SELECT_SLOT_A`를 dispatch해 step만 `select-b`로 바꾸고 **`slotB`를 지우지 않아** B 뱃지가 남는 데드엔드 (`analyze-container.tsx:131-133` + reducer `:36`). `CLEAR_SLOT_B`가 `slotB: null`을 명시해 해소
2. 분석 중 로고 클릭(RESET) 후 늦게 도착한 응답이 `SET_RESULT`로 `select-a` 화면을 하이재킹하던 문제. `SET_RESULT`가 `analyzing`에서만 허용되어 차단

**StepIndicator 대응 (`step-indicator.tsx:10-25`):** `AnalyzeStep`은 `types/analyze.ts:21`과 이 파일에서만 소비되고, `:18-25`는 exhaustive switch가 아니라 배열+`indexOf`다. 따라서 **`"error"`를 추가해도 컴파일 에러가 0건이고 런타임에 조용히 깨진다** (`indexOf` → `-1` → 4개 단계 전부 회색). 대응:

- `stepOrder`를 `["select-a","select-b","ready","analyzing","error","result"]`로
- `steps[2].key`를 `["ready","analyzing","error"]`로 확장

`error`를 `result` 뒤에 두면 실패했는데 "결과 확인"에 ✓가 찍히므로 위 배치가 유일한 정합 배치다.

# 6. RPC 응답 zod 검증

**대상:** `lib/api/validation.ts`, `lib/analyze/conflict.ts`, `lib/analyze/match.ts`

`lib/api/validation.ts` 끝에 추가:

- `analyzeConflictsRowSchema` / `analyzeConflictsRowsSchema`
- `fuzzyMatchRowSchema` / `fuzzyMatchRowsSchema`

**스키마 설계 핵심 — `lib/database.types.ts:304-314`가 거짓말을 한다.** 자동생성 타입은 9개 컬럼을 전부 non-nullable `string`으로 선언하지만, 실제 DDL(`docs/DB_SCHEMA.md:290-310`)은 `severity`/`recommend`/`source`가 NULL 허용이고 `data/csv/conflict_rules.csv`의 synergy 29행은 severity가 빈칸이다.

- `severity`는 반드시 **nullable**. `z.enum([...]).nullable()`로 두지 않으면 synergy 행 전부가 검증 실패해 배열 단위 parse에서 분석 결과 전체가 날아간다. 빈 문자열이 오는지는 **2번의 실 DB 조회로 먼저 확인**하고 필요 시 `""` → `null` 전처리를 넣는다
- `recommend`, `source`도 nullable. `reason_ko`는 NOT NULL이지만 빈 문자열 허용(`z.string()`, min 없음)
- `.strict()` 금지 — RPC 본문이 `SELECT DISTINCT cr.*`라 `id`/`created_at` 등 추가 키가 올 수 있다. 기본 `z.object`의 stripping에 의존
- `conflict_type: z.enum(["avoid","caution","synergy"])`로 두면 `conflict.ts:33`의 synergy 분기 이후 TS가 `"avoid"|"caution"`으로 좁혀 **`:43`·`:44` 단언이 자동 제거**된다. `:32`까지 합쳐 명시된 단언 3곳 전부 제거
- fuzzy: `{ ingredient_id: z.uuid(), name: z.string(), similarity: z.number() }`. `match.ts:87`이 현재 `error`를 구조분해조차 안 하므로 `error` 수신을 추가하고 `data ?? []`를 parse

## 검증 실패 시 처리 (사용자 결정)

**`throw` → 500 에러 응답.** 근거: `result-panel.tsx:22,80-90`은 빈 결과를 "안전한 조합입니다!" 초록 패널로 렌더한다. 검증 실패를 빈 결과로 흘리면 성분 충돌 서비스에서 최악의 false negative가 된다.

- `conflict.ts` — 검증 실패 시 `console.error`로 zod issues를 남기고 throw. `app/api/analyze/route.ts:32-62`의 포괄 try/catch가 받아 `:59-62`에서 500 `DB_ERROR` 반환 → 5번의 error step이 사용자에게 표시
- `conflict.ts:24-27`의 **기존 RPC error 분기도 함께 throw**로 통일. 스키마 불일치는 500, RPC 에러는 "안전"이라는 비대칭을 없앤다
- `match.ts` — 검증 실패 시 throw. 두 경로로 전파: ① `/api/ingredients/match`의 catch → 500 `DB_ERROR`, ② `/api/analyze`의 `resolveSlotNames` → `:59` catch → 500 `DB_ERROR`
- **주의:** `resolveSlotNames`가 throw하면 `app/api/analyze/route.ts:51-54`의 422 `EMPTY_SLOT` 분기에 도달하지 못하고 500이 된다
- 에러 코드는 기존 `DB_ERROR` 재사용. 새 코드를 쓰려면 `lib/api/errors.ts:2-8`의 `ApiErrorCode` union에 추가해야 하며(미추가 시 컴파일 에러), 이번엔 추가하지 않는다

**범위 밖으로 남기는 것:** `match.ts:64-67`(alias 조인 단언), `:113`(`log_unmatched`의 `as string`)은 RPC **응답** 검증이 아니므로 그대로 둔다.

---

## 검증 방법

각 단계 완료 후 `pnpm type-check && pnpm lint`를 돌린다 (테스트 러너가 없으므로 이것이 유일한 자동 검증이다).

`pnpm dev` 후 수동 시나리오:

1. **3번** — 슬롯 A 팝오버를 열어 빈 상태에서 "검색 결과가 없습니다"가 안 뜨는지 → `메디힐` 입력 시 로딩 후 실 DB 결과 → 빠르게 지웠다 다시 입력해 리스트가 이전 결과로 덮이지 않는지 → 한글 IME 조합 중 깜빡임 없는지 → `zzzz` 입력 시 결과 없음 표시
2. **4번** — `레티놀, 구연산, 레티놀(500IU/g), zzz` 입력 후 "성분 확인" → 정확/별칭/유사/미매칭 4분류가 구분돼 표시되는지. 미매칭 문구가 "분석에서 제외됩니다"인지. 실행 전후로 `unmatched_log`의 `occurrence_count`를 조회해 **미리보기만으로는 증가하지 않고 실제 분석 시에만 1 증가**하는지 확인
3. **5번** — 슬롯 A/B 선택 → B의 X 클릭 시 B 뱃지가 실제로 사라지고 `select-b`로 복귀하는지 → 분석 중 로고 클릭 후 응답이 늦게 와도 결과 화면이 뜨지 않는지 → 네트워크 탭에서 `/api/analyze`를 offline으로 막아 error step 진입 → 재시도 버튼이 슬롯을 유지한 채 재분석하는지 → StepIndicator가 error에서 "분석 준비"를 활성 표시하는지
4. **6번** — 2번에서 만든 tsx 스크립트로 `analyze_conflicts`를 직접 호출해 실제 응답이 새 스키마를 통과하는지 확인(특히 synergy 행의 severity). 이니스프리 × 메디힐 조합이 여전히 `AHA 계열 vs 레티놀 계열 (avoid, high)`를 반환하는지 회귀 확인

## 진행 순서

1~2번을 먼저 실행하고 보고. 그 다음 3 → 4 → 5 → 6을 **한 단계씩** 진행하며 각 단계마다 변경 파일·삭제 상수·전이표를 보고한다.
