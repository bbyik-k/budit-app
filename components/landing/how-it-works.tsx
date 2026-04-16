import { Search, FlaskConical, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** 3단계 사용법 안내 섹션 */
export default function HowItWorks() {
  const steps = [
    {
      step: "01",
      icon: Search,
      title: "제품 선택",
      description: "비교할 두 화장품을 검색하거나 성분을 직접 붙여넣으세요.",
    },
    {
      step: "02",
      icon: FlaskConical,
      title: "성분 분석",
      description:
        "The Ordinary 충돌 차트 기반으로 성분 그룹 간 충돌 여부를 판별합니다.",
    },
    {
      step: "03",
      icon: ShieldCheck,
      title: "결과 확인",
      description:
        "충돌 성분과 심각도, 루틴 분리 권장사항을 한눈에 확인하세요.",
    },
  ];

  return (
    <section className="border-t border-border bg-muted/30 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        {/* 섹션 제목 */}
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            3단계로 끝나는 성분 분석
          </h2>
          <p className="mt-3 text-muted-foreground">
            복잡한 화학 지식 없이도 피부 트러블을 예방하세요
          </p>
        </div>

        {/* 3단계 카드 */}
        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map(({ step, icon: Icon, title, description }) => (
            <Card key={step} className="relative overflow-hidden">
              {/* 단계 번호 (배경 장식) */}
              <span className="absolute right-4 top-4 select-none text-5xl font-black text-muted/40">
                {step}
              </span>
              <CardHeader className="pb-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10">
                  <Icon size={22} className="text-brand" />
                </div>
              </CardHeader>
              <CardContent>
                <h3 className="mb-1.5 font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
