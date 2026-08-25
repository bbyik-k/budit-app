-- ---------------------------------------------------------------------------
-- 기존 확장 · 트리거 · 테이블 · 인덱스 · RLS 정책
--
-- 출처: docs/DB_SCHEMA.md — '## SQL 스키마' / '## 인덱스' / RLS 코드블록
-- 성격: 이미 실 DB에 적용되어 있는 기존 정의를 문서에서 전사한 기록용 파일이다.
--       이 리포에는 원래 .sql 마이그레이션 체계가 없어 스키마의 유일한 소스가
--       마크다운 문서였다. 이력을 코드로 남기기 위해 옮긴 것이며, 새로 실행할
--       목적의 파일이 아니다.
--
-- 주의: 문서 기준이므로 **실 DB에 배포된 정의와의 일치는 미검증**이다.
--       (docs/RESUME_FACTCHECK.md:40,155의 동일한 경고를 승계한다)
-- ---------------------------------------------------------------------------

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

-- ── 인덱스 ─────────────────────────────────────────────────────────

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

-- ── RLS 정책 ───────────────────────────────────────────────────────

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
