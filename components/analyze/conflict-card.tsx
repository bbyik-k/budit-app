import { AlertTriangle, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ConflictResult } from "@/types/analyze";

interface ConflictCardProps {
  conflict: ConflictResult;
}

/** severity별 스타일 매핑 */
const severityStyle: Record<
  ConflictResult["severity"],
  { card: string; badge: string; icon: string; label: string }
> = {
  high: {
    card: "border-conflict/40 bg-conflict/5",
    badge: "bg-conflict/10 text-conflict border-conflict/30",
    icon: "text-conflict",
    label: "주의 필요",
  },
  medium: {
    card: "border-caution/40 bg-caution/5",
    badge: "bg-caution/10 text-caution border-caution/30",
    icon: "text-caution",
    label: "주의",
  },
  low: {
    card: "border-caution/20 bg-caution/5",
    badge: "bg-caution/5 text-caution border-caution/20",
    icon: "text-caution",
    label: "경미",
  },
};

/** 충돌 심각도 카드 컴포넌트 */
export default function ConflictCard({ conflict }: ConflictCardProps) {
  const style = severityStyle[conflict.severity];
  const Icon = conflict.severity === "high" ? AlertTriangle : AlertCircle;

  return (
    <Card className={cn("border", style.card)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* 아이콘 */}
          <Icon size={18} className={cn("mt-0.5 shrink-0", style.icon)} />

          <div className="flex flex-1 flex-col gap-2">
            {/* 헤더: 성분명 + severity 뱃지 */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">
                {conflict.ingredientA}
              </span>
              <span className="text-xs text-muted-foreground">+</span>
              <span className="font-semibold text-foreground">
                {conflict.ingredientB}
              </span>
              <span
                className={cn(
                  "ml-auto rounded-full border px-2 py-0.5 text-xs font-medium",
                  style.badge
                )}
              >
                {conflict.conflictType === "avoid" ? "사용 금지" : "주의"} ·{" "}
                {style.label}
              </span>
            </div>

            {/* 충돌 이유 */}
            <p className="text-sm leading-relaxed text-muted-foreground">
              {conflict.reasonKo}
            </p>

            {/* 권장사항 */}
            {conflict.recommend && (
              <p className="rounded-md bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                💡 {conflict.recommend}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
