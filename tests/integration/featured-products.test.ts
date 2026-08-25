import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * get_featured_products RPC 통합 테스트
 *
 * 무엇을 검증하나:
 *   제품 선택 드롭다운의 기본 노출 목록이 "서브카테고리별 최소
 *   oliveyoung_rank 를 가진 모든 제품"과 정확히 일치하는지 고정한다.
 *
 * 왜 필요한가:
 *   oliveyoung_rank 는 전역 인기 순위가 아니라 서브카테고리 내 순위다.
 *   362건 기준 rank=1 인 제품이 18건이라 ORDER BY oliveyoung_rank LIMIT N
 *   으로는 동점자 중 임의 선택이 되어 결과가 매번 달라진다.
 *
 *   특히 DISTINCT ON (subcategory) 로 구현하면 서브카테고리당 1건만 남는데,
 *   cleansing 은 세분류가 없어 rank=1 이 6건이고 이들은 실제로는 리무버·
 *   클렌징워터·티슈·필링젤·오일·폼 각각의 1위다. 아래 케이스 2가 이
 *   6건이 전부 살아있음을 사실상 고정한다.
 *
 * 건수(18)를 하드코딩하지 않는다. 제품이 추가되면 값이 바뀌지만 "서브
 * 카테고리별 최소 rank" 라는 성질은 유지돼야 하므로, 기대값을 products
 * 전수 조회로 매번 계산해 대조한다.
 */

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ProductRow = {
  id: string;
  subcategory: string | null;
  oliveyoung_rank: number | null;
};

let rpcRows: { id: string }[];
let allProducts: ProductRow[];

beforeAll(async () => {
  const [rpc, products] = await Promise.all([
    supabase.rpc("get_featured_products"),
    supabase.from("products").select("id, subcategory, oliveyoung_rank"),
  ]);

  if (rpc.error) throw new Error(`RPC 실패: ${rpc.error.message}`);
  if (products.error)
    throw new Error(`products 조회 실패: ${products.error.message}`);

  rpcRows = rpc.data;
  allProducts = products.data;
});

/** products 전수에서 서브카테고리별 최소 rank 를 가진 행을 계산한다 */
function expectedIds(): Set<string> {
  const candidates = allProducts.filter(
    (p) => p.subcategory !== null && p.oliveyoung_rank !== null
  );

  const minRank = new Map<string, number>();
  for (const p of candidates) {
    const current = minRank.get(p.subcategory!);
    if (current === undefined || p.oliveyoung_rank! < current) {
      minRank.set(p.subcategory!, p.oliveyoung_rank!);
    }
  }

  return new Set(
    candidates
      .filter((p) => p.oliveyoung_rank === minRank.get(p.subcategory!))
      .map((p) => p.id)
  );
}

describe("get_featured_products — 서브카테고리별 최상위 랭크 조회", () => {
  it("1건 이상 반환하며 id 가 중복되지 않는다", () => {
    expect(rpcRows.length).toBeGreaterThan(0);
    expect(new Set(rpcRows.map((r) => r.id)).size).toBe(rpcRows.length);
  });

  it("서브카테고리별 최소 rank 행 집합과 정확히 일치한다", () => {
    const expected = expectedIds();
    const actual = new Set(rpcRows.map((r) => r.id));

    // 누락(기대에는 있는데 RPC 가 안 준 것)과 초과(RPC 만 준 것)를 각각 본다
    const missing = [...expected].filter((id) => !actual.has(id));
    const extra = [...actual].filter((id) => !expected.has(id));

    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });

  it("모든 서브카테고리가 최소 1건씩 대표된다", () => {
    const allSubs = new Set(
      allProducts
        .filter((p) => p.subcategory !== null && p.oliveyoung_rank !== null)
        .map((p) => p.subcategory!)
    );

    const byId = new Map(allProducts.map((p) => [p.id, p]));
    const returnedSubs = new Set(
      rpcRows.map((r) => byId.get(r.id)?.subcategory).filter(Boolean)
    );

    expect(returnedSubs.size).toBe(allSubs.size);
  });

  it("subcategory 가 NULL 인 제품은 포함하지 않는다", () => {
    const nullSubIds = new Set(
      allProducts.filter((p) => p.subcategory === null).map((p) => p.id)
    );

    // 픽스처 유래로 실제 존재하는 상태여야 이 테스트가 의미를 갖는다
    expect(nullSubIds.size).toBeGreaterThan(0);
    expect(rpcRows.filter((r) => nullSubIds.has(r.id))).toEqual([]);
  });
});
