import { expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { analyzeConflictsRowsSchema } from "@/lib/api/validation";

/**
 * AHA × 레티놀 회귀 테스트 공통 헬퍼 (실 DB)
 *
 * 제품 특정은 반드시 products.oliveyoung_id로 한다. 제품명은 표기가 바뀔 수
 * 있어 회귀 테스트의 기준으로 쓰지 않는다.
 */

export const GROUP_RETINOL = "레티놀 계열";
export const GROUP_AHA = "AHA 계열";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** oliveyoung_id로 제품 UUID를 조회한다 */
export async function findProductId(oliveyoungId: string): Promise<string> {
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("oliveyoung_id", oliveyoungId)
    .single();
  expect(error, `제품 조회 실패 (${oliveyoungId})`).toBeNull();
  expect(data, `제품이 존재하지 않음 (${oliveyoungId})`).not.toBeNull();
  return (data as { id: string }).id;
}

/** 제품의 전성분(성분 ID·표준명)을 조회한다 */
export async function fetchIngredients(
  productId: string
): Promise<{ ids: string[]; names: string[] }> {
  const { data, error } = await supabase
    .from("product_ingredients")
    .select("ingredient_id, ingredients(name)")
    .eq("product_id", productId);
  expect(error, "전성분 조회 실패").toBeNull();

  const rows = (data ?? []) as unknown as {
    ingredient_id: string;
    ingredients: { name: string } | { name: string }[] | null;
  }[];
  const ids: string[] = [];
  const names: string[] = [];
  for (const row of rows) {
    const ing = Array.isArray(row.ingredients)
      ? row.ingredients[0]
      : row.ingredients;
    if (!ing?.name) continue;
    ids.push(row.ingredient_id);
    names.push(ing.name);
  }
  return { ids, names };
}

/** 성분 ID 집합 중 지정 그룹에 소속된 성분명 목록을 반환한다 */
export async function membersOfGroup(
  ingredientIds: string[],
  groupName: string
): Promise<string[]> {
  const { data: group, error: groupError } = await supabase
    .from("ingredient_groups")
    .select("id")
    .eq("group_name", groupName)
    .single();
  expect(groupError, `그룹 조회 실패 (${groupName})`).toBeNull();

  const { data, error } = await supabase
    .from("ingredient_group_members")
    .select("ingredient_id, ingredients(name)")
    .eq("group_id", (group as { id: string }).id)
    .in("ingredient_id", ingredientIds);
  expect(error, `그룹 멤버 조회 실패 (${groupName})`).toBeNull();

  // Supabase 관계 조인은 배열 또는 단일 객체로 추론될 수 있다
  return (
    (data ?? []) as unknown as {
      ingredients: { name: string } | { name: string }[] | null;
    }[]
  )
    .map((r) =>
      Array.isArray(r.ingredients) ? r.ingredients[0] : r.ingredients
    )
    .map((ing) => ing?.name)
    .filter((n): n is string => Boolean(n));
}

/** analyze_conflicts RPC를 호출하고 스키마 검증까지 마친 행 배열을 반환한다 */
export async function analyzeConflicts(namesA: string[], namesB: string[]) {
  const { data, error } = await supabase.rpc("analyze_conflicts", {
    names_a: namesA,
    names_b: namesB,
  });
  expect(error, "analyze_conflicts RPC 실패").toBeNull();

  const parsed = analyzeConflictsRowsSchema.safeParse(data ?? []);
  expect(
    parsed.success,
    `RPC 응답이 스키마와 불일치: ${JSON.stringify(parsed.error?.issues)}`
  ).toBe(true);
  return parsed.success ? parsed.data : [];
}

/**
 * 반환 행에서 (AHA 계열, 레티놀 계열) 조합을 찾는다.
 * RPC는 양방향 매칭이므로 (a, b) 순서를 고정하지 않고 조합으로 판정한다.
 */
export function findAhaRetinolRule<
  T extends { ingredient_a: string; ingredient_b: string },
>(rows: T[]): T | undefined {
  return rows.find((r) => {
    const pair = [r.ingredient_a, r.ingredient_b];
    return pair.includes(GROUP_AHA) && pair.includes(GROUP_RETINOL);
  });
}
