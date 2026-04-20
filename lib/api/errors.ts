// API 에러 코드 타입 정의
export type ApiErrorCode =
  | "INVALID_QUERY"
  | "INVALID_BODY"
  | "PRODUCT_NOT_FOUND"
  | "EMPTY_SLOT"
  | "DB_ERROR"
  | "INTERNAL";

// 표준 에러 응답 생성 헬퍼
export function jsonError(status: number, code: ApiErrorCode, message: string) {
  return Response.json({ error: { code, message } }, { status });
}
