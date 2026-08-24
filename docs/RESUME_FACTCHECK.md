# 이력서 첨부용 프로젝트 사실 확인 (코드 기반)

> 작성일: 2026-08-06. 개선안/제안 없이 코드·문서·git 이력에서 확인된 사실만 기록.
> 리포에는 `.sql` 마이그레이션 파일이 없음 (마이그레이션은 Supabase MCP로 직접 적용됨).
> 따라서 **DB에 실제 적용된 인덱스/함수 본문은 코드로 확인 불가**이며, 문서에 수록된 SQL 정의를 근거로 표기함.

---

## Q1. pg_trgm 적용 대상

### gin_trgm_ops 인덱스 (문서 정의 기준 — 실제 DB 적용 여부는 코드로 확인 불가)

| 테이블             | 컬럼                       | 인덱스명                     | 근거                  |
| ------------------ | -------------------------- | ---------------------------- | --------------------- |
| products           | name                       | idx_products_name_trgm       | docs/DB_SCHEMA.md:341 |
| products           | brand                      | idx_products_brand_trgm      | docs/DB_SCHEMA.md:342 |
| products           | (name \|\| ' ' \|\| brand) | idx_products_combined_trgm   | docs/DB_SCHEMA.md:343 |
| ingredients        | name                       | idx_ingredients_name_trgm    | docs/DB_SCHEMA.md:347 |
| ingredients        | name_en                    | idx_ingredients_name_en_trgm | docs/DB_SCHEMA.md:348 |
| ingredient_aliases | alias                      | idx_aliases_trgm             | docs/DB_SCHEMA.md:351 |

### 나머지 항목

| 항목                                                 | 확인 결과                                                                                                                                                                                                                                                                                                                                   | 근거                                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 제품 검색 API가 매칭하는 컬럼                        | `products.name`, `products.brand` — `.or("name.ilike.%q%,brand.ilike.%q%")`                                                                                                                                                                                                                                                                 | app/api/products/search/route.ts:28                                                                                           |
| ingredients.name 부분 문자열 검색 사용자 대면 UI/API | **부재.** 검색 API는 products 전용. `/api/ingredients/match`(POST)는 정확/별칭/유사도 매칭이며 부분 문자열 검색 아님. 또한 검색 UI(`product-search.tsx`)는 현재 `/api/products/search`를 호출하지 않고 하드코딩된 `DUMMY_PRODUCTS`를 사용, 성분 직접 입력 다이얼로그도 하드코딩 `KNOWN_INGREDIENTS` Set으로 클라이언트 매칭 미리보기만 수행 | components/analyze/product-search.tsx:24, components/analyze/manual-input-dialog.tsx:19, app/api/ingredients/match/route.ts:8 |
| `similarity()` 사용 위치                             | 앱 코드(.ts/.tsx)에는 **없음**. `match_ingredient_fuzzy` RPC의 SQL 본문(리포에는 태스크 기록 JSON에만 수록)에서 사용. 시그니처는 자동생성 타입에 존재                                                                                                                                                                                       | shrimp_data/memory/tasks_memory_2026-04-21T23-07-21.json:455, lib/database.types.ts:320–325                                   |
| `%` 연산자 사용 위치                                 | **없음** (코드·문서 SQL 전체 grep 0건)                                                                                                                                                                                                                                                                                                      | —                                                                                                                             |

---

## Q2. 성분 매칭 폴백 실제 구조

| 항목                                         | 확인 결과                                                                                                                                                                                                     | 근거                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 매칭 로직 파일                               | lib/analyze/match.ts                                                                                                                                                                                          | lib/analyze/match.ts:13                                                                    |
| 유사도 임계값                                | `0.9` — **상수 파일이 아니라 RPC 호출부에 인라인 리터럴로 하드코딩**                                                                                                                                          | lib/analyze/match.ts:89 (`{ term, threshold: 0.9 }`)                                       |
| `set_limit()` 호출                           | **없음** (grep 0건)                                                                                                                                                                                           | —                                                                                          |
| unmatched_log 기록 방식                      | 단순 insert 아님 — `log_unmatched` RPC 호출이며, RPC 정의는 `ON CONFLICT ... DO UPDATE SET occurrence_count = occurrence_count + 1`인 **atomic upsert** (정의 SQL은 태스크 기록에만 존재, 배포본은 확인 불가) | lib/analyze/match.ts:109–114, shrimp_data/memory/tasks_memory_2026-04-21T23-07-21.json:455 |
| unmatched_log를 select하는 애플리케이션 코드 | **부재** (`from("unmatched_log")` grep 0건 — 쓰기 전용)                                                                                                                                                       | —                                                                                          |

