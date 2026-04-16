import HeroSection from "@/components/landing/hero-section";
import HowItWorks from "@/components/landing/how-it-works";
import AnalyzeContainer from "@/components/analyze/analyze-container";

/**
 * 랜딩 페이지 (Server Component)
 * 구조: 히어로(브랜딩) → 검색/분석 플로우 → 서비스 소개
 */
export default function Home() {
  return (
    <>
      {/* 브랜딩 히어로 */}
      <HeroSection />

      {/* 검색 → 슬롯 선택 → 분석 → 결과 플로우 */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <AnalyzeContainer />
      </section>

      {/* 서비스 소개 (하단 고정) */}
      <HowItWorks />
    </>
  );
}
