import { ThemeSwitcher } from "@/components/theme-switcher";
import LogoLink from "@/components/layout/logo-link";

/** 모든 페이지 공통 헤더: 로고 + 다크모드 토글 */
export default function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <LogoLink />

        {/* 다크모드 토글 */}
        <ThemeSwitcher />
      </div>
    </header>
  );
}