### 실행 순서

| 단계 | 내용                                                                                  | 구분   | 근거                                                          |
| ---- | ------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------- |
| 0    | `normalizeName()`: 괄호 안 농도 표기 제거, 연속 공백 정리, trim + normalized→raw 매핑 | 전처리 | lib/ingredients/normalize.ts:7–12, lib/analyze/match.ts:22–27 |
| 1    | `ingredients.name` 정확 일치 (`.in("name", ...)`)                                     | 매칭   | lib/analyze/match.ts:35–38                                    |
| 2    | `ingredient_aliases.alias` 정확 일치 (1단계 미매칭분만)                               | 매칭   | lib/analyze/match.ts:56–59                                    |
| 3    | `match_ingredient_fuzzy` RPC — 미매칭 성분마다 **순차 호출**, threshold 0.9           | 매칭   | lib/analyze/match.ts:86–90                                    |
| 4    | 잔여 미매칭 → `log_unmatched` RPC (service_role `adminSupabase` 사용)                 | 로깅   | lib/analyze/match.ts:106–114                                  |

---

## Q3. Supabase RPC 전환

| 항목                      | 확인 결과                                                                                                                                                                                                                                                      | 근거                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 현재 충돌 조회 방식       | `supabase.rpc("analyze_conflicts", { names_a, names_b })` — 시그니처 `analyze_conflicts(names_a TEXT[], names_b TEXT[])`                                                                                                                                       | lib/analyze/conflict.ts:19–22                                                                  |
| 정의된 SQL 파일           | 리포에 `.sql` 파일 **없음**. SQL 전문은 트러블슈팅 문서에 수록 (마이그레이션명 `add_analyze_conflicts_rpc`)                                                                                                                                                    | docs/troubleshooting/2026-04-21-conflict-analysis-fix.md:191 이하                              |
| 전환 커밋                 | `03271e4` "🐛 fix(analyze): 충돌 분석 쿼리 URL 초과 버그 수정 — RPC 전환" (2026-04-21). diff에서 전환 전 코드가 **GET + `.or()` + `toCsv` 방식이었음을 확인** — `conflict_rules.select("*").or("and(ingredient_a.in.(csvA),ingredient_b.in.(csvB)),and(...)")` | `git show 03271e4` (lib/analyze/conflict.ts 삭제부)                                            |
| URL에 실리던 값의 성격    | **성분명 + 그룹명 합산 리스트** (`termsA = [...namesA, ...groupNamesA]` 중복 제거 후 CSV 직렬화) — 커밋 diff에서 확인                                                                                                                                          | `git show 03271e4` 삭제부 (구 conflict.ts의 termsA/termsB 생성 로직)                           |
| 최대 개수                 | 코드상 **상한 없음** (analyzeBodySchema의 ingredients 배열에 max 제약 없음). 실측치는 문서 기준: 성분 34~35개 + 그룹명 포함 슬롯당 40~50개, URL 10,101자                                                                                                       | lib/api/validation.ts:36–40, docs/troubleshooting/2026-04-21-conflict-analysis-fix.md:172–178  |
| URL 길이 제한값 명시 여부 | **명시됨** — 에러 hint 원문 "HTTP headers exceeded server limits (typically 16KB)" 및 "PostgREST의 HTTP 헤더 한계(~16KB)". 코드 주석에는 "10KB+ 초과"로 기재                                                                                                   | docs/troubleshooting/2026-04-21-conflict-analysis-fix.md:142, 178 / lib/analyze/conflict.ts:11 |

---

## Q4. useReducer 상태 머신

