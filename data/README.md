# data/ — 시드 데이터

부딪(Budit) 서비스의 초기 DB 시드 데이터입니다.

---

## 디렉토리 구조

```
data/
└── csv/
    ├── ingredients.csv              # 성분 마스터 (KCIA 기준)
    ├── ingredient_groups.csv        # 성분 그룹 정의 (The Ordinary 충돌 차트 기반)
    ├── ingredient_group_members.csv # 성분 ↔ 그룹 매핑
    ├── ingredient_aliases.csv       # 성분 별칭 (비표준 표기 → 표준명)
    ├── products.csv                 # 올리브영 상위 제품 목록
    ├── product_ingredients.csv      # 제품 ↔ 성분 매핑 (전성분)
    └── conflict_rules.csv          # 충돌/시너지 규칙
```

---

## 시드 실행 순서 (FK 의존성)

```
1. ingredients.csv
2. ingredient_groups.csv
3. ingredient_group_members.csv  ← ingredients + ingredient_groups 필요
4. ingredient_aliases.csv        ← ingredients 필요
5. products.csv
6. product_ingredients.csv       ← products + ingredients 필요
7. conflict_rules.csv            ← 독립적 (ingredients.name / group_name 참조)
```

> CSV의 참조 필드는 **자연 키(이름)**를 사용합니다.  
> 시드 스크립트가 이름을 조회하여 UUID로 변환한 후 삽입합니다.

---

## 각 CSV 파일 작성 가이드

### `ingredients.csv`

| 컬럼          | 필수 | 설명                                                          |
| ------------- | ---- | ------------------------------------------------------------- |
| name          | ✅   | KCIA 국문 표준명 (고유값)                                     |
| name_en       |      | INCI 영문명                                                   |
| category      |      | 비타민A 계열 / 알파하이드록시산 / 보습제 / 진정제 / 방부제 등 |
| is_restricted | ✅   | `true` / `false`                                              |
| restrict_info |      | 식약처 사용 제한 정보 (is_restricted=true 시 입력)            |

> 현재 약 38개 핵심 성분 기입됨.  
> **KCIA 전체 성분 DB (~21,805개)는 별도 확보 필요.**

---

### `ingredient_groups.csv`

| 컬럼        | 필수 | 설명                                     |
| ----------- | ---- | ---------------------------------------- |
| group_name  | ✅   | 그룹명 (고유값, conflict_rules에서 참조) |
| description |      | 그룹 설명                                |

> 현재 8개 그룹 기입됨. The Ordinary 충돌 차트의 모든 그룹을 커버해야 합니다.

---

### `ingredient_group_members.csv`

| 컬럼            | 필수 | 설명                                |
| --------------- | ---- | ----------------------------------- |
| group_name      | ✅   | `ingredient_groups.group_name` 참조 |
| ingredient_name | ✅   | `ingredients.name` 참조             |

> 하나의 성분이 여러 그룹에 속할 수 있습니다. (예: 구연산은 AHA 계열이면서 pH 조절제)

---

### `ingredient_aliases.csv`

| 컬럼            | 필수 | 설명                             |
| --------------- | ---- | -------------------------------- |
| alias           | ✅   | 비표준 표기 (고유값)             |
| ingredient_name | ✅   | `ingredients.name` 참조 (표준명) |
| source          | ✅   | `manual` / `auto`                |

> 매칭 로직 우선순위: `ingredients.name` 정확 매칭 → `ingredient_aliases.alias` 정확 매칭 → pg_trgm 유사도 매칭  
> 알리아스가 많을수록 직접 입력 매칭 품질이 향상됩니다.

---

### `products.csv`

| 컬럼                 | 필수 | 설명                                               |
| -------------------- | ---- | -------------------------------------------------- |
| name                 | ✅   | 제품명                                             |
| brand                | ✅   | 브랜드명                                           |
| category             | ✅   | `skincare` / `mask_pack` / `cleansing` / `suncare` |
| oliveyoung_id        |      | 올리브영 상품 ID (URL에서 추출)                    |
| oliveyoung_rank      |      | 카테고리 내 순위 (낮을수록 검색 상단 노출)         |
| image_url            |      | 제품 이미지 URL                                    |
| source_url           |      | 올리브영 상품 페이지 URL                           |
| raw_ingredients_text |      | 올리브영에서 긁어온 원본 전성분 텍스트             |

> 목표: **4개 카테고리 × 30개 = 120개 제품**  
> 현재 14개 예시 기입됨. 나머지는 올리브영에서 직접 수집 필요.

---

### `product_ingredients.csv`

| 컬럼            | 필수 | 설명                                              |
| --------------- | ---- | ------------------------------------------------- |
| product_name    | ✅   | `products.name` 참조                              |
| ingredient_name | ✅   | `ingredients.name` 참조 (표준명으로 변환 후 입력) |
| display_order   | ✅   | 함량 내림차순 순서 (1부터 시작)                   |
| raw_name        | ✅   | 제품 전성분 표기 그대로 (파싱 원본)               |

> `ingredient_name`은 `ingredients.csv`에 등록된 표준명이어야 합니다.  
> 미등록 성분은 먼저 `ingredients.csv`에 추가하거나, 시드 스크립트가 `unmatched_log`에 기록합니다.

---

### `conflict_rules.csv`

| 컬럼          | 필수 | 설명                                                                            |
| ------------- | ---- | ------------------------------------------------------------------------------- |
| ingredient_a  | ✅   | 성분명 또는 그룹명 (가나다/알파벳 오름차순에서 앞쪽)                            |
| ingredient_b  | ✅   | 성분명 또는 그룹명 (오름차순에서 뒤쪽)                                          |
| a_type        | ✅   | `ingredient` / `group` — ingredient_a가 성분명이면 ingredient, 그룹명이면 group |
| b_type        | ✅   | `ingredient` / `group` — ingredient_b의 텀 종류                                 |
| conflict_type | ✅   | `avoid` / `caution` / `synergy`                                                 |
| severity      |      | `high` / `medium` / `low` — `synergy` 시 비워두기                               |
| reason_ko     | ✅   | 충돌/시너지 이유 (한국어, 사용자에게 표시)                                      |
| recommend     |      | 권장사항 (사용자에게 표시)                                                      |
| source        |      | 출처 (The Ordinary / KFDA / Paula's Choice / manual 등)                         |

> **a_type / b_type 작성 기준:**
>
> - `ingredient_groups.csv`에 있는 이름 → `group`
> - `ingredients.csv`에 있는 이름 → `ingredient`
>
> **Canonical 순서 규칙:** `ingredient_a < ingredient_b` (오름차순)으로 입력.  
> 시드 스크립트가 자동 정렬하지만, 데이터 가독성을 위해 CSV에서도 맞춰두기를 권장합니다.  
> 현재 13개 규칙 기입됨 (충돌 9개 + 시너지 4개).  
> **The Ordinary 공식 충돌 차트의 나머지 규칙 추가 필요.**

---

## 주요 참고 자료

- [The Ordinary 성분 충돌 가이드](https://theordinary.com/en-us/routines)
- [KCIA 화장품 성분 사전](https://kcia.or.kr)
- [식약처 사용제한 원료 목록](https://www.mfds.go.kr)
- [Paula's Choice 성분 사전](https://www.paulaschoice.com/ingredient-dictionary)
