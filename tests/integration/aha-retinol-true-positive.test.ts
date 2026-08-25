import { describe, it, expect, beforeAll } from "vitest";
import {
  GROUP_AHA,
  GROUP_RETINOL,
  analyzeConflicts,
  fetchIngredients,
  findAhaRetinolRule,
  findProductId,
  membersOfGroup,
} from "./helpers/aha-retinol";

/**
 * AHA × 레티놀 정탐 테스트 (실 DB)
 *
 * 무엇을 검증하나:
 *   실제로 각질 제거 산(만델릭애씨드)을 가진 제품과 레티놀 제품을 조합했을 때
 *   analyze_conflicts가 (AHA 계열, 레티놀 계열, avoid, high) 규칙을 반환하는지
 *   고정한다. a_type/b_type이 모두 "group"인 것도 함께 확인해 그룹 확장 경로가
 *   살아 있음을 보장한다.
 *
 * 왜 이 조합인가:
 *   원래 이 테스트는 메디힐 더마 패드(A000000171427)를 B 슬롯으로 썼으나,
 *   그 제품의 AHA 판정은 시트릭애씨드 단독에서 나온 오탐이었다. 시트릭애씨드를
 *   pH 조절제 계열로 재분류하면서 B 슬롯을 실제 각질 제거 산 보유 제품인
 *   닥터지 레드 블레미쉬(만델릭애씨드)로 교체했다.
 *   같은 제품 조합의 오탐 방지 검증은 aha-retinol-false-positive.test.ts 참조.
 *
 * 제품 특정은 반드시 products.oliveyoung_id로 한다.
 */

// 이니스프리 레티놀 시카 흔적 앰플 — 레티놀 계열 보유
const OLIVEYOUNG_ID_RETINOL = "A000000230208";
// 닥터지 레드 블레미쉬 10-시카 캡슐 수딩 토너 — 만델릭애씨드(AHA 계열) 보유
const OLIVEYOUNG_ID_AHA = "A000000252322";

describe("정탐: 레티놀 제품 × 만델릭애씨드 제품", () => {
  let namesRetinol: string[];
  let namesAha: string[];
  let retinolGroupMembers: string[];
  let ahaGroupMembers: string[];
  let rules: Awaited<ReturnType<typeof analyzeConflicts>>;

  beforeAll(async () => {
    const [idRetinol, idAha] = await Promise.all([
      findProductId(OLIVEYOUNG_ID_RETINOL),
      findProductId(OLIVEYOUNG_ID_AHA),
    ]);

    const [ingRetinol, ingAha] = await Promise.all([
      fetchIngredients(idRetinol),
      fetchIngredients(idAha),
    ]);
    namesRetinol = ingRetinol.names;
    namesAha = ingAha.names;

    [retinolGroupMembers, ahaGroupMembers] = await Promise.all([
      membersOfGroup(ingRetinol.ids, GROUP_RETINOL),
      membersOfGroup(ingAha.ids, GROUP_AHA),
    ]);

    rules = await analyzeConflicts(namesRetinol, namesAha);
  });

  it(`제품 A(${OLIVEYOUNG_ID_RETINOL})의 전성분에 ${GROUP_RETINOL} 소속 성분이 있다`, () => {
    expect(namesRetinol.length).toBeGreaterThan(0);
    expect(retinolGroupMembers.length).toBeGreaterThanOrEqual(1);
  });

  it(`제품 B(${OLIVEYOUNG_ID_AHA})의 전성분에 ${GROUP_AHA} 소속 성분이 있다`, () => {
    expect(namesAha.length).toBeGreaterThan(0);
    expect(ahaGroupMembers.length).toBeGreaterThanOrEqual(1);
  });

  it("AHA 판정이 시트릭애씨드가 아닌 실제 각질 제거 산에서 나온다", () => {
    // 시트릭애씨드는 pH 조절제 계열이므로 AHA 멤버로 잡히면 안 된다
    expect(ahaGroupMembers).not.toContain("시트릭애씨드");
    expect(ahaGroupMembers).toContain("만델릭애씨드");
  });

  it(`(${GROUP_AHA}, ${GROUP_RETINOL}, avoid, high) 규칙이 group 확장으로 반환된다`, () => {
    const target = findAhaRetinolRule(rules);

    expect(
      target,
      `${GROUP_AHA} × ${GROUP_RETINOL} 규칙이 반환되지 않음`
    ).toBeDefined();
    expect(target!.conflict_type).toBe("avoid");
    expect(target!.severity).toBe("high");
    expect(target!.a_type).toBe("group");
    expect(target!.b_type).toBe("group");
  });
});
