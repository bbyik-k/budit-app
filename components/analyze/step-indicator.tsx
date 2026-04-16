import type { AnalyzeStep } from "@/types/analyze";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  step: AnalyzeStep;
}

/** 분석 단계 표시 컴포넌트 (슬롯 A 선택 → 슬롯 B 선택 → 분석 준비 → 결과) */
export default function StepIndicator({ step }: StepIndicatorProps) {
  const steps: { key: AnalyzeStep[]; label: string }[] = [
    { key: ["select-a"], label: "제품 A 선택" },
    { key: ["select-b"], label: "제품 B 선택" },
    { key: ["ready", "analyzing"], label: "분석 준비" },
    { key: ["result"], label: "결과 확인" },
  ];

  /** 현재 step이 해당 단계를 지났는지 판단하는 순서 인덱스 */
  const stepOrder: AnalyzeStep[] = [
    "select-a",
    "select-b",
    "ready",
    "analyzing",
    "result",
  ];
  const currentIndex = stepOrder.indexOf(step);

  return (
    <ol className="flex items-center gap-0">
      {steps.map(({ key, label }, i) => {
        const stepIndex = stepOrder.indexOf(key[0]);
        const isActive = key.includes(step);
        const isDone = currentIndex > stepOrder.indexOf(key[key.length - 1]);

        return (
          <li key={label} className="flex items-center">
            {/* 단계 원형 + 라벨 */}
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                  isActive && "border-brand bg-brand text-brand-foreground",
                  isDone && "border-brand bg-brand/20 text-brand",
                  !isActive &&
                    !isDone &&
                    "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isDone ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  "text-xs",
                  isActive && "font-semibold text-brand",
                  isDone && "text-brand",
                  !isActive && !isDone && "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>

            {/* 연결선 (마지막 제외) */}
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mx-2 mb-5 h-0.5 w-12 transition-colors sm:w-20",
                  currentIndex > stepIndex
                    ? "bg-brand/50"
                    : "bg-muted-foreground/20"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
