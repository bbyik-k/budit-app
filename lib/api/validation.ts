import { z } from "zod";

// 제품 검색 쿼리 파라미터 유효성 검사 스키마
export const searchQuerySchema = z.object({
  q: z
    .string()
    .min(1, "검색어를 입력해주세요")
    .max(100, "검색어는 100자 이하로 입력해주세요")
    .refine(
      (s) => !/[\u0000-\u001F]/.test(s),
      "유효하지 않은 문자가 포함되어 있습니다"
    ),
});

// 성분 매칭 요청 본문 유효성 검사 스키마
export const matchBodySchema = z.object({
  ingredients: z
    .array(z.string().min(1).max(100))
    .min(1, "성분 목록이 비어있습니다")
    .max(200, "성분은 최대 200개까지 입력 가능합니다"),
  product_id: z.string().uuid().optional(),
});

// 충돌 분석 슬롯 유효성 검사 스키마 (product/manual 타입 분기)
const slotSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("product"),
    productId: z.string().uuid(),
    productName: z.string().optional(),
    brand: z.string().optional(),
    ingredients: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("manual"),
    productName: z.string().optional(),
    brand: z.string().optional(),
    ingredients: z
      .array(z.string().min(1))
      .min(1, "직접 입력 성분이 비어있습니다"),
  }),
]);

// 충돌 분석 요청 본문 유효성 검사 스키마
export const analyzeBodySchema = z.object({
  slotA: slotSchema,
  slotB: slotSchema,
});

// ---------------------------------------------------------------------------
// RPC 응답 검증 스키마
//
// 주의: lib/database.types.ts의 자동생성 타입은 analyze_conflicts 반환 9컬럼을
// 전부 non-nullable string으로 선언하지만, 실제 DDL은 severity/recommend/source가
// NULL 허용이다. synergy 행은 severity가 실제로 null로 내려오므로 nullable 필수.
// reason_ko는 NOT NULL이지만 synergy 행에서 빈 문자열이므로 .min(1) 금지.
// .strict()도 금지 — RPC 본문이 SELECT DISTINCT cr.*라 추가 키가 올 수 있으며,
// 기본 z.object의 stripping에 의존한다.
// ---------------------------------------------------------------------------

// analyze_conflicts RPC 반환 행 스키마
export const analyzeConflictsRowSchema = z.object({
  ingredient_a: z.string(),
  ingredient_b: z.string(),
  a_type: z.string(),
  b_type: z.string(),
  conflict_type: z.enum(["avoid", "caution", "synergy"]),
  severity: z.enum(["high", "medium", "low"]).nullable(),
  reason_ko: z.string(),
  recommend: z.string().nullable(),
  source: z.string().nullable(),
});

export const analyzeConflictsRowsSchema = z.array(analyzeConflictsRowSchema);

// match_ingredient_fuzzy RPC 반환 행 스키마
export const fuzzyMatchRowSchema = z.object({
  ingredient_id: z.uuid(),
  name: z.string(),
  similarity: z.number(),
});

export const fuzzyMatchRowsSchema = z.array(fuzzyMatchRowSchema);
