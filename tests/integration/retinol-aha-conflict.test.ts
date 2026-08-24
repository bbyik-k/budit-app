import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { analyzeConflictsRowsSchema } from "@/lib/api/validation";

/**
 * 재현 케이스 고정 통합 테스트 (실 DB)
 *
 * 이니스프리 레티놀 시카 흔적 앰플 x 메디힐 더마 패드 조합이
 * "AHA 계열 x 레티놀 계열 (avoid, high)" 규칙을 계속 반환하는지 고정한다.
 *
 * 제품 특정은 반드시 products.oliveyoung_id로 한다. 제품명은 표기가 바뀔 수
 * 있어 회귀 테스트의 기준으로 쓰지 않는다.
 */

// 이니스프리 레티놀 시카 흔적 앰플 — 레티놀 계열 보유
const OLIVEYOUNG_ID_A = "A000000230208";
// 메디힐 더마 패드 — AHA 계열 보유
const OLIVEYOUNG_ID_B = "A000000171427";

const GROUP_A = "레티놀 계열";
const GROUP_B = "AHA 계열";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** oliveyoung_id로 제품 UUID를 조회한다 */
async function findProductId(oliveyoungId: string): Promise<string> {
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("oliveyoung_id", oliveyoungId)
    .single();
  expect(error, `제품 조회 실패 (${oliveyoungId})`).toBeNull();
  expect(data, `제품이 존재하지 않음 (${oliveyoungId})`).not.toBeNull();
  return (data as { id: string }).id;
}

/** 제품의 전성분 목록(정규화된 성분명)을 조회한다 */
async function fetchIngredientNames(
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
async function membersOfGroup(
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

describe("재현 케이스: 이니스프리 레티놀 앰플 x 메디힐 더마 패드", () => {
  let namesA: string[];
  let namesB: string[];
  let groupMembersA: string[];
  let groupMembersB: string[];
  let rules: unknown;

  beforeAll(async () => {
    const [productIdA, productIdB] = await Promise.all([
      findProductId(OLIVEYOUNG_ID_A),
      findProductId(OLIVEYOUNG_ID_B),
    ]);

    const [ingA, ingB] = await Promise.all([
      fetchIngredientNames(productIdA),
      fetchIngredientNames(productIdB),
    ]);
    namesA = ingA.names;
    namesB = ingB.names;

    [groupMembersA, groupMembersB] = await Promise.all([
      membersOfGroup(ingA.ids, GROUP_A),
      membersOfGroup(ingB.ids, GROUP_B),
    ]);

    const { data, error } = await supabase.rpc("analyze_conflicts", {
      names_a: namesA,
      names_b: namesB,
    });
    expect(error, "analyze_conflicts RPC 실패").toBeNull();
    rules = data;
  });

  // 검증 1: 각 제품의 전성분에 대상 그룹 소속 성분이 최소 1개씩 존재
  it(`제품 A(${OLIVEYOUNG_ID_A})의 전성분에 ${GROUP_A} 소속 성분이 최소 1개 존재한다`, () => {
    expect(namesA.length).toBeGreaterThan(0);
    expect(groupMembersA.length).toBeGreaterThanOrEqual(1);
  });

  it(`제품 B(${OLIVEYOUNG_ID_B})의 전성분에 ${GROUP_B} 소속 성분이 최소 1개 존재한다`, () => {
    expect(namesB.length).toBeGreaterThan(0);
    expect(groupMembersB.length).toBeGreaterThanOrEqual(1);
  });

  // 검증 2·3: analyze_conflicts 결과에 (AHA 계열, 레티놀 계열, avoid, high)가
  // 포함되고, 해당 매칭의 a_type/b_type이 모두 "group"이다
  it(`analyze_conflicts 결과에 (${GROUP_B}, ${GROUP_A}, avoid, high) 규칙이 a_type/b_type 모두 group으로 포함된다`, () => {
    const parsed = analyzeConflictsRowsSchema.safeParse(rules ?? []);
    expect(
      parsed.success,
      `RPC 응답이 스키마와 불일치: ${JSON.stringify(parsed.error?.issues)}`
    ).toBe(true);
    if (!parsed.success) return;

    // RPC는 양방향 매칭이므로 (a,b) 순서를 고정하지 않고 조합으로 판정한다
    const target = parsed.data.find((r) => {
      const pair = [r.ingredient_a, r.ingredient_b];
      return pair.includes(GROUP_A) && pair.includes(GROUP_B);
    });

    expect(
      target,
      `${GROUP_A} x ${GROUP_B} 규칙이 반환되지 않음`
    ).toBeDefined();
    expect(target!.conflict_type).toBe("avoid");
    expect(target!.severity).toBe("high");
    expect(target!.a_type).toBe("group");
    expect(target!.b_type).toBe("group");
  });
});
