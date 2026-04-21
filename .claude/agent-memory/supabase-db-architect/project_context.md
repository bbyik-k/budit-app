---
name: 부딪 프로젝트 컨텍스트
description: 부딪 서비스의 핵심 DB 설계 결정사항, 비즈니스 로직, 테이블 구조 요약
type: project
---

## 서비스 개요

민감성 피부 사용자를 위한 화장품 성분 충돌 분석 서비스. 두 제품의 성분이 충돌하는지 그룹 단위로 분석.

## 핵심 테이블 구조 (8개)

- products: 올리브영 상위 120개 제품 (MVP)
- ingredients: KCIA 기준 21,805개 성분 (UUID PK, name UNIQUE)
- ingredient_groups: "레티놀 계열", "AHA 계열" 등 10-15개 그룹 (The Ordinary 충돌 차트 기반)
- ingredient_group_members: 성분-그룹 M:N 매핑 (UNIQUE(group_id, ingredient_id))
- product_ingredients: 제품-성분 M:N 매핑 (display_order 포함)
- conflict_rules: 충돌/시너지 규칙 (ingredient_a, ingredient_b 텍스트 기반)
- ingredient_aliases: 비표준 표기 별칭
- unmatched_log: 성분명 매칭 실패 로그

## 충돌 분석 알고리즘 핵심

텀 집합 = { 성분명 } ∪ { 소속 그룹명 } 으로 평탄화 후,
conflict_rules에서 양방향 조회:
WHERE (ingredient_a = ANY(terms_a) AND ingredient_b = ANY(terms_b))
   OR (ingredient_a = ANY(terms_b) AND ingredient_b = ANY(terms_a))

## conflict_rules 설계 결정 (2026-04-16, 규칙 확장 2026-04-21)

ingredient_a, ingredient_b 컬럼이 성분명과 그룹명을 모두 TEXT로 받는 혼재 구조.
a_type, b_type 컬럼("group" 또는 "ingredient")으로 구분.

**Why:** conflict_rules 데이터 규모가 50-500행으로 소규모이고, 분석 쿼리는 이미
텀 집합을 평탄화된 TEXT 배열로 만들어 ANY()로 조회하므로, 구조 복잡도가
쿼리 성능에 미치는 영향이 최소화됨.

## conflict_rules 현황 (2026-04-21 기준)

총 52개 규칙, 전부 group+group 레벨:
- avoid (high): 9개 — 레티놀/AHA/BHA/비타민C/구리펩타이드/EGF 조합
- caution (medium): 13개 — 나이아신아마이드/비타민C/AHA/BHA/아연/향료 조합
- caution (low): 1개 — 방부제+향료
- synergy: 29개 — 26개 그룹 전체 커버

ingredient 레벨 규칙(세라마이드+히알루론산 등 기존 3개)은 group 레벨로 대체·제거됨.

synergy 행 CSV 포맷: 10개 필드 (severity 빈값, reason_ko 빈값, recommend에 설명, 빈값, source).
시드 로직은 헤더 9개 기준으로 파싱하므로 10번째 필드는 무시됨 — 의도된 설계.

## 현재 개발 단계

- Phase 0 완료 (스타터킷 정리, 브랜드 컬러 설정)
- Phase 1 진행 중 (목업 UI — Task 003, 004 완료)
- Phase 2 대기 (DB 스키마 + 시드 인프라)
- 아직 supabase/migrations/ 파일 없음

## FK 의존성 순서 (시드 데이터 삽입 순서)

ingredients → ingredient_groups → group_members → aliases → products → product_ingredients → conflict_rules

## 기술 결정

- 한글 검색: pg_trgm GIN 인덱스 (products.name, products.brand, ingredients.name)
- 성분 매칭: 정확 매칭 → alias 매칭 → pg_trgm 유사도 90%↑ 순서
- 상태 관리: useReducer (외부 라이브러리 미사용)
- 인증: MVP에서 불필요 (코드 유지, 라우트 보호 해제)
