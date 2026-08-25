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
 * AHA × 레티놀 오탐 방지 테스트 (실 DB)
 *
 * 무엇을 검증하나:
 *   각질 제거 산이 하나도 없는 제품이 레티놀 제품과 조합됐을 때
 *   AHA 계열 규칙이 반환되지 **않는지** 고정한다.
 *
 * 왜 필요한가:
 *   메디힐 더마 패드(A000000171427)의 raw_ingredients_text 34개 토큰을 실측한
 *   결과, 각질 제거 목적 산 6종(글리콜릭·락틱·만델릭·말릭·타타르·살리실릭,
 *   표기 변형 포함)이 **하나도 없다**. "애씨드"로 끝나는 토큰은 시트릭애씨드
 *   (순번 17/34) · 마데카식애씨드 · 아시아틱애씨드 3개뿐이고 뒤 둘은 병풀
 *   유래다.
 *
 *   그럼에도 이 제품은 시트릭애씨드가 AHA 계열로 매핑돼 있던 탓에 레티놀과
 *   avoid/high 경고를 받았다. 적재된 358건 중 AHA로 확장되는 99건 가운데
 *   93건이 시트릭애씨드 단독이었다. 시트릭애씨드를 pH 조절제 계열로 재분류해
 *   이 오탐을 제거했고, 이 테스트가 재발을 막는다.
 *
 *   정탐 쪽 검증은 aha-retinol-true-positive.test.ts 참조.
 *
 * 제품 특정은 반드시 products.oliveyoung_id로 한다.
 */

// 이니스프리 레티놀 시카 흔적 앰플 — 레티놀 계열 보유
const OLIVEYOUNG_ID_RETINOL = "A000000230208";
// 메디힐 더마 패드 (마데카소사이드) — 각질 제거 산 0종, 시트릭애씨드만 보유
const OLIVEYOUNG_ID_NO_AHA = "A000000171427";

describe("오탐 방지: 레티놀 제품 × 각질 제거 산이 없는 제품", () => {
  let namesRetinol: string[];
  let namesNoAha: string[];
  let retinolGroupMembers: string[];
  let ahaGroupMembers: string[];
  let rules: Awaited<ReturnType<typeof analyzeConflicts>>;

  beforeAll(async () => {
    const [idRetinol, idNoAha] = await Promise.all([
      findProductId(OLIVEYOUNG_ID_RETINOL),
      findProductId(OLIVEYOUNG_ID_NO_AHA),
    ]);

    const [ingRetinol, ingNoAha] = await Promise.all([
      fetchIngredients(idRetinol),
      fetchIngredients(idNoAha),
    ]);
    namesRetinol = ingRetinol.names;
    namesNoAha = ingNoAha.names;

    [retinolGroupMembers, ahaGroupMembers] = await Promise.all([
      membersOfGroup(ingRetinol.ids, GROUP_RETINOL),
      membersOfGroup(ingNoAha.ids, GROUP_AHA),
    ]);

    rules = await analyzeConflicts(namesRetinol, namesNoAha);
  });

  it(`제품 A(${OLIVEYOUNG_ID_RETINOL})는 여전히 ${GROUP_RETINOL} 소속 성분을 가진다`, () => {
    // 레티놀 쪽이 비어서 규칙이 안 나오는 것이면 이 테스트는 무의미하다
    expect(namesRetinol.length).toBeGreaterThan(0);
    expect(retinolGroupMembers.length).toBeGreaterThanOrEqual(1);
  });

  it(`제품 B(${OLIVEYOUNG_ID_NO_AHA})의 전성분에 각질 제거 산이 없다`, () => {
    expect(namesNoAha.length).toBeGreaterThan(0);

    // 원문 실측 기준: 글리콜릭·락틱·만델릭·말릭·타타르·살리실릭 전부 없음
    const exfoliants = [
      "글리콜릭",
      "글라이콜릭",
      "락틱",
      "만델",
      "말릭",
      "타타",
      "살리실",
    ];
    const found = namesNoAha.filter((n) =>
      exfoliants.some((stem) => n.includes(stem))
    );
    expect(found, `각질 제거 산이 발견됨: ${found.join(", ")}`).toEqual([]);
  });

  it("시트릭애씨드를 보유하지만 AHA 계열로 확장되지 않는다", () => {
    expect(namesNoAha).toContain("시트릭애씨드");
    expect(
      ahaGroupMembers,
      `AHA 계열로 확장된 성분: ${ahaGroupMembers.join(", ")}`
    ).toEqual([]);
  });

  it(`${GROUP_AHA} × ${GROUP_RETINOL} 규칙이 반환되지 않는다`, () => {
    const target = findAhaRetinolRule(rules);
    expect(
      target,
      `오탐: ${GROUP_AHA} × ${GROUP_RETINOL} 규칙이 반환됨 (${JSON.stringify(target)})`
    ).toBeUndefined();
  });

  it(`반환 행 어디에도 ${GROUP_AHA}가 등장하지 않는다`, () => {
    const ahaRows = rules.filter(
      (r) => r.ingredient_a === GROUP_AHA || r.ingredient_b === GROUP_AHA
    );
    expect(
      ahaRows.map((r) => `${r.ingredient_a}×${r.ingredient_b}`),
      "AHA 계열 규칙이 남아 있음"
    ).toEqual([]);
  });
});
