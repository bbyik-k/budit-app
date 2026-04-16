import { Sparkles } from "lucide-react";

/** 랜딩 페이지 히어로 섹션: 브랜딩 + 슬로건 (CTA 없음 — 검색이 바로 아래 위치) */
export default function HeroSection() {
  return (
    <section className="flex flex-col items-center justify-center px-6 pb-8 pt-16 text-center">
      {/* 배지 */}
      <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-sm font-medium text-brand">
        <Sparkles size={14} />
        민감성 피부를 위한 성분 분석
      </span>

      {/* 메인 슬로건 */}
      <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        두 화장품, <span className="text-brand">함께 써도 괜찮을까?</span>
      </h1>

      {/* 부제 */}
      <p className="mt-4 max-w-lg text-base text-muted-foreground">
        제품명을 검색하거나 성분을 직접 입력해 충돌 여부를 바로 확인하세요.
      </p>
    </section>
  );
}
