import { normalizeName } from "@/lib/ingredients/normalize";
import { fuzzyMatchRowsSchema } from "@/lib/api/validation";
import type { MatchedItem } from "@/types/api";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 이 모듈이 필요로 하는 Supabase 클라이언트 타입 */
type MatchSupabaseClient = SupabaseClient<Database>;

/**
 * 4단계 성분 매칭 엔진
 * 1단계: ingredients.name 정확 일치
 * 2단계: ingredient_aliases.alias 정확 일치
 * 3단계: match_ingredient_fuzzy RPC (유사도 0.9 이상)
 * 4단계: 매칭 실패 → unmatched_log에 기록 (service_role 클라이언트 사용)
 *
 * @param options.logUnmatched 미매칭 로그 기록 여부. 기본값 true.
 *   미리보기(읽기 전용) 호출에서는 false로 넘겨 이중 로깅을 막는다.
 * @param options.client 읽기용 클라이언트. 미지정 시 lib/supabase/server의
 *   createClient()를 쓴다. CLI 스크립트는 next/headers에 의존할 수 없으므로
 *   service_role 클라이언트를 직접 주입한다.
 * @param options.adminClient 미매칭 로깅용 클라이언트. 미지정 시 adminSupabase.
 *
 * 두 클라이언트 모듈은 주입이 없을 때만 동적으로 로드한다. lib/supabase/server는
 * next/headers를, lib/supabase/admin은 server-only를 최상위에서 import하는데
 * 둘 다 Next 런타임 밖에서는 해석되지 않기 때문이다.
 */
export async function matchIngredients(
  rawNames: string[],
  productId?: string,
  options?: {
    logUnmatched?: boolean;
    client?: MatchSupabaseClient;
    adminClient?: MatchSupabaseClient;
  }
): Promise<{ matched: MatchedItem[]; unmatched: string[] }> {
  const logUnmatched = options?.logUnmatched ?? true;
  const supabase: MatchSupabaseClient =
    options?.client ??
    ((await import("@/lib/supabase/server").then((m) =>
      m.createClient()
    )) as MatchSupabaseClient);
  const matched: MatchedItem[] = [];
  const unmatchedRaws: string[] = [];

  // 원문 보존: normalized → raw 매핑
  const normalizedMap = new Map<string, string>();
  for (const raw of rawNames) {
    const norm = normalizeName(raw);
    if (norm) normalizedMap.set(norm, raw);
  }
  const normalizedNames = [...normalizedMap.keys()];

  // 입력이 모두 빈 문자열인 경우 조기 반환
  if (normalizedNames.length === 0) {
    return { matched: [], unmatched: rawNames };
  }

  // ── Step 1: ingredients.name 정확 일치 ──────────────────────────────
  const { data: exactMatches } = await supabase
    .from("ingredients")
    .select("id, name")
    .in("name", normalizedNames);

  const step1Matched = new Set<string>();
  for (const row of exactMatches ?? []) {
    matched.push({
      raw_name: normalizedMap.get(row.name) ?? row.name,
      ingredient_id: row.id,
      ingredient_name: row.name,
      match_type: "exact",
    });
    step1Matched.add(row.name);
  }

  const afterStep1 = normalizedNames.filter((n) => !step1Matched.has(n));

  // ── Step 2: ingredient_aliases.alias 정확 일치 ──────────────────────
  let afterStep2 = afterStep1;
  if (afterStep1.length > 0) {
    const { data: aliasMatches } = await supabase
      .from("ingredient_aliases")
      .select("alias, ingredient_id, ingredients(name)")
      .in("alias", afterStep1);

    const step2Matched = new Set<string>();
    for (const row of aliasMatches ?? []) {
      // Supabase 관계 조인은 배열 또는 단일 객체로 추론될 수 있음
      const ingRaw = row.ingredients as
        | { name: string }
        | { name: string }[]
        | null;
      const ingName = Array.isArray(ingRaw)
        ? (ingRaw[0]?.name ?? "")
        : (ingRaw?.name ?? "");
      matched.push({
        raw_name: normalizedMap.get(row.alias) ?? row.alias,
        ingredient_id: row.ingredient_id,
        ingredient_name: ingName,
        match_type: "alias",
      });
      step2Matched.add(row.alias);
    }
    afterStep2 = afterStep1.filter((n) => !step2Matched.has(n));
  }

  // ── Step 3: 퍼지 매칭 RPC (유사도 0.9 이상) ─────────────────────────
  let afterStep3 = afterStep2;
  if (afterStep2.length > 0) {
    const step3Matched = new Set<string>();
    for (const term of afterStep2) {
      const { data: fuzzyResult, error: fuzzyError } = await supabase.rpc(
        "match_ingredient_fuzzy",
        { term, threshold: 0.9 }
      );
      if (fuzzyError) {
        console.error("[match] match_ingredient_fuzzy RPC error:", fuzzyError);
        throw new Error(
          `match_ingredient_fuzzy RPC 실패: ${fuzzyError.message}`
        );
      }
      const parsedFuzzy = fuzzyMatchRowsSchema.safeParse(fuzzyResult ?? []);
      if (!parsedFuzzy.success) {
        console.error(
          "[match] match_ingredient_fuzzy 응답 스키마 불일치:",
          parsedFuzzy.error.issues
        );
        throw new Error(
          "match_ingredient_fuzzy 응답이 예상 스키마와 일치하지 않습니다"
        );
      }
      if (parsedFuzzy.data.length > 0) {
        const best = parsedFuzzy.data[0];
        matched.push({
          raw_name: normalizedMap.get(term) ?? term,
          ingredient_id: best.ingredient_id,
          ingredient_name: best.name,
          match_type: "fuzzy",
        });
        step3Matched.add(term);
      }
    }
    afterStep3 = afterStep2.filter((n) => !step3Matched.has(n));
  }

  // ── Step 4: 미매칭 로그 기록 (service_role 필요) ────────────────────
  // 실제로 기록할 항목이 있을 때만 admin 클라이언트를 확보한다
  let admin: MatchSupabaseClient | null = null;
  if (logUnmatched && afterStep3.length > 0) {
    admin =
      options?.adminClient ??
      (await import("@/lib/supabase/admin").then((m) => m.adminSupabase));
  }

  for (const term of afterStep3) {
    const rawName = normalizedMap.get(term) ?? term;
    // 미매칭 목록 수집은 로깅 플래그와 무관하게 항상 수행한다
    unmatchedRaws.push(rawName);
    if (!logUnmatched || !admin) continue;
    // log_unmatched RPC: atomic upsert (occurrence_count 증가)
    // DB 함수는 NULL을 허용하지만 자동생성 타입이 non-nullable로 정의되어 있어 타입 단언 사용
    await admin.rpc("log_unmatched", {
      p_raw_name: rawName,
      p_product_id: (productId ?? null) as string,
    });
  }

  return { matched, unmatched: unmatchedRaws };
}
