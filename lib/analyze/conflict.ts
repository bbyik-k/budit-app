import { createClient } from "@/lib/supabase/server";
import type { ConflictResult, SynergyResult } from "@/types/analyze";

/**
 * 성분명 집합 A/B를 받아 그룹 확장 후 conflict_rules 양방향 조회
 * canonical 순서(ingredient_a < ingredient_b)로 저장되어 있으므로 두 방향 모두 검색
 */
export async function analyzeConflicts(
  namesA: string[],
  namesB: string[]
): Promise<{ conflicts: ConflictResult[]; synergies: SynergyResult[] }> {
  const supabase = await createClient();

  /**
   * 성분명 배열을 받아 해당 성분이 속한 그룹명 목록 반환
   */
  async function getGroupNames(ingredientNames: string[]): Promise<string[]> {
    if (ingredientNames.length === 0) return [];

    // ingredients.name → ingredient_id 조회
    const { data: ingRows } = await supabase
      .from("ingredients")
      .select("id")
      .in("name", ingredientNames);

    const ids = (ingRows ?? []).map((r) => r.id);
    if (ids.length === 0) return [];

    // ingredient_group_members → ingredient_groups 조인으로 그룹명 조회
    const { data: memberRows } = await supabase
      .from("ingredient_group_members")
      .select("ingredient_groups(group_name)")
      .in("ingredient_id", ids);

    const groups = new Set<string>();
    for (const row of memberRows ?? []) {
      const g = row.ingredient_groups as
        | { group_name: string }
        | { group_name: string }[]
        | null;
      const name = Array.isArray(g) ? g[0]?.group_name : g?.group_name;
      if (name) groups.add(name);
    }
    return [...groups];
  }

  // 슬롯 A, B 각각 그룹 확장 (병렬 조회)
  const [groupNamesA, groupNamesB] = await Promise.all([
    getGroupNames(namesA),
    getGroupNames(namesB),
  ]);

  // 성분명 + 그룹명 합산 (중복 제거)
  const termsA = [...new Set([...namesA, ...groupNamesA])];
  const termsB = [...new Set([...namesB, ...groupNamesB])];

  if (termsA.length === 0 || termsB.length === 0) {
    return { conflicts: [], synergies: [] };
  }

  // Supabase .or() 인자용 CSV — 괄호·쉼표 제거로 파싱 오류 방지
  const toCsv = (terms: string[]) =>
    terms.map((t) => t.replace(/[(),]/g, " ").trim()).join(",");
  const csvA = toCsv(termsA);
  const csvB = toCsv(termsB);

  // canonical 순서로 저장된 규칙을 양방향으로 조회
  const { data: rules } = await supabase
    .from("conflict_rules")
    .select("*")
    .or(
      `and(ingredient_a.in.(${csvA}),ingredient_b.in.(${csvB})),` +
        `and(ingredient_a.in.(${csvB}),ingredient_b.in.(${csvA}))`
    );

  const conflicts: ConflictResult[] = [];
  const synergies: SynergyResult[] = [];

  for (const r of rules ?? []) {
    if (r.conflict_type === "synergy") {
      synergies.push({
        ingredientA: r.ingredient_a,
        ingredientB: r.ingredient_b,
        reasonKo: r.reason_ko,
      });
    } else {
      // avoid / caution — severity는 DB CHECK 제약으로 non-null 보장
      conflicts.push({
        ingredientA: r.ingredient_a,
        ingredientB: r.ingredient_b,
        conflictType: r.conflict_type as "avoid" | "caution",
        severity: (r.severity ?? "low") as "high" | "medium" | "low",
        reasonKo: r.reason_ko,
        recommend: r.recommend ?? "",
      });
    }
  }

  return { conflicts, synergies };
}
