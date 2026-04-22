# TODO: 성분 비교 분석 API 성능 개선

## 현황

`POST /api/analyze` 호출 시 2~3초의 지연이 발생한다.

## 원인 분석

### 병목 지점: `lib/analyze/match.ts` — `matchIngredients()`

manual 타입 슬롯(직접 입력)의 경우 아래 4단계 매칭 엔진을 순차 실행한다.

| 단계       | 작업                                                         | 예상 지연           |
| ---------- | ------------------------------------------------------------ | ------------------- |
| Step 1     | `ingredients` 테이블 정확 일치 조회                          | ~100–200ms          |
| Step 2     | `ingredient_aliases` 별칭 조회                               | ~100–200ms          |
| **Step 3** | `match_ingredient_fuzzy` RPC를 미매칭 성분마다 **순차** 호출 | **~50–100ms × N개** |
| Step 4     | `log_unmatched` RPC를 미매칭 성분마다 **순차** 호출          | ~20–50ms × M개      |
| 최종       | `analyze_conflicts` RPC (그룹 확장 + 양방향 매칭)            | ~200–500ms          |

**핵심 문제**: Step 3–4에서 `for` 루프로 RPC를 순차 호출한다.
미매칭 성분 10개 기준 Step 3만 ~1초 누적, 여기에 나머지 DB 왕복이 더해져 2~3초에 도달한다.

### product vs manual 속도 차이

- `product` 타입: DB에서 성분 ID를 바로 조회 → 빠름
- `manual` 타입: 전체 매칭 엔진 경유 → 느림

## 개선 방안

### 1. Step 3 Fuzzy 매칭 병렬화 (우선순위: 높음)

```typescript
// AS-IS: 순차 호출
for (const term of afterStep2) {
  const { data } = await supabase.rpc("match_ingredient_fuzzy", {
    term,
    threshold: 0.9,
  });
}

// TO-BE: 병렬 호출
const fuzzyResults = await Promise.all(
  afterStep2.map((term) =>
    supabase.rpc("match_ingredient_fuzzy", { term, threshold: 0.9 })
  )
);
```

### 2. Step 4 `log_unmatched` 병렬화 (우선순위: 중간)

```typescript
// TO-BE
await Promise.all(
  afterStep3.map((term) =>
    adminSupabase.rpc("log_unmatched", {
      p_raw_name: term,
      p_product_id: productId,
    })
  )
);
```

### 3. 배치 Fuzzy 매칭 RPC 도입 (우선순위: 중간)

현재 `match_ingredient_fuzzy`는 단일 term만 받는다.
`match_ingredients_fuzzy_batch(terms text[], threshold float)`처럼 배열을 받는 DB 함수를 만들면
네트워크 왕복 횟수 자체를 1회로 줄일 수 있다.

### 4. `analyze_conflicts` RPC 쿼리 최적화 (우선순위: 낮음)

- `ingredient_groups` 확장 쿼리의 인덱스 적용 여부 확인
- `conflict_rules` 테이블 복합 인덱스 검토 (`ingredient_a`, `ingredient_b`)

## 예상 효과

| 개선 항목     | 예상 단축           |
| ------------- | ------------------- |
| Step 3 병렬화 | ~500–900ms          |
| Step 4 병렬화 | ~100–300ms          |
| 배치 RPC      | 추가 ~200ms         |
| **합계**      | **~0.8–1.4초 단축** |

목표: 2~3초 → **1초 이내**

## 관련 파일

- `lib/analyze/match.ts` — matchIngredients(), 4단계 매칭 엔진
- `lib/analyze/conflict.ts` — analyzeConflicts(), DB RPC 호출
- `app/api/analyze/route.ts` — API 엔드포인트, resolveSlotNames()
- `app/api/ingredients/match/route.ts` — 매칭 전용 API
