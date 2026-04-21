# 충돌 분석 버그 수정 트러블슈팅 기록

- **날짜:** 2026-04-21
- **작성자:** bbyik-k
- **프로젝트:** BUDIT — 화장품 성분 충돌 분석 서비스
- **심각도:** High (핵심 기능 완전 미동작)
- **소요 시간:** 약 3시간

---

## 배경 및 문제 개요

BUDIT은 사용자가 두 화장품 제품을 선택하면 성분 간 충돌 여부를 분석해주는 서비스다. 주요 DB 테이블 구성은 다음과 같다.

| 테이블                     | 역할                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| `ingredients`              | 성분 마스터 (name, inci_name 등)                                 |
| `ingredient_groups`        | 성분 계열 그룹 (AHA 계열, 레티놀 계열 등)                        |
| `ingredient_group_members` | 성분 ↔ 그룹 N:M 매핑                                             |
| `conflict_rules`           | 충돌 규칙 (ingredient_a vs ingredient_b, severity, reason_ko 등) |
| `products`                 | 제품 마스터                                                      |
| `product_ingredients`      | 제품 ↔ 성분 N:M 매핑                                             |

**테스트 케이스:** 이니스프리 레티놀 앰플 × 메디힐 더마 패드(마데카소사이드) 조합에서 `AHA 계열 vs 레티놀 계열 (avoid, high)` 충돌이 감지되어야 하지만, 앱에서 "충돌 없음"으로 잘못 표시됨.

문제는 단일 원인이 아닌 **세 가지 독립적인 버그가 겹쳐** 발생한 것이었으며, 각 버그를 순서대로 찾고 해결하는 과정이 필요했다.

---

## 문제 1: 시트릭애씨드가 AHA 계열 그룹에 미등록

### 증상

메디힐 더마 패드에 포함된 `시트릭애씨드` 성분이 AHA 계열 그룹 멤버로 등록되지 않아, 충돌 분석 시 AHA 계열로 확장되지 않음.

### 원인 분석

성분 데이터 마이그레이션 과정에서 성분명 표기 방식이 변경되었는데, 그룹 멤버 CSV가 이를 반영하지 못했다.

- **구버전** `data/csv/_ingredients.csv`: `구연산` (한자 기반 표기)
- **신버전** `data/toyfiles/toy_ingredients.csv`: `시트릭애씨드` (INCI 음차 표기)
- **`ingredient_group_members.csv` L11**: 여전히 `AHA 계열,구연산` 참조

시드 스크립트(`scripts/seed.ts`) 실행 시 `구연산` 성분이 `ingredients` 테이블에 존재하지 않으므로 "성분 없음" 경고 후 해당 행을 스킵 → `시트릭애씨드`가 AHA 계열 그룹에 삽입되지 않음.

또한 이 과정에서 `ingredient_group_members` upsert의 숨겨진 버그도 발견되었다.

```typescript
// 기존 코드 (버그): onConflict 미지정으로 복합 키가 적용되지 않음
await supabase
  .from("ingredient_group_members")
  .upsert(rows, { ignoreDuplicates: true }); // ← onConflict 없음!

// 수정 후: 복합 PK를 명시적으로 지정
await supabase.from("ingredient_group_members").upsert(rows, {
  onConflict: "group_id,ingredient_id", // ← 복합 키 지정
  ignoreDuplicates: true,
});
```

`onConflict`가 없으면 `ignoreDuplicates`가 의도대로 동작하지 않아, 재시드 시 `23505 (unique_violation)` 에러가 발생하는 부가 문제도 있었다.

### 해결 방법

**1) `data/csv/ingredient_group_members.csv` 수정**

```diff
- AHA 계열,구연산
+ AHA 계열,시트릭애씨드
```

**2) `data/csv/ingredient_aliases.csv`에 alias 3건 추가**

| alias           | canonical      | source |
| --------------- | -------------- | ------ |
| `구연산`        | `시트릭애씨드` | manual |
| `Citric Acid`   | `시트릭애씨드` | manual |
| `시트릭 애씨드` | `시트릭애씨드` | manual |

**3) `scripts/seed.ts` upsert 수정**

`ingredient_group_members` upsert에 `onConflict: "group_id,ingredient_id"` 추가.

---

## 문제 2: 레티놀이 AHA 계열에 잘못 등록된 DB 오염

### 증상

문제 1을 해결하고 시드를 재실행했음에도 충돌이 여전히 미감지됨. DB를 직접 조회하자 `레티놀 → AHA 계열` 매핑이 존재하는 것을 발견.

### 원인 분석

