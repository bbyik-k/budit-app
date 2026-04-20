/**
 * 성분명 정규화 함수
 * - 괄호 안 농도 표기 제거: (2%), [0.5%], {1.0%} 등
 * - 연속 공백을 단일 공백으로 치환
 * - 앞뒤 공백 제거
 */
export function normalizeName(raw: string): string {
  return raw
    .replace(/[\(\[\{][\d.\s]*%?\s*[\)\]\}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
