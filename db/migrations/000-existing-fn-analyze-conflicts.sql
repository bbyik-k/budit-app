-- ---------------------------------------------------------------------------
-- 기존 RPC: analyze_conflicts
--
-- 출처: docs/troubleshooting/2026-04-21-conflict-analysis-fix.md
-- 성격: 이미 실 DB에 적용되어 있는 기존 정의를 문서에서 전사한 기록용 파일이다.
--       이 리포에는 원래 .sql 마이그레이션 체계가 없어 스키마의 유일한 소스가
--       마크다운 문서였다. 이력을 코드로 남기기 위해 옮긴 것이며, 새로 실행할
--       목적의 파일이 아니다.
--
-- 주의: 문서 기준이므로 **실 DB에 배포된 정의와의 일치는 미검증**이다.
--       (docs/RESUME_FACTCHECK.md:40,155의 동일한 경고를 승계한다)
-- ---------------------------------------------------------------------------

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
