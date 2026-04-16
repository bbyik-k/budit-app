import { redirect } from "next/navigation";

/**
 * /analyze 라우트는 / 로 통합되었습니다.
 * 이전 URL로 접근 시 홈으로 리다이렉트합니다.
 */
export default function AnalyzePage() {
  redirect("/");
}