과거 어느 시점에 `레티놀`이 `AHA 계열` 그룹 멤버로 잘못 삽입된 DB 오염(data corruption)이 존재했다.

`seed.ts`의 upsert 전략은 "없으면 삽입, 있으면 무시"이므로 **기존에 잘못 삽입된 레코드는 제거되지 않는다.** 이 상태에서 충돌 분석 로직이 어떻게 동작하는지 추적하면:

```
termsA (이니스프리 레티놀 앰플):
  = [레티놀, ...기타 성분명] + [레티놀 계열, AHA 계열, ...]
  #                                             ^^^^^
  #                         레티놀이 AHA 계열 멤버로 오염되어
  #                         termsA에 AHA 계열이 포함됨

termsB (메디힐 더마패드):
  = [시트릭애씨드, ...기타 성분명] + [AHA 계열, ...]

conflict_rules: "AHA 계열" vs "레티놀 계열"
  → termsA에 "AHA 계열" ✓
  → termsA에 "레티놀 계열" ✓
  → termsB에 "AHA 계열" ✓
  → termsB에 "레티놀 계열" ✗  ← 없음

매칭 시도:
  (A:AHA 계열, B:레티놀 계열) → termsB에 레티놀 계열 없음 → 미매칭
  (A:레티놀 계열, B:AHA 계열) → termsA에 레티놀 계열 있고, termsB에 AHA 계열 있음 → 매칭!
```

아이러니하게도 레티놀 계열이 termsA에는 포함되어 있으므로 매칭이 되어야 하지만, 당시 `conflict.ts`의 쿼리 자체가 URL 길이 초과로 실패(문제 3)하고 있었기 때문에 DB 오염의 영향을 정확히 파악하기가 어려웠다.

### 해결 방법

DB에서 잘못된 레코드를 직접 삭제:

```sql
DELETE FROM ingredient_group_members
WHERE ingredient_id = (SELECT id FROM ingredients WHERE name = '레티놀')
  AND group_id     = (SELECT id FROM ingredient_groups WHERE group_name = 'AHA 계열');
```

삭제 후 시드 재실행으로 `레티놀 → 레티놀 계열` 정상 등록 확인.

---

## 문제 3: URL 길이 초과로 충돌 분석 쿼리 조용히 실패 (핵심 버그)

### 증상

DB 데이터를 모두 정상화했음에도 앱에서 계속 "충돌 없음"이 표시됨. `conflict.ts`에 임시 `console.log`를 추가하여 서버 로그를 확인한 결과 다음 에러 메시지를 발견:

```
hint: "HTTP headers exceeded server limits (typically 16KB).
Your request URL is 10101 characters.
If filtering with large arrays, consider using an RPC function instead."
```

Supabase `.or()` 호출이 조용히 실패하고 `rules = null`을 반환했으며, 코드는 `null`을 빈 배열로 처리하여 "충돌 없음"으로 표시하고 있었다.

### 원인 분석

기존 `conflict.ts`의 충돌 규칙 조회 방식:

```typescript
// 기존 코드 (버그): 모든 성분명을 URL 쿼리 파라미터로 직렬화
const toCsv = (terms: string[]) =>
  terms.map((t) => t.replace(/[(),]/g, " ").trim()).join(",");

const csvA = toCsv(termsA);
const csvB = toCsv(termsB);

const { data: rules } = await supabase
  .from("conflict_rules")
  .select("*")
  .or(
    `and(ingredient_a.in.(${csvA}),ingredient_b.in.(${csvB})),` +
      `and(ingredient_a.in.(${csvB}),ingredient_b.in.(${csvA}))`
  );
```

문제점은 두 가지였다.

**① URL 길이 초과**

- 이니스프리 레티놀 앰플: 성분 35개
- 메디힐 더마패드: 성분 34개
- 여기에 각 성분의 그룹명까지 추가하면 `termsA`, `termsB` 각각 40~50개 문자열
- 한국어 성분명은 UTF-8 인코딩 시 글자당 3바이트 → 퍼센트 인코딩 후 실제 요청 URL **10,101자**
- Supabase REST API (PostgREST)의 HTTP 헤더 한계(~16KB)를 초과

**② 성분명 변조 버그**

`toCsv()` 내 `t.replace(/[(),]/g, " ")` 처리가 `1,2-헥산다이올`의 쉼표를 공백으로 바꿔버려 성분명이 `1 2-헥산다이올`로 변조됨. 이 경우 해당 성분이 포함된 충돌 규칙은 절대 매칭되지 않는다.

### 해결 방법: Supabase RPC 함수로 전환

URL 파라미터 대신 POST 요청으로 배열을 전달하는 DB 함수를 생성하여 근본 원인을 해결했다.

