# 부딪 (Budit) DB 설계 문서

## 개요

민감성 피부 사용자를 위한 화장품 성분 충돌 분석 서비스의 데이터베이스 설계.  
PostgreSQL (Supabase) + `pg_trgm` 확장을 기반으로 설계되었습니다.

---

## 테이블 구성 및 관계

```
products ──────────────────── product_ingredients ──── ingredients
                                                            │
                                                     ingredient_aliases
                                                            │
                                                 ingredient_group_members ── ingredient_groups

conflict_rules  (ingredients.name 또는 ingredient_groups.group_name을 TEXT로 참조)

unmatched_log   (매칭 실패 원문 성분명 누적 로그 — 런타임 생성, 시드 불필요)
```

**테이블 수:** 8개  
**시드가 필요한 테이블:** 7개 (`unmatched_log` 제외)  
**시드 실행 순서 (FK 의존성):**

```
ingredients
  → ingredient_groups
    → ingredient_group_members
    → ingredient_aliases
products
  → product_ingredients
conflict_rules  (독립적 — 마지막에 실행 가능)
```

---

## 테이블별 상세 설명

### 1. `products` — 화장품 제품

올리브영 상위 120개 제품 (4개 카테고리 × 30개).

| 컬럼                 | 타입          | 설명                                       |
| -------------------- | ------------- | ------------------------------------------ |
| id                   | UUID PK       | 자동 생성                                  |
| name                 | TEXT NOT NULL | 제품명                                     |
| brand                | TEXT NOT NULL | 브랜드명                                   |
| category             | TEXT NOT NULL | skincare / mask_pack / cleansing / suncare |
| oliveyoung_id        | TEXT UNIQUE   | 올리브영 상품 고유 ID                      |
| oliveyoung_rank      | INT           | 카테고리 내 랭킹 (검색 결과 정렬 기준)     |
| image_url            | TEXT          | 제품 이미지 URL                            |
| source_url           | TEXT          | 올리브영 상품 페이지 URL                   |
| raw_ingredients_text | TEXT          | 원본 전성분 텍스트 (파싱 원본 보존)        |
| created_at           | TIMESTAMPTZ   | 생성 일시                                  |
| updated_at           | TIMESTAMPTZ   | 수정 일시 (트리거로 자동 갱신)             |

---

### 2. `ingredients` — 성분 마스터

KCIA 기준 한국어 표준 성분명 DB (~21,805개).

| 컬럼          | 타입                 | 설명                              |
| ------------- | -------------------- | --------------------------------- |
| id            | UUID PK              | 자동 생성                         |
| name          | TEXT UNIQUE NOT NULL | KCIA 국문 표준명                  |
| name_en       | TEXT                 | INCI 영문명                       |
| category      | TEXT                 | 비타민 / 산 / 보습제 / 방부제 등  |
| is_restricted | BOOLEAN              | 식약처 사용제한 원료 여부         |
| restrict_info | TEXT                 | 제한 농도, 적용 부위 등 세부 정보 |
| created_at    | TIMESTAMPTZ          | 생성 일시                         |

---

### 3. `ingredient_groups` — 성분 그룹

The Ordinary 충돌 차트 기반 그룹 정의 (~10-15개).  
충돌 규칙은 개별 성분이 아닌 **그룹 단위**로 정의됩니다.

| 컬럼        | 타입                 | 설명                         |
| ----------- | -------------------- | ---------------------------- |
| id          | UUID PK              | 자동 생성                    |
| group_name  | TEXT UNIQUE NOT NULL | "레티놀 계열", "AHA 계열" 등 |
| description | TEXT                 | 그룹 설명                    |
| created_at  | TIMESTAMPTZ          | 생성 일시                    |

---

### 4. `ingredient_group_members` — 성분 ↔ 그룹 N:M

| 컬럼                            | 타입                           | 설명              |
| ------------------------------- | ------------------------------ | ----------------- |
| id                              | UUID PK                        | 자동 생성         |
| group_id                        | UUID FK → ingredient_groups.id | ON DELETE CASCADE |
| ingredient_id                   | UUID FK → ingredients.id       | ON DELETE CASCADE |
| UNIQUE(group_id, ingredient_id) |                                | 중복 방지         |

