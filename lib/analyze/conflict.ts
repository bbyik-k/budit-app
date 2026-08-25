import { createClient } from "@/lib/supabase/server";
import { analyzeConflictsRowsSchema } from "@/lib/api/validation";
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

  // RPC 에러를 빈 결과로 흘리면 UI가 "안전한 조합입니다!"로 렌더한다 (최악의 false negative).
  // 스키마 검증 실패와 동일하게 throw로 통일해 500으로 올린다.
  if (error) {
    console.error("[conflict] RPC error:", error);
    throw new Error(`analyze_conflicts RPC 실패: ${error.message}`);
  }

  const parsed = analyzeConflictsRowsSchema.safeParse(rules ?? []);
  if (!parsed.success) {
    console.error("[conflict] RPC 응답 스키마 불일치:", parsed.error.issues);
    throw new Error("analyze_conflicts 응답이 예상 스키마와 일치하지 않습니다");
  }

  const conflicts: ConflictResult[] = [];
  const synergies: SynergyResult[] = [];

  for (const r of parsed.data) {
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
        conflictType: r.conflict_type,
        severity: r.severity ?? "low",
        reasonKo: r.reason_ko,
        recommend: r.recommend ?? "",
      });
    }
  }

  return { conflicts, synergies };
}
