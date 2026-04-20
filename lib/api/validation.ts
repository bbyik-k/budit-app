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
