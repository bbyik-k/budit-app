import { normalizeName } from "@/lib/ingredients/normalize";

/**
 * 전성분 원문 텍스트를 성분 토큰 배열로 분리한다.
 *
 * 처리 순서:
 * 1. 대괄호로 감싼 제품명 노이즈 제거 — "[알로에수딩]" 형태
 * 2. "@" 를 쉼표와 동일한 구분자로 취급
 * 3. 쉼표가 하나도 없으면 공백을 구분자로 사용 (라로슈포제·아벤느류 표기)
 * 4. 괄호 깊이를 세면서 분리 — 괄호 안의 구분자는 무시하므로
 *    "나이아신아마이드(1,000ppm)" 이 한 토큰으로 유지된다
 * 5. 각 토큰에 normalizeName() 을 적용하고 빈 문자열을 제거
 */
export function parseIngredientText(raw: string): string[] {
  if (!raw) return [];

  // 1. 대괄호 노이즈 제거 (제품 변형명이 목록 중간에 끼어드는 경우)
  let text = raw.replace(/\[[^\]]*\]/g, " ");

  // 2. "@" 구분자를 쉼표로 통일
  text = text.replace(/@/g, ",");

  // 3. 구분자로 쓰인 쉼표가 없으면 공백 구분으로 전환.
  //    "1,2-헥산다이올"의 쉼표는 성분명의 일부라 판정에서 제외한다.
  //    (제외하지 않으면 공백 구분 표기를 쉼표 구분으로 오판해 전체가 한 토큰이 된다)
  const useSpaceSeparator = !/(?<!\d),|,(?!\d)/.test(text);

  // 4~5. 괄호 깊이를 세며 분리한 뒤 정규화
  return splitByDepth(text, useSpaceSeparator)
    .map(normalizeName)
    .filter(Boolean);
}

/**
 * 괄호 깊이가 0인 위치의 구분자에서만 문자열을 자른다.
 * 여는 괄호가 닫히지 않은 입력에서도 깊이가 음수로 내려가지 않도록 방어한다.
 */
function splitByDepth(text: string, useSpaceSeparator: boolean): string[] {
  const tokens: string[] = [];
  let buffer = "";
  let depth = 0;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (ch === "(" || ch === "[" || ch === "{") {
      depth += 1;
    } else if (ch === ")" || ch === "]" || ch === "}") {
      depth = Math.max(0, depth - 1);
    }

    // 앞뒤가 모두 숫자인 쉼표는 화학 명명법의 일부다.
    // "1,2-헥산다이올", "1,3-부탄다이올" 등이 쪼개지지 않게 구분자에서 제외한다.
    const isNumericComma =
      ch === "," &&
      /\d/.test(text[i - 1] ?? "") &&
      /\d/.test(text[i + 1] ?? "");

    const isSeparator =
      !isNumericComma &&
      depth === 0 &&
      (useSpaceSeparator ? /\s/.test(ch) : ch === ",");

    if (isSeparator) {
      tokens.push(buffer);
      buffer = "";
    } else {
      buffer += ch;
    }
  }
  tokens.push(buffer);

  return tokens;
}