**마이그레이션 (`add_analyze_conflicts_rpc`):**

```sql
CREATE OR REPLACE FUNCTION analyze_conflicts(
  names_a TEXT[],
  names_b TEXT[]
)
RETURNS TABLE (
  ingredient_a TEXT,
  ingredient_b TEXT,
  a_type       TEXT,
  b_type       TEXT,
  conflict_type TEXT,
  severity      TEXT,
  reason_ko     TEXT,
  recommend     TEXT,
  source        TEXT
)
LANGUAGE sql
STABLE
AS $$
  WITH
  -- 이름으로 성분 ID 조회
  ids_a AS (
    SELECT id FROM ingredients WHERE name = ANY(names_a)
  ),
  ids_b AS (
    SELECT id FROM ingredients WHERE name = ANY(names_b)
  ),
  -- 각 성분 집합이 속한 그룹명 조회
  groups_a AS (
    SELECT DISTINCT ig.group_name
    FROM ingredient_group_members m
    JOIN ingredient_groups ig ON ig.id = m.group_id
    WHERE m.ingredient_id IN (SELECT id FROM ids_a)
  ),
  groups_b AS (
    SELECT DISTINCT ig.group_name
    FROM ingredient_group_members m
    JOIN ingredient_groups ig ON ig.id = m.group_id
    WHERE m.ingredient_id IN (SELECT id FROM ids_b)
  ),
  -- 성분명 + 그룹명을 합친 검색 텀
  terms_a AS (
    SELECT unnest(names_a) AS term
    UNION
    SELECT group_name FROM groups_a
  ),
  terms_b AS (
    SELECT unnest(names_b) AS term
    UNION
    SELECT group_name FROM groups_b
  )
  -- 양방향으로 충돌 규칙 매칭
  SELECT DISTINCT cr.*
  FROM conflict_rules cr
  WHERE
    (
      cr.ingredient_a IN (SELECT term FROM terms_a)
      AND cr.ingredient_b IN (SELECT term FROM terms_b)
    )
    OR
    (
      cr.ingredient_a IN (SELECT term FROM terms_b)
      AND cr.ingredient_b IN (SELECT term FROM terms_a)
    );
$$;
```

**`lib/analyze/conflict.ts` 리팩터링:**

```typescript
// 수정 후: supabase.rpc()로 전환 (POST 요청, URL 길이 제한 없음)
export async function analyzeConflicts(
  namesA: string[],
  namesB: string[]
): Promise<ConflictResult[]> {
  const supabase = await createClient();

  const { data: rules, error } = await supabase.rpc("analyze_conflicts", {
    names_a: namesA,
    names_b: namesB,
  });

  if (error) {
    console.error("[analyzeConflicts] RPC 오류:", error);
    return [];
  }

  // 결과 분류 및 반환
  // ...
}
```

**결과 확인:**

이니스프리 레티놀 앰플 × 메디힐 더마패드 조합에서 `AHA 계열 vs 레티놀 계열 (avoid, high)` 충돌 정상 감지 완료.

---

## 수정된 파일 목록

| 파일                                    | 변경 내용                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `data/csv/ingredient_group_members.csv` | `AHA 계열,구연산` → `AHA 계열,시트릭애씨드` 교체                                |
| `data/csv/ingredient_aliases.csv`       | 구연산/Citric Acid/시트릭 애씨드 alias 3건 추가                                 |
| `scripts/seed.ts`                       | `ingredient_group_members` upsert에 `onConflict: "group_id,ingredient_id"` 추가 |
| `lib/analyze/conflict.ts`               | toCsv+.or() 방식 → `supabase.rpc("analyze_conflicts")` 전환                     |
| DB 마이그레이션                         | `analyze_conflicts` RPC 함수 신규 생성                                          |
| DB 직접 수정                            | `레티놀 → AHA 계열` 잘못된 레코드 DELETE                                        |

---

## 회고 및 배운 점

### 1. 데이터 마이그레이션 시 참조 일관성 검증 자동화 필요

성분명 표기 방식을 변경할 때 (`구연산` → `시트릭애씨드`) 연관 CSV 파일(`ingredient_group_members.csv`)이 함께 업데이트되지 않아 데이터 불일치가 발생했다. 이는 데이터를 사람이 수동으로 관리하는 구조의 취약점이다.

**방지책:** 시드 스크립트 실행 시 외래 키 참조 무결성 검증 단계를 추가해야 한다. 예를 들어, `ingredient_group_members.csv`의 모든 성분명이 `ingredients.csv`에 존재하는지 시드 전 사전 검증하고, 미존재 시 경고가 아닌 에러로 중단시켜야 한다.