---

### 5. `product_ingredients` — 제품 ↔ 성분 N:M

| 컬럼                              | 타입                     | 설명                                 |
| --------------------------------- | ------------------------ | ------------------------------------ |
| id                                | UUID PK                  | 자동 생성                            |
| product_id                        | UUID FK → products.id    | ON DELETE CASCADE                    |
| ingredient_id                     | UUID FK → ingredients.id | ON DELETE RESTRICT                   |
| display_order                     | INT NOT NULL             | 함량 내림차순 표기 순서 (1부터 시작) |
| raw_name                          | TEXT NOT NULL            | 원문 성분명 보존 (파싱 전 원본)      |
| UNIQUE(product_id, ingredient_id) |                          | 중복 방지                            |

---

### 6. `conflict_rules` — 충돌 / 시너지 규칙

충돌 분석의 핵심 테이블. `ingredient_a`, `ingredient_b`는  
`ingredients.name` 또는 `ingredient_groups.group_name`을 TEXT로 직접 참조합니다.

**설계 결정:** 충돌 분석 알고리즘은 성분명과 그룹명을 하나의 "텀 집합"으로 평탄화하여 처리합니다.  
폴리모픽 FK 없이 TEXT 참조 + 양방향 쿼리가 현 데이터 규모에 가장 적합합니다.  
`a_type` / `b_type` 컬럼으로 텀 종류를 명시하여 시드 검증과 운영 편의성을 확보합니다.

