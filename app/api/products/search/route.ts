import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api/errors";
import { searchQuerySchema } from "@/lib/api/validation";
import type { ProductSearchResponse } from "@/types/api";

export async function GET(req: NextRequest) {
  // 쿼리 파라미터 유효성 검사
  const parsed = searchQuerySchema.safeParse({
    q: req.nextUrl.searchParams.get("q"),
  });

  if (!parsed.success) {
    return jsonError(
      400,
      "INVALID_QUERY",
      parsed.error.issues[0]?.message ?? "잘못된 요청입니다"
    );
  }

  // .or() 파싱 깨짐 방지: %, _, ,, (, ) 를 공백으로 치환
  const safe = parsed.data.q.replace(/[%_,()]/g, " ").trim();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, category, image_url")
    .or(`name.ilike.%${safe}%,brand.ilike.%${safe}%`)
    .order("oliveyoung_rank", { ascending: true, nullsFirst: false })
    .limit(10);

  if (error) {
    console.error("[products/search] DB error:", error.message);
    return jsonError(500, "DB_ERROR", "검색 중 오류가 발생했습니다");
  }

  return Response.json({ items: data } satisfies ProductSearchResponse);
}
