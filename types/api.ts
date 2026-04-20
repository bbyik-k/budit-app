// 제품 검색 결과 단건 아이템
export interface ProductSearchItem {
  id: string;
  name: string;
  brand: string;
  category: string | null;
  image_url: string | null;
}

// 제품 검색 API 응답 타입
export interface ProductSearchResponse {
  items: ProductSearchItem[];
}

// 성분 매칭 결과 단건 아이템
export interface MatchedItem {
  raw_name: string;
  ingredient_id: string;
  ingredient_name: string;
  match_type: "exact" | "alias" | "fuzzy";
}

// 성분 매칭 API 요청 타입
export interface MatchRequest {
  ingredients: string[];
  product_id?: string;
}

// 성분 매칭 API 응답 타입
export interface MatchResponse {
  matched: MatchedItem[];
  unmatched: string[];
}

// 충돌 분석 API 요청 타입
export interface AnalyzeRequest {
  slotA: import("@/types/analyze").SlotData;
  slotB: import("@/types/analyze").SlotData;
}

// 충돌 분석 API 응답 타입 (AnalyzeResult와 동일)
export type AnalyzeResponse = import("@/types/analyze").AnalyzeResult;
