# 부딪 (Budit) 개발 로드맵

민감성 피부 사용자를 위한 화장품 성분 충돌 분석 서비스

## 개요

부딪(Budit)은 민감성 피부를 가진 사람들이 화장품 성분 충돌을 쉽게 확인할 수 있도록 돕는 서비스로 다음 기능을 제공합니다:

- **제품 검색 및 선택**: pg_trgm 기반 한글 부분 문자열 검색으로 올리브영 상위 120개 제품 탐색
- **성분 충돌 분석**: 두 제품의 성분을 그룹 단위로 매핑하여 The Ordinary 충돌 차트 기반 충돌/시너지 판별
- **성분 직접 입력**: DB에 없는 제품도 성분 텍스트를 직접 붙여넣어 분석 가능
- **분석 결과 시각화**: severity별 색상 코딩된 충돌 카드와 루틴 분리 권장사항 제공

## 기술 스택

- **프론트엔드**: Next.js 15 (App Router) + TypeScript + React 19
- **스타일링**: Tailwind CSS + shadcn/ui (new-york) + Lucide React + next-themes
- **백엔드/DB**: Supabase (PostgreSQL + pg_trgm)
- **상태 관리**: useReducer (외부 라이브러리 미사용)
- **패키지 관리**: pnpm
- **배포**: Vercel

## 개발 워크플로우

1. **작업 계획**
   - 기존 코드베이스를 학습하고 현재 상태를 파악
   - 새로운 작업을 포함하도록 `ROADMAP.md` 업데이트
   - 우선순위 작업은 마지막 완료된 작업 다음에 삽입

2. **작업 생성**
   - 기존 코드베이스를 학습하고 현재 상태를 파악
   - 고수준 명세서, 관련 파일, 수락 기준, 구현 단계 포함
   - API/비즈니스 로직 작업 시 "테스트 체크리스트" 섹션 필수 포함 (Playwright MCP 테스트 시나리오 작성)

3. **작업 구현**
   - 작업 파일의 명세서를 따름
   - 기능과 기능성 구현
   - API 연동 및 비즈니스 로직 구현 시 Playwright MCP로 테스트 수행 필수
   - 각 단계 후 작업 파일 내 단계 진행 상황 업데이트
   - 구현 완료 후 Playwright MCP를 사용한 E2E 테스트 실행
   - 테스트 통과 확인 후 다음 단계로 진행
   - 각 단계 완료 후 중단하고 추가 지시를 기다림

4. **로드맵 업데이트**
   - 로드맵에서 완료된 작업을 완료로 표시

---

## 개발 단계

### Phase 0: 프로젝트 초기 설정 ✅

- **Task 001: 스타터킷 보일러플레이트 정리** ✅ - 완료
  - ✅ Next.js + Supabase 스타터킷에서 불필요한 보일러플레이트 제거
  - ✅ 기본 페이지 콘텐츠 초기화
  - ✅ 인증 라우트 보호 해제 (MVP에서 인증 불필요, 코드는 유지)

- **Task 002: 한국어 기본 설정 및 브랜드 컬러 시스템** ✅ - 완료
  - ✅ HTML lang 속성 한국어(ko) 설정
  - ✅ 브랜드 컬러 시스템 CSS 변수 정의 (globals.css)
  - ✅ Tailwind CSS 테마 확장 (브랜드 색상 연동)
  - ✅ 다크모드 대응 컬러 팔레트 설정

---

### Phase 1: 목업 UI (인터랙티브 프로토타입)

> **목적**: API/DB 연결 없이 하드코딩된 더미 데이터로 실제처럼 동작하는 인터랙티브 목업 페이지 구현. 디자이너에게 전달할 와이어프레임 대용으로 페이지 구조, 버튼 위치, 상태 전환을 시각적으로 보여주기.

- **Task 003: 랜딩 페이지 목업** - 우선순위
  - app/page.tsx 랜딩 페이지 Server Component 구현
  - components/landing/hero-section.tsx 히어로 섹션 (서비스 슬로건 + 설명 + CTA 버튼)
  - components/landing/how-it-works.tsx 3단계 사용법 안내 섹션
  - "지금 분석하기" CTA 버튼 -> /analyze 이동
  - 실제 카피 및 브랜드 컬러 적용

