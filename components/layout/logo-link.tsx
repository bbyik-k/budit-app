"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/** 로고 클릭 시 홈 이동 + 분석 컨테이너 상태 초기화 */
export default function LogoLink() {
  const router = useRouter();

  const handleClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent("budit:reset"));
    router.push("/");
  }, [router]);

  return (
    <button
      onClick={handleClick}
      className="text-xl font-bold text-brand transition-opacity hover:opacity-80"
    >
      BUDIT
    </button>
  );
}
