# 데이터 현황 정리 — 시드 파일과 실제 DB 대조

> 작성일: 2026-08-07. Supabase 실측(PostgREST `count=exact`)과 코드·git 이력을 대조하여 확인된 사실 기록.

---

## 1. DB의 products는 toy_products.csv 6건이 맞는가?

**맞다.** Supabase `products` 테이블 6건과 `data/toyfiles/toy_products.csv` 6행이 이름·UUID까지 1:1로 일치한다.

- 시드 스크립트가 products 삽입 시 읽는 파일이 `toy_products.csv`다 (scripts/seed.ts:312).
- `data/csv/_products.csv`(14행)는 시드에서 사용되지 않는다.
- DB 6건: 에스트라 아토베리어365 크림 80ml, 토리든 다이브인 저분자 히알루론산 세럼 50ml, 이니스프리 레티놀 시카 흔적 앰플 30ml (skincare 3), 메디힐 에센셜 마스크팩·더마 패드(마데카소사이드), 메노킨 퀵 버블 마스크(리프트) (mask_pack 3). **suncare/cleansing은 0건.**

## 1-2. 6건만 사용하게 된 경위

**명시적 ADR은 없다.** 추적 가능한 기록:

| 기록                               | 내용                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 커밋 `d33a423`                     | "🌱 chore(seed): CSV 시드 스크립트 구현 및 **토이 데이터 추가**" — seed.ts와 toyfiles 3종이 함께 추가된 시점     |
| shrimp 태스크 기록 (Task 010 계획) | "toy_products.csv → products 테이블 (**6개**)" — 처음부터 6개가 계획 수치로 명시됨                               |
| data/README.md                     | "KCIA 전체 성분 DB (~21,805개)는 **별도 확보 필요**" — 전체 데이터 미확보 상태에서 축소 데이터셋으로 진행한 정황 |
| docs/ROADMAP.md Task 009           | "120개 제품 / 21,805개 성분"이라는 **계획 수치 그대로 완료(✅) 처리**되어 실제 실행 내용과 불일치                |

→ "전체 데이터 확보 전 MVP 검증용 축소 데이터셋"이라는 추정이 정황상 타당하나, 의사결정 자체를 기록한 문서는 부재.

## 2. 실제로 Supabase에 들어간 파일 (scripts/seed.ts 기준)

| 테이블                   | 소스 파일                                | CSV행 → DB행 (실측)              | seed.ts 근거 |
| ------------------------ | ---------------------------------------- | -------------------------------- | ------------ |
| ingredients              | **toyfiles/toy_ingredients.csv**         | 128 → 159 \*                     | :151         |
| ingredient_groups        | csv/ingredient_groups.csv                | 26 → 26                          | :188         |
| ingredient_group_members | csv/ingredient_group_members.csv         | 158 → 158                        | :225         |
| ingredient_aliases       | csv/ingredient_aliases.csv               | 50 → 40 (대상 성분 없는 행 스킵) | :270, :279   |
| products                 | **toyfiles/toy_products.csv**            | 6 → 6                            | :312         |
| product_ingredients      | **toyfiles/toy_product_ingredients.csv** | 222 → 222                        | :356         |
| conflict_rules           | csv/conflict_rules.csv                   | 52 → 52                          | :422         |

\* ingredients 159 구성 (실측 대조): toy 128 + conflict_rules 참조용 generic 자동 추가 2 (seed.ts:442 로직) + 구 `_ingredients.csv`에만 있던 잔존 5 + `ingredient_group_members.csv`에만 등장하는 26. 뒤의 31건은 과거 시드·정합성 복구(커밋 `ad97c3e`) 과정의 누적으로 보이며 정확한 투입 경로 기록은 없음.

## 3. mock인가 실서버 데이터인가 — 혼합

| 영역                    | 방식                                                                                                                                                               | 근거                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 제품 검색 UI            | **하드코딩 mock** — `DUMMY_PRODUCTS` 6건. 단 UUID는 실제 DB UUID와 전부 일치 확인. 서버 검색 API(`/api/products/search`)는 구현돼 있으나 UI 어디서도 호출하지 않음 | components/analyze/product-search.tsx:24             |
| 성분 직접 입력 미리보기 | **하드코딩 mock** — `KNOWN_INGREDIENTS` Set으로 클라이언트에서만 매칭 미리보기                                                                                     | components/analyze/manual-input-dialog.tsx:19        |
| 충돌 분석               | **실서버 데이터** — `/api/analyze` POST → DB `product_ingredients` 조회 + `analyze_conflicts` RPC                                                                  | app/api/analyze/route.ts, lib/analyze/conflict.ts:19 |

