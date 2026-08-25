-- ---------------------------------------------------------------------------
-- 기존 RPC: log_unmatched
--
-- 출처: docs/RESUME_FACTCHECK.md
-- 성격: 이미 실 DB에 적용되어 있는 기존 정의를 문서에서 전사한 기록용 파일이다.
--       이 리포에는 원래 .sql 마이그레이션 체계가 없어 스키마의 유일한 소스가
--       마크다운 문서였다. 이력을 코드로 남기기 위해 옮긴 것이며, 새로 실행할
--       목적의 파일이 아니다.
--
-- 주의: 문서 기준이므로 **실 DB에 배포된 정의와의 일치는 미검증**이다.
--       (docs/RESUME_FACTCHECK.md:40,155의 동일한 경고를 승계한다)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION log_unmatched(p_raw_name TEXT, p_product_id UUID)
RETURNS VOID AS $$
  INSERT INTO unmatched_log (raw_name, product_id, occurrence_count)
  VALUES (p_raw_name, p_product_id, 1)
  ON CONFLICT (raw_name, product_id)
  DO UPDATE SET occurrence_count = unmatched_log.occurrence_count + 1;
$$ LANGUAGE sql;
