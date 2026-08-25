import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { matchIngredients } from "@/lib/analyze/match";
import type { Database } from "@/lib/database.types";

/**
 * 공백 제거 정확 일치(Step 1.5) 통합 테스트
 *
 * 무엇을 검증하나:
 *   전성분 원문에 띄어쓰기 오류가 섞인 표기("1,2-헥산 다이올")를
 *   표준명("1,2-헥산다이올")으로 매칭하고 match_type을 "exact_nospace"로
 *   부여하는지 고정한다.
 *
 * 왜 필요한가:
 *   normalizeName()은 연속 공백을 하나로 줄일 뿐 제거하지 않아 Step 1의
 *   정확 일치가 실패한다. fuzzy(threshold 0.9)로도 잡히지 않는다
 *   ("1,2-헥산 다이올" vs "1,2-헥산다이올"의 실측 similarity는 0.615).
 *   임계값을 낮추는 대신 유사도를 쓰지 않는 별도 단계로 처리한 것이라,
 *   이 단계가 사라지면 24종의 띄어쓰기 오류가 전부 미매칭으로 돌아간다.
 *
 * matchIngredients는 Supabase 클라이언트를 필요로 하므로 service_role
 * 클라이언트를 주입해 실 DB로 검증한다. logUnmatched: false로 호출해
 * unmatched_log에 쓰지 않는다.
 */

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** 실 DB를 읽되 미매칭 로그는 남기지 않는 호출 */
function match(names: string[]) {
  return matchIngredients(names, undefined, {
    logUnmatched: false,
    client: supabase,
    adminClient: supabase,
  });
}

describe("Step 1.5 — 공백 제거 후 정확 일치", () => {
  it.each([
    [
      "하이드롤라이즈드소듐하이알루로네 이트",
      "하이드롤라이즈드소듐하이알루로네이트",
    ],
    ["소듐하이알루 로네이트크로스폴리머", "소듐하이알루로네이트크로스폴리머"],
    ["1,2-헥산 다이올", "1,2-헥산다이올"],
  ])("%s → %s (exact_nospace)", async (input, expected) => {
    const { matched, unmatched } = await match([input]);

    expect(unmatched, `${input}이 미매칭으로 떨어짐`).toEqual([]);
    expect(matched).toHaveLength(1);
    expect(matched[0].ingredient_name).toBe(expected);
    expect(matched[0].match_type).toBe("exact_nospace");
    // 원문은 보존되어야 한다 (UI가 "원문 → 표준명"으로 렌더하므로)
    expect(matched[0].raw_name).toBe(input);
  });

  it("공백이 없는 표기는 여전히 exact로 분류된다", async () => {
    const { matched, unmatched } = await match(["1,2-헥산다이올"]);

    expect(unmatched).toEqual([]);
    expect(matched).toHaveLength(1);
    expect(matched[0].ingredient_name).toBe("1,2-헥산다이올");
    expect(matched[0].match_type).toBe("exact");
  });

  it("여러 토큰이 섞여도 각각 알맞은 match_type을 받는다", async () => {
    const { matched } = await match([
      "정제수", // Step 1   → exact
      "1,2-헥산 다이올", // Step 1.5 → exact_nospace
      "글라이콜릭애씨드", // Step 2   → alias (B2에서 등록)
    ]);

    const typeOf = (name: string) =>
      matched.find((m) => m.raw_name === name)?.match_type;

    expect(typeOf("정제수")).toBe("exact");
    expect(typeOf("1,2-헥산 다이올")).toBe("exact_nospace");
    expect(typeOf("글라이콜릭애씨드")).toBe("alias");
  });

  it("공백을 지워도 후보에 없으면 미매칭으로 남는다", async () => {
    const { matched, unmatched } = await match(["존재 하지 않는 성분 ZZZ"]);

    expect(matched).toEqual([]);
    expect(unmatched).toHaveLength(1);
  });
});