→ 입구(검색·미리보기)는 mock, 핵심 분석 파이프라인은 실서버.

## 4. data/ 파일별 용도

| 파일                                   | 행 수 | 상태           | 설명                                                                              |
| -------------------------------------- | ----- | -------------- | --------------------------------------------------------------------------------- |
| `README.md`                            | —     | 문서           | 시드 데이터 작성 가이드                                                           |
| `toyfiles/toy_products.csv`            | 6     | ✅ 실사용      | 제품 마스터 (올리브영 실제 제품 6종 + 전성분 원문 텍스트). DB products의 소스     |
| `toyfiles/toy_ingredients.csv`         | 128   | ✅ 실사용      | 성분 마스터 (KCIA 표준명, INCI 영문명, 계열, 제한 여부). DB ingredients의 주 소스 |
| `toyfiles/toy_product_ingredients.csv` | 222   | ✅ 실사용      | 제품↔성분 매핑 (raw_name 원문 + 표준 ingredient_name + 표시 순서)                 |
| `csv/ingredient_groups.csv`            | 26    | ✅ 실사용      | 성분 그룹 정의 (레티놀 계열, AHA 계열 등 — The Ordinary 충돌 차트 기반)           |
| `csv/ingredient_group_members.csv`     | 158   | ✅ 실사용      | 성분↔그룹 매핑 (충돌 규칙을 그룹 단위로 적용하기 위한 소속 정보)                  |
| `csv/ingredient_aliases.csv`           | 50    | ✅ 실사용      | 별칭 사전 (비타민C→아스코빅애씨드 등 비표준 표기 → 표준명)                        |
| `csv/conflict_rules.csv`               | 52    | ✅ 실사용      | 충돌/시너지 규칙 (avoid 9, caution 14, synergy 29 — 사유·권장 포함)               |
| `csv/_ingredients.csv`                 | 38    | ❌ 구버전 백업 | 커밋 `ad97c3e`에서 "`_`접두사 백업으로 이전"으로 명시됨                           |
| `csv/_products.csv`                    | 14    | ❌ 구버전 백업 | 초기 설계 제품 목록 (전성분 텍스트 없음)                                          |
| `csv/_product_ingredients.csv`         | 26    | ❌ 구버전 백업 | 초기 제품-성분 매핑                                                               |
| `csv/ingredient_group_members_v0.csv`  | 24    | ❌ 구버전 백업 | 한방식 표기 → INCI 음차 표기 전면 교체(커밋 `ad97c3e`) 전 보존본                  |
| `.DS_Store`                            | —     | 시스템 파일    | macOS 자동 생성 (gitignore 대상)                                                  |

---

## 6. 적재 전 상태 (2026-08-18)

358건 제품 전성분 적재(`scripts/ingest-products.ts`) 직전의 전수 백업 시점 스냅샷이다.
`scripts/backup-fixtures.ts`가 각 테이블의 백업 행 수와 PostgREST `count=exact` 값을 대조해
전부 일치함을 확인한 뒤 기록했다.

- 백업 시각(`takenAt`): `2026-08-18T05:36:11.534Z`
- 백업 파일: `data/fixtures/backup-2026-08-18.json` (198KB, 총 663행)
- 이 파일은 `.gitignore`의 `/data/fixtures/` 규칙으로 **커밋되지 않는다** (로컬 복구용)

| 테이블                   | 백업 행 수 | DB 실제 count | 일치 |
| ------------------------ | ---------- | ------------- | ---- |
| ingredients              | 159        | 159           | ✅   |
| ingredient_groups        | 26         | 26            | ✅   |
| ingredient_group_members | 158        | 158           | ✅   |
| ingredient_aliases       | 40         | 40            | ✅   |
| products                 | 6          | 6             | ✅   |
| product_ingredients      | 222        | 222           | ✅   |
| conflict_rules           | 52         | 52            | ✅   |
| **합계**                 | **663**    | **663**       | ✅   |

백업 대상이 아닌 `unmatched_log`는 같은 시점에 15행이었다 (전부 `product_id IS NULL`,
`source = 'user_input'`, 최대 `occurrence_count` 4). 적재 시 `logUnmatched: true`로
동작하므로 이 수치가 7-6 이후 증가분의 기준선이 된다.

### 복구 방법

`backup-*.json`의 `tables` 키는 위 표의 순서(FK 의존성 순)로 정렬되어 있다.
복구가 필요하면 그 순서대로 각 배열을 해당 테이블에 upsert하면 된다.