- **Task 004: 분석 페이지 목업 -- 검색 및 슬롯 선택 상태**
  - components/layout/header.tsx 구현 (로고 + 다크모드 토글)
  - components/analyze/analyze-container.tsx 클라이언트 컨테이너 (useReducer 상태 관리)
  - components/analyze/step-indicator.tsx 슬롯 A/B 단계 표시
  - components/analyze/product-search.tsx shadcn/ui Command 기반 검색 UI
  - 하드코딩된 더미 제품 목록으로 검색 드롭다운 동작 구현
    - 예시 제품: "토리든 다이브인 세럼", "이니스프리 레티놀 앰플", "라운드랩 자작나무 수분크림" 등
  - select-a 상태: 슬롯 A 검색창 활성화
  - select-b 상태: 슬롯 A 선택 완료 표시 + 슬롯 B 검색창 활성화
  - ready 상태: 양쪽 슬롯 선택 완료 + "성분 충돌 분석" 버튼 활성화
  - 상태 전환 인터랙션 완전히 동작

- **Task 005: 분석 페이지 목업 -- 결과 화면**
  - components/analyze/result-panel.tsx 분석 결과 패널
  - components/analyze/conflict-card.tsx 충돌 카드 (severity별 색상)
  - 하드코딩된 더미 충돌 데이터로 result 상태 구현
    - 충돌 예시: 레티놀 x 비타민C (conflict_type: avoid, severity: high), 레티놀 x AHA (conflict_type: avoid, severity: high)
    - 시너지 예시: 히알루론산 + 세라마이드 (synergy)
    - 루틴 분리 권장사항 텍스트
  - result-conflict 상태: 충돌 카드 목록 + 루틴 분리 권장사항 표시
  - result-safe 상태: 초록 안전 배지 + 시너지 성분 하이라이트 (더미 안전 제품 조합 시)
  - "돌아가기" 버튼 -> select-a 초기화
  - "성분 충돌 분석" 버튼 클릭 시 로딩 애니메이션 후 결과 전환 (setTimeout 1.5초)

- **Task 006: 성분 직접 입력 다이얼로그 목업**
  - components/analyze/manual-input-dialog.tsx 구현
  - shadcn/ui Dialog 기반 모달 UI
  - 쉼표 구분 성분 텍스트 입력 textarea
  - "확인" 클릭 시 더미 매칭 결과 미리보기 (성공/실패 성분 구분 표시)
  - 슬롯에 manual 타입으로 적용하면 ready 상태로 전환

---

### Phase 2: DB 스키마 + 시드 인프라

- **Task 007: Supabase 데이터베이스 스키마 생성** - 우선순위
  - pg_trgm 확장 활성화
  - 8개 테이블 생성 (products, ingredients, ingredient_groups, ingredient_group_members, product_ingredients, conflict_rules, ingredient_aliases, unmatched_log)
  - 외래 키 제약 조건 및 UNIQUE 인덱스 설정
  - GIN 트라이그램 인덱스 적용 (products.name, products.brand, ingredients.name)
  - Supabase MCP를 활용한 마이그레이션 실행

- **Task 008: TypeScript 타입 정의 및 인터페이스 설계**
  - Supabase 테이블 기반 TypeScript 타입 자동 생성 (supabase gen types)
  - API 요청/응답 타입 정의 (AnalyzeRequest, AnalyzeResponse 등)
  - 컴포넌트 Props 타입 정의 (SlotState, AnalyzeStep 등)
  - useReducer 상태 및 액션 타입 정의 (AnalyzeState, AnalyzeAction)

- **Task 009: CSV 시드 데이터 준비**
  - data/csv/ 디렉토리에 7종 CSV 파일 구성
  - ingredients.csv: KCIA 기준 성분 DB (21,805개 성분)
  - ingredient_groups.csv: The Ordinary 충돌 차트 기반 10-15개 핵심 그룹
  - ingredient_group_members.csv: 성분-그룹 매핑 데이터
  - ingredient_aliases.csv: 비표준 표기 별칭 데이터
  - products.csv: 올리브영 상위 120개 제품 (4개 카테고리 x 30개)
  - product_ingredients.csv: 제품별 전성분 매핑 데이터
  - conflict_rules.csv: 그룹 간 충돌/시너지 규칙 데이터

- **Task 010: 시드 스크립트 개발 및 실행**
  - scripts/seed/ 디렉토리에 TypeScript 시드 스크립트 작성
  - FK 의존성 고려한 실행 순서 보장 (ingredients -> ingredient_groups -> group_members -> aliases -> products -> product_ingredients -> conflict_rules)
  - CSV 파싱 및 Supabase 클라이언트를 통한 데이터 삽입
  - 중복 데이터 처리 (upsert) 및 에러 핸들링
  - 시드 실행 결과 검증 (테이블별 row count 확인)

