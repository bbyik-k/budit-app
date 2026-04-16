import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme-switcher";

/** 모든 페이지 공통 헤더: 로고 + 다크모드 토글 */
export default function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        {/* 로고: 클릭 시 홈(/)으로 이동 */}
        <Link
          href="/"
          className="text-xl font-bold text-brand transition-opacity hover:opacity-80"
        >
          BUDIT
        </Link>

        {/* 다크모드 토글 */}
        <ThemeSwitcher />
      </div>
    </header>
  );
}
