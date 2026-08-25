-- ---------------------------------------------------------------------------
-- products.subcategory 컬럼 추가
--
-- 적용 일자: 2026-08-18
-- 적용 방법: Supabase 대시보드 > SQL Editor 에서 수동 실행
--            (이 리포에는 supabase CLI 링크가 없어 CLI 마이그레이션을 쓸 수 없고,
--             service_role 키로도 PostgREST 를 통한 DDL 실행은 불가능하다)
--
-- 배경: data/products_seed_cleaned.csv(358행)의 subcategory 컬럼을 적재하기 위해
--       필요하다. 기존 products 테이블에는 category(4종 CHECK)만 있었고
--       소분류를 담을 자리가 없었다. CSV 의 subcategory 고유값은 13종이다.
--
-- 적용 후 함께 갱신할 것:
--   - lib/database.types.ts  products Row/Insert/Update 에 subcategory 추가
--   - docs/DB_SCHEMA.md      products DDL 에 반영
-- ---------------------------------------------------------------------------

ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT;
