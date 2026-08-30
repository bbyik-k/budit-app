import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api/errors";
import { featuredProductRowsSchema } from "@/lib/api/validation";
import type { ProductSearchResponse } from "@/types/api";

/**
 * 검색어 입력 전 드롭다운에 노출할 기본 제품 목록
 *
 * oliveyoung_rank 가 서브카테고리 내 순위라 단순 ORDER BY 로는 동점자 중
 * 임의 선택이 된다. 선정 로직은 get_featured_products RPC 안에 있다.
 * (db/migrations/2026-08-25-add-fn-featured-products.sql 참조)
 */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_featured_products");

  // lib/analyze/conflict.ts 는 같은 상황에서 throw 하지만 여기서는 500 을 반환한다.
  // 그쪽은 빈 결과가 "안전한 조합입니다"로 렌더되는 false negative 라 throw 가
  // 필요했고, 여기는 빈 결과가 기본 목록 없음일 뿐 안전성 함의가 없다.
  if (error) {
    console.error("[products/featured] RPC error:", error.message);
    return jsonError(500, "DB_ERROR", "제품 목록을 불러오지 못했습니다");
  }

  const parsed = featuredProductRowsSchema.safeParse(data ?? []);
  if (!parsed.success) {
    console.error(
      "[products/featured] RPC 응답 스키마 불일치:",
      parsed.error.issues
    );
    return jsonError(500, "DB_ERROR", "제품 목록을 불러오지 못했습니다");
  }

  return Response.json({ items: parsed.data } satisfies ProductSearchResponse);
}