```typescript
// 예시: 시드 전 참조 무결성 검증
const missingIngredients = groupMemberRows.filter(
  (row) => !ingredientNames.has(row.ingredientName)
);
if (missingIngredients.length > 0) {
  throw new Error(
    `참조 무결성 오류: ${missingIngredients.map((r) => r.ingredientName).join(", ")} 성분이 없습니다.`
  );
}
```

### 2. Supabase upsert의 onConflict는 항상 명시적으로 지정해야 한다

`upsert({ ignoreDuplicates: true })`만으로는 복합 키 테이블에서 의도대로 동작하지 않는다. Supabase(PostgREST)의 upsert는 `onConflict`가 없으면 테이블의 기본 키를 기준으로 동작하는데, 복합 기본 키의 경우 명시적 지정이 없으면 예측 불가능한 동작이 발생할 수 있다.

**규칙:** 복합 키를 가진 테이블에 upsert할 때는 항상 `onConflict`를 명시한다.

### 3. DB 시드는 "추가"만 하므로 오염된 데이터는 별도로 정리해야 한다

`upsert + ignoreDuplicates` 전략은 idempotent하게 데이터를 추가하는 데는 적합하지만, **잘못된 기존 데이터를 자동으로 제거하지 않는다.** 이번처럼 `레티놀 → AHA 계열` 같은 잘못된 매핑이 존재할 경우 시드를 아무리 재실행해도 수정되지 않는다.

**방지책:** 데이터 정합성이 중요한 그룹 멤버십 테이블은 시드 시 "삭제 후 재삽입" 전략을 고려해야 한다. 또는 주기적으로 데이터 정합성을 검증하는 스크립트를 운영해야 한다.

```typescript
// 대안 전략: truncate 후 재삽입 (환경에 따라 선택)
await supabase.from("ingredient_group_members").delete().neq("id", 0);
await supabase.from("ingredient_group_members").insert(rows);
```

### 4. 외부 API 호출 실패는 항상 명시적으로 로깅해야 한다

Supabase `.or()` 쿼리가 URL 초과로 실패했을 때 `data = null`을 반환했고, 코드는 이를 "충돌 규칙 없음"으로 해석하여 조용히 "충돌 없음"을 반환했다. 에러 핸들링이 없었기 때문에 이 실패가 오랫동안 숨겨져 있었다.

**규칙:** 외부 API 호출 결과는 항상 `error` 체크를 통해 명시적으로 로깅하고, 실패 시 명확한 에러 상태를 반환해야 한다.

```typescript
// 나쁜 예: 에러를 무시하고 data만 사용
const { data: rules } = await supabase.from("conflict_rules").select("*").or(...);

// 좋은 예: 에러를 반드시 체크
const { data: rules, error } = await supabase.from("conflict_rules").select("*").or(...);
if (error) {
  console.error("[analyzeConflicts] 쿼리 실패:", error);
  throw new Error("충돌 분석 쿼리 실패");
}
```

### 5. 대용량 배열 필터링에는 RPC가 필수다

한국어 성분명처럼 멀티바이트 문자열로 구성된 대용량 배열을 URL 쿼리 파라미터로 전달하면 금방 서버 한계에 도달한다. Supabase가 에러 hint로 "RPC 함수를 사용하라"고 직접 안내하고 있으므로, 설계 단계에서 배열 크기를 고려하여 RPC 방식을 선택해야 한다.

**기준:** 배열 요소가 10개를 초과하거나 한국어/CJK 문자열이 포함된 경우 RPC 방식을 기본으로 선택한다.

---

## 타임라인 요약

| 시간  | 작업                                                                           |
| ----- | ------------------------------------------------------------------------------ |
| 00:00 | 충돌 미감지 버그 접수, 재현 확인                                               |
| 00:20 | DB 직접 조회로 시트릭애씨드 AHA 계열 미등록 발견 (문제 1)                      |
| 00:40 | ingredient_group_members.csv 수정, seed.ts onConflict 버그 수정 및 시드 재실행 |
| 01:00 | 여전히 미감지 → DB 조회로 레티놀 → AHA 계열 오염 발견 (문제 2)                 |
| 01:20 | SQL DELETE로 오염 레코드 제거, 시드 재실행                                     |
| 01:40 | 여전히 미감지 → console.log 추가로 서버 로그 확인                              |
| 02:00 | URL 10,101자 초과 에러 발견 (문제 3)                                           |
| 02:30 | analyze_conflicts RPC 함수 작성 및 마이그레이션 적용                           |
| 03:00 | conflict.ts 리팩터링 완료, 충돌 정상 감지 확인                                 |
