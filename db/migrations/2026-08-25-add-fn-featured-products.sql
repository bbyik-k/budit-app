-- ---------------------------------------------------------------------------
-- 신규 RPC: get_featured_products
--
-- 성격: 000-existing-*.sql 은 이미 배포된 정의를 문서에서 전사한 기록용이지만,
--       이 파일은 **실제로 실행해야 하는** 마이그레이션이다.
--       Supabase SQL 에디터에서 직접 실행한다.
--
-- 목적: 제품 선택 드롭다운에서 검색어 입력 전에 노출할 기본 목록을 조회한다.
--
-- 배경: oliveyoung_rank 는 전역 인기 순위가 아니라 **서브카테고리 내 순위**다.
--       362건 기준 rank=1 인 제품이 18건, rank=2 가 19건이라
--       단순히 ORDER BY oliveyoung_rank LIMIT N 으로 뽑으면 동점자 중
--       임의 선택이 되어 결과가 매번 달라진다.
--       그래서 서브카테고리별 최소 rank 를 구해 그 rank 를 가진 행을 반환한다.
--
-- MIN() 조인을 쓰는 이유: DISTINCT ON (subcategory) 는 서브카테고리당 1건만
--       남긴다. cleansing 은 세분류가 없어 rank=1 이 6건인데 이들은 실제로는
--       리무버·클렌징워터·티슈·필링젤·오일·폼 각각의 1위다. 5건을 버리지 않는다.
--
-- SECURITY DEFINER 를 쓰지 않는다. 호출자 권한으로 실행돼 products 의
--       공개 읽기 RLS 정책을 그대로 탄다.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_featured_products()
RETURNS TABLE (
  id        UUID,
  name      TEXT,
  brand     TEXT,
  category  TEXT,
  image_url TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT p.id, p.name, p.brand, p.category, p.image_url
  FROM products p
  JOIN (
    SELECT subcategory, MIN(oliveyoung_rank) AS min_rank
    FROM products
    WHERE subcategory IS NOT NULL
      AND oliveyoung_rank IS NOT NULL
    GROUP BY subcategory
  ) m
    ON p.subcategory = m.subcategory
   AND p.oliveyoung_rank = m.min_rank
  ORDER BY p.category, p.subcategory, p.oliveyoung_id;
$$;

GRANT EXECUTE ON FUNCTION get_featured_products() TO anon, authenticated;
