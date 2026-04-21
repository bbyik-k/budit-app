import { createClient } from "@/lib/supabase/server";
import type { ConflictResult, SynergyResult } from "@/types/analyze";

/**
 * 성분명 집합 A/B를 받아 DB RPC로 충돌 규칙 조회
 * 그룹 확장·양방향 매칭은 모두 DB 함수(analyze_conflicts) 내에서 처리
 * - URL 길이 제한 우회 (기존 .or() + toCsv 방식은 성분 수 증가 시 10KB+ 초과)
 */
export async function analyzeConflicts(
  namesA: string[],
  namesB: string[]
): Promise<{ conflicts: ConflictResult[]; synergies: SynergyResult[] }> {
  const supabase = await createClient();

  const { data: rules, error } = await supabase.rpc("analyze_conflicts", {
    names_a: namesA,
    names_b: namesB,
  });

  if (error) {
    console.error("[conflict] RPC error:", error);
    return { conflicts: [], synergies: [] };
  }

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