| 항목           | 확인 결과                                                                                                                                             | 근거                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| reducer 파일   | components/analyze/analyze-container.tsx (`analyzeReducer`)                                                                                           | components/analyze/analyze-container.tsx:30–48                           |
| step 유니온 값 | `"select-a" \| "select-b" \| "ready" \| "analyzing" \| "result"` — **5개**                                                                            | types/analyze.ts:2–7 (`AnalyzeStep`)                                     |
| action type    | `SELECT_SLOT_A`, `SELECT_SLOT_B`, `START_ANALYZE`, `SET_RESULT`, `RESET` — **5개**                                                                    | types/analyze.ts:28–33 (`AnalyzeAction`)                                 |
| error 상태     | step에 **미포함**, 별도 error 필드도 **없음** (state는 step/slotA/slotB/result 4필드). API 오류·fetch 예외 시 `RESET`을 dispatch하여 초기 상태로 복귀 | types/analyze.ts:20–25, components/analyze/analyze-container.tsx:112–122 |

### 전이 표

reducer는 현재 step을 검사하지 않음 — 모든 action이 **어느 step에서든** 동일하게 전이시킴 (from은 실제 dispatch 지점 기준).

| action        | 실제 dispatch되는 step (호출부 기준)                                  | → step               | 근거                                             |
| ------------- | --------------------------------------------------------------------- | -------------------- | ------------------------------------------------ |
| SELECT_SLOT_A | select-a (검색/수동입력), 슬롯 B 해제 시(ready 등)                    | select-b             | analyze-container.tsx:36, 132, 145, 178          |
| SELECT_SLOT_B | select-b / ready (검색/수동입력)                                      | ready                | analyze-container.tsx:38, 147, 204               |
| START_ANALYZE | ready (분석 버튼)                                                     | analyzing            | analyze-container.tsx:40, 105                    |
| SET_RESULT    | analyzing (API 성공)                                                  | result               | analyze-container.tsx:42, 118                    |
| RESET         | 임의 step (로고 클릭 이벤트, 슬롯 A 해제, API 오류, 결과 화면 재시작) | select-a (초기 상태) | analyze-container.tsx:44, 92, 114, 121, 127, 257 |

---

## Q5. 시드 데이터 실제 규모 + 검증 계층

### CSV 행 수 (헤더 제외)

질문에 명시된 `products.csv`/`ingredients.csv`/`product_ingredients.csv`는 존재하지 않으며, 실제 파일명은 `_` 접두사 버전임 (data/README.md:12–18의 파일명과 실제 파일명 불일치).

| 파일 (data/csv/)             | 행 수  | 비고                                                                                              |
| ---------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| \_products.csv               | **14** | README.md:16의 "상위 120개 제품"과 불일치. DB 실제 적재는 **6건** (아래 "실제 DB 적재 규모" 참조) |
| \_ingredients.csv            | 38     | data/README.md:52 "약 38개 핵심 성분"과 일치                                                      |
| \_product_ingredients.csv    | 26     |                                                                                                   |
| ingredient_groups.csv        | 26     |                                                                                                   |
| ingredient_group_members.csv | 158    | 구버전 ingredient_group_members_v0.csv(24행) 별도 존재                                            |
| ingredient_aliases.csv       | 50     |                                                                                                   |
| conflict_rules.csv           | 52     |                                                                                                   |

### \_products.csv category별 행 수

| category  | 행 수 |
| --------- | ----- |
| skincare  | 8     |
| mask_pack | 2     |
| suncare   | 2     |
| cleansing | 2     |

→ "4개 카테고리 × 각 30개" **아님** (CSV 기준). DB 실제 값도 skincare 3 / mask_pack 3 뿐 (아래 참조).

### conflict_rules 값 종류 (52행 전수 집계)

| 컬럼          | 값 종류 (건수)                                                    |
| ------------- | ----------------------------------------------------------------- |
| conflict_type | `avoid` (9), `caution` (14), `synergy` (29)                       |
| severity      | `high` (9), `medium` (13), `low` (1), 빈값 (29 — 전부 synergy 행) |

### 실제 DB 적재 규모 (2026-08-06, anon 키로 PostgREST count=exact 조회)

