/**
 * 성분명 정규화 함수
 * - 괄호 안 함량 표기 제거: (2%), [0.5%], {1.0%}, (500IU/g), (1,000ppm), (3 ppm) 등
 *   지원 단위: %, ppm, ppb, IU, IU/g, mg, ml (대소문자 무시)
 *   형태: 숫자(쉼표 포함 가능) + 선택적 공백 + 단위
 * - 연속 공백을 단일 공백으로 치환
 * - 앞뒤 공백 제거
 */
export function normalizeName(raw: string): string {
  return raw
    .replace(
      // IU/g는 IU보다 먼저 시도해야 "/g"가 남지 않는다
      /[([{][\d.,\s]*(?:%|ppm|ppb|iu\/g|iu|mg|ml)?\s*[)\]}]/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}