---

### Phase 3: API 3개 구현

- **Task 011: 제품 검색 API 구현** - 우선순위
  - GET /api/products/search?q={query} 라우트 핸들러 구현
  - pg_trgm 기반 한글 부분 문자열 검색 쿼리 작성
  - 상위 10개 결과 반환 (name, brand, category, image_url 포함)
  - 빈 쿼리 및 특수문자 입력 방어 처리
  - Zod를 활용한 쿼리 파라미터 검증
  - Playwright MCP를 활용한 API 엔드포인트 테스트

- **Task 012: 성분 매칭 API 구현**
  - POST /api/ingredients/match 라우트 핸들러 구현
  - 성분 텍스트 전처리 로직 (괄호 내 농도 제거, 공백 정규화)
  - 매칭 우선순위 구현: ingredients.name 정확 매칭 -> ingredient_aliases 매칭 -> pg_trgm 유사도(90% 이상)
  - 매칭 실패 시 unmatched_log 테이블 기록
  - Zod를 활용한 요청 본문 검증
  - Playwright MCP를 활용한 매칭 정확도 테스트

- **Task 013: 핵심 충돌 분석 API 구현**
  - POST /api/analyze 라우트 핸들러 구현
  - 슬롯 타입별 성분 ID 확보 로직 (product 타입: product_ingredients 조회 / manual 타입: /api/ingredients/match 내부 호출)
  - 성분별 소속 그룹 확보 (ingredient_group_members 조회)
  - 슬롯별 텀 집합 생성 (개별 성분명 합집합 소속 그룹명)
  - conflict_rules 양방향 조회 (슬롯 A 텀 x 슬롯 B 텀)
  - 결과 분류: avoid/caution -> conflicts 배열, synergy -> synergies 배열
  - AnalyzeResponse 타입에 맞는 응답 구조 반환
  - Playwright MCP를 활용한 충돌 분석 로직 통합 테스트

- **Task 014: API 통합 테스트**
  - Playwright MCP를 사용한 전체 API 플로우 테스트
  - 제품 검색 -> 성분 매칭 -> 충돌 분석 연속 시나리오 검증
  - 에러 핸들링 및 엣지 케이스 테스트 (존재하지 않는 제품, 빈 성분 목록, 매칭 실패 다수 발생 등)
  - 응답 시간 및 성능 기본 검증

---

### Phase 4: UI 레이아웃 + 랜딩 + 분석 검색

- **Task 015: 공통 레이아웃 및 헤더 컴포넌트** - 우선순위
  - components/layout/header.tsx 구현 (로고 + 다크모드 토글)
  - app/layout.tsx 루트 레이아웃 업데이트
  - next-themes ThemeProvider 설정
  - 로고 클릭 시 홈(/) 이동
  - 반응형 헤더 기본 구조 (데스크탑 우선)

- **Task 016: 랜딩 페이지 구현**
  - app/page.tsx 랜딩 페이지 Server Component 구현
  - components/landing/hero-section.tsx 히어로 섹션 (서비스 슬로건 + 설명 + CTA 버튼)
  - components/landing/how-it-works.tsx 3단계 사용법 안내 섹션
  - "지금 분석하기" CTA 버튼 -> /analyze 라우트 이동
  - 더미 콘텐츠로 UI 완성 후 실제 카피 적용

- **Task 017: 분석 페이지 골격 및 상태 관리**
  - app/analyze/page.tsx 분석 페이지 라우트 생성 (Server Shell)
  - components/analyze/analyze-container.tsx 클라이언트 컨테이너 구현
  - useReducer 기반 상태 관리 구현 (select-a -> select-b -> ready -> analyzing -> result)
  - AnalyzeState 및 AnalyzeAction 타입 적용
  - 단계별 UI 분기 렌더링 로직

- **Task 018: 제품 검색 UI 및 슬롯 선택**
  - components/analyze/step-indicator.tsx 슬롯 A/B 단계 표시 컴포넌트
  - components/analyze/product-search.tsx shadcn/ui Command(cmdk) 기반 검색 UI
  - 검색 API 연동 (GET /api/products/search) 및 디바운스 처리
  - 슬롯 A 선택 완료 시 자동 슬롯 B 모드 전환
  - 선택된 제품 정보 표시 및 변경/초기화 기능
  - Playwright MCP를 활용한 검색 -> 선택 플로우 E2E 테스트

