/** 분석 단계 상태 */
export type AnalyzeStep =
  | "select-a"
  | "select-b"
  | "ready"
  | "analyzing"
  | "result";

/** 슬롯에 담기는 데이터 (제품 선택 또는 직접 입력) */
export interface SlotData {
  type: "product" | "manual";
  productId?: string;
  productName?: string;
  brand?: string;
  /** 직접 입력 시 파싱된 성분 목록 */
  ingredients?: string[];
}

/** 분석 페이지 전체 상태 */
export interface AnalyzeState {
  step: AnalyzeStep;
  slotA: SlotData | null;
  slotB: SlotData | null;
  result: AnalyzeResult | null;
}

/** 상태 변경 액션 */
export type AnalyzeAction =
  | { type: "SELECT_SLOT_A"; payload: SlotData }
  | { type: "SELECT_SLOT_B"; payload: SlotData }
  | { type: "START_ANALYZE" }
  | { type: "SET_RESULT"; payload: AnalyzeResult }
  | { type: "RESET" };

/** 충돌 규칙 결과 */
export interface ConflictResult {
  ingredientA: string;
  ingredientB: string;
  conflictType: "avoid" | "caution";
  severity: "high" | "medium" | "low";
  reasonKo: string;
  recommend: string;
}

/** 시너지 결과 */
export interface SynergyResult {
  ingredientA: string;
  ingredientB: string;
  reasonKo: string;
}

/** 분석 결과 전체 */
export interface AnalyzeResult {
  conflicts: ConflictResult[];
  synergies: SynergyResult[];
}
