import { type NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { analyzeBodySchema } from "@/lib/api/validation";
import { matchIngredients } from "@/lib/analyze/match";
import { analyzeConflicts } from "@/lib/analyze/conflict";
import { createClient } from "@/lib/supabase/server";
import type { AnalyzeResponse } from "@/types/api";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(
      400,
      "INVALID_BODY",
      "요청 본문이 올바른 JSON 형식이 아닙니다"
    );
  }

  const parsed = analyzeBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      "INVALID_BODY",
      parsed.error.issues[0]?.message ?? "잘못된 요청입니다"
    );
  }

  const { slotA, slotB } = parsed.data;

  try {
    // 각 슬롯에서 성분명 목록 확보 (병렬 조회)
    const [namesA, namesB] = await Promise.all([
      resolveSlotNames(slotA),
      resolveSlotNames(slotB),
    ]);

    if (namesA === null)
      return jsonError(
        404,
        "PRODUCT_NOT_FOUND",
        "슬롯 A의 제품을 찾을 수 없습니다"
      );
    if (namesB === null)
      return jsonError(
        404,
        "PRODUCT_NOT_FOUND",
        "슬롯 B의 제품을 찾을 수 없습니다"
      );
    if (namesA.length === 0)
      return jsonError(422, "EMPTY_SLOT", "슬롯 A의 성분을 확인할 수 없습니다");
    if (namesB.length === 0)
      return jsonError(422, "EMPTY_SLOT", "슬롯 B의 성분을 확인할 수 없습니다");

    const result = await analyzeConflicts(namesA, namesB);

    return Response.json(result satisfies AnalyzeResponse);
  } catch (err) {
    console.error("[analyze] error:", err);
    return jsonError(500, "DB_ERROR", "분석 중 오류가 발생했습니다");
  }
}

/**
 * 슬롯 타입에 따라 성분명(ingredient.name) 목록 반환
 * - product: product_ingredients 테이블 조회 → ingredients.name
 * - manual: matchIngredients 호출 → matched 성분명만
 * - 제품 없으면 null, 매칭 결과 없으면 빈 배열
 */
async function resolveSlotNames(slot: {
  type: "product" | "manual";
  productId?: string;
  ingredients?: string[];
}): Promise<string[] | null> {
  if (slot.type === "product") {
    const supabase = await createClient();
    const { data } = await supabase
      .from("product_ingredients")
      .select("ingredient_id, ingredients(name)")
      .eq("product_id", slot.productId!);

    // 제품 자체가 없거나 성분 데이터 없음 → null 반환
    if (!data || data.length === 0) return null;

    return data.flatMap((row) => {
      const ing = row.ingredients as
        | { name: string }
        | { name: string }[]
        | null;
      const name = Array.isArray(ing) ? ing[0]?.name : ing?.name;
      return name ? [name] : [];
    });
  } else {
    // manual 슬롯: matchIngredients 호출 후 매칭된 성분명만 반환
    const { matched } = await matchIngredients(slot.ingredients ?? []);
    return matched.map((m) => m.ingredient_name);
  }
}