| 테이블                   | 실제 행 수 | CSV 행 수 | 비고                                                                                                               |
| ------------------------ | ---------- | --------- | ------------------------------------------------------------------------------------------------------------------ |
| products                 | **6**      | 14        | skincare 3, mask_pack 3. README.md:16 "상위 120개"와 불일치                                                        |
| ingredients              | **159**    | 38        | CSV보다 훨씬 많음 (CSV 외 경로로 적재된 것으로 보임 — 적재 경로는 코드로 확인 불가)                                |
| ingredient_groups        | 26         | 26        | 일치                                                                                                               |
| ingredient_group_members | 158        | 158       | 일치                                                                                                               |
| ingredient_aliases       | **40**     | 50        | 불일치                                                                                                             |
| product_ingredients      | **222**    | 26        | 불일치                                                                                                             |
| conflict_rules           | 52         | 52        | 일치                                                                                                               |
| unmatched_log            | 0 반환     | —         | anon 키는 RLS로 읽기 제외 대상(docs/DB_SCHEMA.md 정책상 anon 읽기 7개 테이블에서 제외)이므로 **실제 값 확인 불가** |

DB의 products 6건 전체: 에스트라 아토베리어365 크림 80ml, 토리든 다이브인 저분자 히알루론산 세럼 50ml, 이니스프리 레티놀 시카 흔적 앰플 30ml (이상 skincare), 메디힐 에센셜 마스크팩(마데카소사이드), 메디힐 더마 패드(마데카소사이드), 메노킨 퀵 버블 마스크(리프트) (이상 mask_pack). **suncare, cleansing 카테고리는 DB에 0건.**

### zod 스키마와 호출 지점

스키마 정의 파일은 **lib/api/validation.ts 단일 파일** (그 외 zod import 없음).

| 스키마                               | 정의                           | 호출 지점                                           | 검증 대상              |
| ------------------------------------ | ------------------------------ | --------------------------------------------------- | ---------------------- |
| searchQuerySchema                    | lib/api/validation.ts:4        | app/api/products/search/route.ts:9 (`safeParse`)    | 요청 쿼리 파라미터 `q` |
| matchBodySchema                      | lib/api/validation.ts:16       | app/api/ingredients/match/route.ts:26 (`safeParse`) | 요청 body              |
| analyzeBodySchema (+내부 slotSchema) | lib/api/validation.ts:44 (:25) | app/api/analyze/route.ts:21 (`safeParse`)           | 요청 body              |

→ 검증 대상은 **요청(쿼리 파라미터 + body)만**. DB/RPC 응답에 대한 zod 검증은 **없음** (RPC 응답은 타입 단언으로만 처리 — lib/analyze/conflict.ts:32, 43–44).

---

## 부록. 리포 외부 근거 원문

본문에서 근거로 인용한 `shrimp_data/memory/tasks_memory_2026-04-21T23-07-21.json`은 **gitignore 처리된 파일**이라 리포를 받아도 열람할 수 없으므로, 해당 SQL 원문(태스크 구현 가이드에 수록된 마이그레이션 SQL)을 여기에 옮겨 둔다. 이는 마이그레이션 적용 시점의 정의이며, 현재 DB에 배포된 함수 본문과의 일치 여부는 코드로 확인 불가.

```sql
CREATE OR REPLACE FUNCTION match_ingredient_fuzzy(term TEXT, threshold FLOAT)
RETURNS TABLE(ingredient_id UUID, name TEXT, similarity FLOAT) AS $$
  SELECT i.id, i.name, similarity(i.name, term) AS sim
  FROM ingredients i WHERE similarity(i.name, term) >= threshold
  UNION
  SELECT a.ingredient_id, i.name, similarity(a.alias, term)
  FROM ingredient_aliases a JOIN ingredients i ON i.id = a.ingredient_id
  WHERE similarity(a.alias, term) >= threshold
  ORDER BY sim DESC LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION log_unmatched(p_raw_name TEXT, p_product_id UUID)
RETURNS VOID AS $$
  INSERT INTO unmatched_log (raw_name, product_id, occurrence_count)
  VALUES (p_raw_name, p_product_id, 1)
  ON CONFLICT (raw_name, product_id)
  DO UPDATE SET occurrence_count = unmatched_log.occurrence_count + 1;
$$ LANGUAGE sql;
```

그 외 파일 단독으로 재검증이 불가능한 근거:

- `git show 03271e4` (Q3 전환 커밋) — 리포의 git 히스토리 필요. 다만 전환 전 `.or()` 코드 원문은 본문 Q3 표에 인용해 둠.
- 실제 DB 적재 규모 (Q5) — Supabase 접근 키 필요. 조회 방법(anon 키 + PostgREST `count=exact`)과 조회 일자(2026-08-06)를 본문에 명시해 둠.
