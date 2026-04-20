import { type NextRequest } from "next/server";
import { jsonError } from "@/lib/api/errors";
import { matchBodySchema } from "@/lib/api/validation";
import { matchIngredients } from "@/lib/analyze/match";
import type { MatchResponse } from "@/types/api";

/**
 * POST /api/ingredients/match
 * 성분명 배열을 받아 DB에서 매칭 후 결과를 반환한다.
 * 매칭 실패한 성분은 unmatched_log에 자동 기록된다.
 */
export async function POST(req: NextRequest) {
  // JSON 파싱
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

  // 유효성 검사 (Zod 4.x: .error.issues)
  const parsed = matchBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      "INVALID_BODY",
      parsed.error.issues[0]?.message ?? "잘못된 요청입니다"
    );
  }

  // 매칭 엔진 실행
  try {
    const result = await matchIngredients(
      parsed.data.ingredients,
      parsed.data.product_id
    );
    return Response.json(result satisfies MatchResponse);
  } catch (err) {
    console.error("[ingredients/match] error:", err);
    return jsonError(500, "DB_ERROR", "성분 매칭 중 오류가 발생했습니다");
  }
}