---

### Phase 5: UI 분석 결과 + 성분 직접 입력

- **Task 019: 분석 결과 패널 구현** - 우선순위
  - components/analyze/result-panel.tsx 분석 결과 패널 컴포넌트
  - components/analyze/conflict-card.tsx 충돌 카드 컴포넌트 (severity별 색상: high=빨강, medium=주황, caution=노랑)
  - 충돌 있음 상태: 충돌 성분 카드 목록 + 루틴 분리 권장사항 표시
  - 충돌 없음 상태: 초록 안전 배지 + 시너지 성분 하이라이트
  - "돌아가기" 버튼 -> 초기 상태(select-a) 리셋
  - POST /api/analyze 연동 및 로딩/에러 상태 처리

- **Task 020: 성분 직접 입력 다이얼로그**
  - components/analyze/manual-input-dialog.tsx 구현
  - shadcn/ui Dialog 기반 모달 UI
  - 쉼표 구분 성분 텍스트 입력 영역 (textarea)
  - POST /api/ingredients/match 연동으로 입력 성분 파싱 및 DB 매칭
  - 매칭 결과 미리보기 (매칭 성공/실패 성분 구분 표시)
  - 확인 시 슬롯에 manual 타입으로 성분 데이터 적용
  - Playwright MCP를 활용한 직접 입력 -> 분석 플로우 E2E 테스트

- **Task 021: 사용자 플로우 통합 테스트**
  - Playwright MCP를 사용한 전체 사용자 여정 E2E 테스트
  - 시나리오 1: 제품 검색 -> 슬롯 A/B 선택 -> 충돌 분석 -> 결과 확인 -> 돌아가기
  - 시나리오 2: 직접 입력 -> 분석 -> 결과 확인
  - 시나리오 3: 제품 + 직접 입력 혼합 분석
  - 에러 상태 및 엣지 케이스 UI 검증

---

### Phase 6: 반응형 + 다크모드 + E2E 테스트 + 배포

- **Task 022: 반응형 디자인 완성** - 우선순위
  - 데스크탑 우선(Desktop First) 전략 기반 반응형 대응
  - 브레이크포인트별 레이아웃 조정 (1280px -> 768px -> 375px)
  - 랜딩 페이지 반응형 최적화
  - 분석 페이지 반응형 최적화 (검색 UI, 결과 패널 등)
  - 헤더 및 공통 컴포넌트 반응형 대응

- **Task 023: 다크모드 완성**
  - next-themes 기반 다크모드 전체 적용
  - 모든 컴포넌트 다크모드 스타일 검증 및 보정
  - 충돌 카드 severity 색상 다크모드 대응
  - 브랜드 컬러 다크모드 팔레트 최종 확인
  - 시스템 설정 연동 및 수동 전환 기능 확인

- **Task 024: E2E 테스트 스위트 작성**
  - Playwright 테스트 환경 설정 (playwright.config.ts)
  - 랜딩 페이지 테스트 (CTA 동작, 네비게이션)
  - 분석 페이지 전체 플로우 테스트 (검색 -> 선택 -> 분석 -> 결과)
  - 성분 직접 입력 플로우 테스트
  - 반응형 레이아웃 테스트 (데스크탑/태블릿/모바일 뷰포트)
  - 다크모드 전환 테스트
  - 에러 핸들링 및 엣지 케이스 테스트

- **Task 025: Vercel 배포 및 프로덕션 설정**
  - Vercel 프로젝트 연결 및 환경 변수 설정
  - Supabase 프로덕션 환경 구성
  - 프로덕션 빌드 검증 (pnpm build 성공 확인)
  - OG 이미지 및 메타데이터 최종 설정
  - 배포 후 프로덕션 환경 스모크 테스트

---

## 진행 상황 요약

| Phase    | 상태 | Task 수 | 완료  |
| -------- | ---- | ------- | ----- |
| Phase 0  | ✅   | 2       | 2     |
| Phase 1  | 대기 | 4       | 0     |
| Phase 2  | 대기 | 4       | 0     |
| Phase 3  | 대기 | 4       | 0     |
| Phase 4  | 대기 | 4       | 0     |
| Phase 5  | 대기 | 3       | 0     |
| Phase 6  | 대기 | 4       | 0     |
| **합계** |      | **25**  | **2** |