| 컬럼                                     | 타입          | 설명                                                 |
| ---------------------------------------- | ------------- | ---------------------------------------------------- |
| id                                       | UUID PK       | 자동 생성                                            |
| ingredient_a                             | TEXT NOT NULL | 성분명 또는 그룹명 (가나다/알파벳 정렬 시 앞쪽)      |
| ingredient_b                             | TEXT NOT NULL | 성분명 또는 그룹명 (정렬 시 뒤쪽)                    |
| a_type                                   | TEXT NOT NULL | `ingredient` / `group` — ingredient_a의 텀 종류      |
| b_type                                   | TEXT NOT NULL | `ingredient` / `group` — ingredient_b의 텀 종류      |
| conflict_type                            | TEXT NOT NULL | avoid / caution / synergy                            |
| severity                                 | TEXT          | high / medium / low — synergy 시 NULL 허용           |
| reason_ko                                | TEXT NOT NULL | 충돌/시너지 이유 (한국어)                            |
| recommend                                | TEXT          | 권장사항                                             |
| source                                   | TEXT          | 출처 (The Ordinary / KFDA / Paula's Choice / manual) |
| created_at                               | TIMESTAMPTZ   | 생성 일시                                            |
| updated_at                               | TIMESTAMPTZ   | 수정 일시 (트리거로 자동 갱신)                       |
| UNIQUE(ingredient_a, ingredient_b)       |               | 중복 방지                                            |
| CHECK ingredient_a ≠ ingredient_b        |               | 자기 충돌 방지                                       |
| CHECK severity NOT NULL if avoid/caution |               | 데이터 정합성                                        |

**Canonical 순서 규칙:** 삽입 시 `ingredient_a < ingredient_b` (가나다/알파벳 오름차순)로 정렬.  
시드 스크립트에서 자동 처리 예정.

**a_type / b_type의 역할:**

- 분석 쿼리는 `ANY(terms)` 방식이므로 타입 컬럼이 쿼리 성능에 영향을 주지 않음
- 시드 후 검증 쿼리에서 `a_type = 'ingredient'`인 행이 `ingredients.name`에 실제 존재하는지 확인 가능
- 향후 관리 화면 / 규칙 편집 UI에서 드롭다운 분기 기준으로 활용

---

### 7. `ingredient_aliases` — 성분 별칭

비표준 표기, 관용어, 영문 약어 등을 표준명으로 매핑.

| 컬럼          | 타입                     | 설명              |
| ------------- | ------------------------ | ----------------- |
| id            | UUID PK                  | 자동 생성         |
| alias         | TEXT UNIQUE NOT NULL     | 비표준 표기       |
| ingredient_id | UUID FK → ingredients.id | ON DELETE CASCADE |
| source        | TEXT                     | manual / auto     |
| created_at    | TIMESTAMPTZ              | 생성 일시         |

---

### 8. `unmatched_log` — 매칭 실패 로그

**시드 불필요** — 사용자 입력 또는 시드 파싱 실패 시 API 서버가 자동 기록.

| 컬럼             | 타입                  | 설명                              |
| ---------------- | --------------------- | --------------------------------- |
| id               | UUID PK               | 자동 생성                         |
| raw_name         | TEXT NOT NULL         | 매칭 실패한 원문 성분명           |
| product_id       | UUID FK (nullable)    | 발생 제품 (직접 입력 시 NULL)     |
| source           | TEXT                  | seed / user_input                 |
| occurrence_count | INT DEFAULT 1         | 동일 raw_name 재입력 시 누적 집계 |
| resolved         | BOOLEAN DEFAULT FALSE | 관리자가 성분 추가 후 TRUE 처리   |
| created_at       | TIMESTAMPTZ           | 생성 일시                         |

`occurrence_count`를 내림차순 정렬하면 DB에 추가해야 할 성분 우선순위를 파악할 수 있습니다.

---

## 충돌 분석 알고리즘

```
1. 각 슬롯의 성분 ID 확보
   - product 타입: product_ingredients 테이블 조회 (product_id → ingredient_ids)
   - manual 타입: /api/ingredients/match 로 텍스트 파싱 + DB 매칭

2. 각 성분의 소속 그룹명 확보
   - ingredient_group_members 테이블 조회 (ingredient_id → group_names)

3. 슬롯별 텀 집합 생성
   - terms = { 개별 성분명 } ∪ { 소속 그룹명 }

4. 충돌 규칙 양방향 조회
   SELECT * FROM conflict_rules
   WHERE (ingredient_a = ANY(terms_a) AND ingredient_b = ANY(terms_b))
      OR (ingredient_a = ANY(terms_b) AND ingredient_b = ANY(terms_a))

5. 결과 분류
   - conflict_type = 'avoid' / 'caution' → conflicts 배열
   - conflict_type = 'synergy' → synergies 배열
```

---

## 성분 매칭 우선순위

```
1. ingredients.name 정확 매칭 (exact match)
2. ingredient_aliases.alias 정확 매칭
3. pg_trgm 유사도 90% 이상 (ingredients.name 또는 alias)
4. 매칭 실패 → unmatched_log 기록
```

입력 텍스트 전처리: `괄호 내 농도 제거 "/\s*[\(\[\{][\d.]+\s*%?\s*[\)\]\}]/g"` → 공백 정규화

---

## SQL 스키마

```sql
-- 확장 활성화
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- products
CREATE TABLE products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  brand                 TEXT NOT NULL,
  category              TEXT NOT NULL CHECK (category IN ('skincare','mask_pack','cleansing','suncare')),
  oliveyoung_id         TEXT UNIQUE,
  oliveyoung_rank       INT,
  image_url             TEXT,
  source_url            TEXT,
  raw_ingredients_text  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ingredients
CREATE TABLE ingredients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT UNIQUE NOT NULL,
  name_en        TEXT,
  category       TEXT,
  is_restricted  BOOLEAN NOT NULL DEFAULT FALSE,
  restrict_info  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ingredient_groups
CREATE TABLE ingredient_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name   TEXT UNIQUE NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ingredient_group_members
CREATE TABLE ingredient_group_members (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID NOT NULL REFERENCES ingredient_groups(id) ON DELETE CASCADE,
  ingredient_id  UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  UNIQUE(group_id, ingredient_id)
);

-- product_ingredients
CREATE TABLE product_ingredients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id  UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  display_order  INT NOT NULL CHECK (display_order > 0),
  raw_name       TEXT NOT NULL,
  UNIQUE(product_id, ingredient_id)
);

-- conflict_rules
CREATE TABLE conflict_rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_a   TEXT NOT NULL,
  ingredient_b   TEXT NOT NULL,
  -- 텀 종류 명시: 분석 쿼리에는 영향 없음, 시드 검증 및 운영 편의성 용도
  a_type         TEXT NOT NULL CHECK (a_type IN ('ingredient', 'group')),
  b_type         TEXT NOT NULL CHECK (b_type IN ('ingredient', 'group')),
  conflict_type  TEXT NOT NULL CHECK (conflict_type IN ('avoid','caution','synergy')),
  severity       TEXT CHECK (severity IN ('high','medium','low')),
  reason_ko      TEXT NOT NULL,
  recommend      TEXT,
  source         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ingredient_a, ingredient_b),
  CONSTRAINT no_self_conflict CHECK (ingredient_a <> ingredient_b),
  CONSTRAINT severity_required_for_conflict
    CHECK (conflict_type = 'synergy' OR severity IS NOT NULL)
);
CREATE TRIGGER trg_conflict_rules_updated_at
  BEFORE UPDATE ON conflict_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ingredient_aliases
CREATE TABLE ingredient_aliases (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias          TEXT UNIQUE NOT NULL,
  ingredient_id  UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  source         TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','auto')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- unmatched_log
CREATE TABLE unmatched_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_name         TEXT NOT NULL,
  product_id       UUID REFERENCES products(id) ON DELETE SET NULL,
  source           TEXT NOT NULL DEFAULT 'user_input' CHECK (source IN ('seed','user_input')),
  occurrence_count INT NOT NULL DEFAULT 1,
  resolved         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (raw_name, product_id)
);
```

---

## 인덱스

```sql
-- products: pg_trgm GIN 검색
CREATE INDEX idx_products_name_trgm        ON products USING gin (name gin_trgm_ops);
CREATE INDEX idx_products_brand_trgm       ON products USING gin (brand gin_trgm_ops);
CREATE INDEX idx_products_combined_trgm    ON products USING gin ((name || ' ' || brand) gin_trgm_ops);
CREATE INDEX idx_products_category_rank    ON products (category, oliveyoung_rank);

-- ingredients: pg_trgm GIN 매칭
CREATE INDEX idx_ingredients_name_trgm     ON ingredients USING gin (name gin_trgm_ops);
CREATE INDEX idx_ingredients_name_en_trgm  ON ingredients USING gin (name_en gin_trgm_ops);

-- ingredient_aliases: 별칭 매칭
CREATE INDEX idx_aliases_trgm              ON ingredient_aliases USING gin (alias gin_trgm_ops);

-- product_ingredients: FK 조회
CREATE INDEX idx_pi_product_id             ON product_ingredients (product_id);
CREATE INDEX idx_pi_ingredient_id          ON product_ingredients (ingredient_id);

-- ingredient_group_members: 성분별 그룹 조회
CREATE INDEX idx_igm_ingredient_id         ON ingredient_group_members (ingredient_id);
CREATE INDEX idx_igm_group_id              ON ingredient_group_members (group_id);

-- conflict_rules: 양방향 텀 조회
CREATE INDEX idx_cr_ingredient_a           ON conflict_rules (ingredient_a);
CREATE INDEX idx_cr_ingredient_b           ON conflict_rules (ingredient_b);
CREATE INDEX idx_cr_ba                     ON conflict_rules (ingredient_b, ingredient_a);

-- unmatched_log: 운영 대시보드용
CREATE INDEX idx_unmatched_unresolved      ON unmatched_log (resolved, occurrence_count DESC) WHERE resolved = FALSE;
CREATE INDEX idx_unmatched_product_id      ON unmatched_log (product_id) WHERE product_id IS NOT NULL;
```

---

## RLS 정책 (MVP: 전체 공개 읽기)

```sql
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_groups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_ingredients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_rules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_aliases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE unmatched_log          ENABLE ROW LEVEL SECURITY;

-- 참조 데이터 7개: 전체 공개 읽기
CREATE POLICY "anon_read_products"               ON products               FOR SELECT USING (true);
CREATE POLICY "anon_read_ingredients"            ON ingredients            FOR SELECT USING (true);
CREATE POLICY "anon_read_ingredient_groups"      ON ingredient_groups      FOR SELECT USING (true);
CREATE POLICY "anon_read_ingredient_group_members" ON ingredient_group_members FOR SELECT USING (true);
CREATE POLICY "anon_read_product_ingredients"    ON product_ingredients    FOR SELECT USING (true);
CREATE POLICY "anon_read_conflict_rules"         ON conflict_rules         FOR SELECT USING (true);
CREATE POLICY "anon_read_ingredient_aliases"     ON ingredient_aliases     FOR SELECT USING (true);

-- unmatched_log: 정책 없음 → anon 접근 불가
-- INSERT/SELECT는 API Route의 service_role 클라이언트를 통해 처리 (RLS 우회)
```

---

## 엣지 케이스

| 케이스                                                 | 처리 방법                                              |
| ------------------------------------------------------ | ------------------------------------------------------ |
| 같은 그룹 성분이 양쪽 슬롯에 모두 존재 (self-conflict) | 분석 API에서 `terms_a ∩ terms_b` 동일 텀 쌍 제외       |
| conflict_rules canonical 순서 불일치                   | 시드 스크립트에서 삽입 전 `[a,b].sort()` 처리          |
| `product_id IS NULL`인 unmatched_log 중복              | `UNIQUE NULLS NOT DISTINCT` 제약으로 처리              |
| 성분 별칭이 표준명과 동일                              | 매칭 로직에서 `ingredients.name` exact match 우선 처리 |
| 농도 포함 원문: "나이아신아마이드 5%"                  | API 전처리 정규식으로 농도 제거 후 매칭                |
| 괄호 표기: "살리실산(BHA)"                             | 괄호 내 설명어 제거 전처리 후 "살리실산"으로 매칭      |

---

## 시드 후 데이터 정합성 검증 쿼리

conflict_rules 시드 완료 후 아래 쿼리로 정합성을 검증합니다. 결과가 0행이어야 정상입니다.

```sql
-- ingredient 타입으로 표시된 항목이 실제 ingredients 테이블에 존재하는지 확인
SELECT 'a_type:ingredient 불일치' AS error, ingredient_a AS name
FROM conflict_rules
WHERE a_type = 'ingredient'
  AND NOT EXISTS (SELECT 1 FROM ingredients WHERE name = ingredient_a)
UNION ALL
SELECT 'b_type:ingredient 불일치', ingredient_b
FROM conflict_rules
WHERE b_type = 'ingredient'
  AND NOT EXISTS (SELECT 1 FROM ingredients WHERE name = ingredient_b)
UNION ALL
-- group 타입으로 표시된 항목이 실제 ingredient_groups 테이블에 존재하는지 확인
SELECT 'a_type:group 불일치', ingredient_a
FROM conflict_rules
WHERE a_type = 'group'
  AND NOT EXISTS (SELECT 1 FROM ingredient_groups WHERE group_name = ingredient_a)
UNION ALL
SELECT 'b_type:group 불일치', ingredient_b
FROM conflict_rules
WHERE b_type = 'group'
  AND NOT EXISTS (SELECT 1 FROM ingredient_groups WHERE group_name = ingredient_b);
```

---

## CSV 파일 목록 (`data/csv/`)

| 파일                           | 용도             | 참조 필드                                                                                   |
| ------------------------------ | ---------------- | ------------------------------------------------------------------------------------------- |
| `ingredients.csv`              | 성분 마스터      | —                                                                                           |
| `ingredient_groups.csv`        | 그룹 정의        | —                                                                                           |
| `ingredient_group_members.csv` | 성분-그룹 매핑   | ingredient_name → ingredients.name                                                          |
| `ingredient_aliases.csv`       | 별칭 매핑        | ingredient_name → ingredients.name                                                          |
| `products.csv`                 | 제품 목록        | —                                                                                           |
| `product_ingredients.csv`      | 제품-성분 매핑   | product_name → products.name, ingredient_name → ingredients.name                            |
| `conflict_rules.csv`           | 충돌/시너지 규칙 | ingredient_a/b → ingredients.name 또는 ingredient_groups.group_name, a_type/b_type으로 구분 |

> CSV의 참조 필드는 자연 키(이름)를 사용합니다. 시드 스크립트가 UUID로 변환합니다.
