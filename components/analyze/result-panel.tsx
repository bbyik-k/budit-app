import { ShieldCheck, AlertTriangle, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConflictCard from "@/components/analyze/conflict-card";
import type { AnalyzeResult } from "@/types/analyze";

interface ResultPanelProps {
  result: AnalyzeResult;
  /** 슬롯 A 제품명 */
  slotAName: string;
  /** 슬롯 B 제품명 */
  slotBName: string;
  /** 돌아가기 → RESET 액션 */
  onReset: () => void;
}

/** 분석 결과 패널 — 충돌/시너지 목록과 루틴 분리 권장사항 표시 */
export default function ResultPanel({
  result,
  slotAName,
  slotBName,
  onReset,
}: ResultPanelProps) {
  const hasConflicts = result.conflicts.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ── 결과 헤더 ── */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-muted-foreground">분석 완료</p>
            <h2 className="text-base font-semibold">
              <span className="text-brand">{slotAName}</span>
              <span className="mx-2 text-muted-foreground">×</span>
              <span className="text-brand">{slotBName}</span>
            </h2>
          </div>

          {/* 결과 요약 뱃지 */}
          {hasConflicts ? (
            <div className="flex items-center gap-1.5 rounded-full border border-conflict/30 bg-conflict/10 px-3 py-1 text-sm font-medium text-conflict">
              <AlertTriangle size={14} />
              충돌 {result.conflicts.length}건
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full border border-safe/30 bg-safe/10 px-3 py-1 text-sm font-medium text-safe">
              <ShieldCheck size={14} />
              안전한 조합
            </div>
          )}
        </div>
      </div>

      {/* ── 충돌 있음 ── */}
      {hasConflicts && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-conflict" />
            <h3 className="font-semibold">충돌 성분</h3>
          </div>
          <div className="flex flex-col gap-3">
            {result.conflicts.map((conflict, i) => (
              <ConflictCard key={i} conflict={conflict} />
            ))}
          </div>

          {/* 루틴 분리 권장사항 */}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="mb-1 text-sm font-semibold">루틴 분리 권장</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              위 성분들은 함께 사용 시 효과가 저하되거나 피부 자극을 유발할 수
              있습니다. 아침/저녁 또는 격일로 분리하여 사용하는 것을 권장합니다.
            </p>
          </div>
        </section>
      )}

      {/* ── 충돌 없음: 안전 메시지 ── */}
      {!hasConflicts && (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-safe/30 bg-safe/5 p-8 text-center">
          <ShieldCheck size={40} className="text-safe" />
          <div>
            <p className="font-semibold text-safe">안전한 조합입니다!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              두 제품 간 충돌 성분이 발견되지 않았습니다.
            </p>
          </div>
        </section>
      )}

      {/* ── 시너지 ── */}
      {result.synergies.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-safe" />
            <h3 className="font-semibold">시너지 성분</h3>
          </div>
          <div className="flex flex-col gap-2">
            {result.synergies.map((synergy, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 rounded-lg border border-safe/20 bg-safe/5 p-3"
              >
                <p className="text-sm font-medium">
                  <span className="text-safe">{synergy.ingredientA}</span>
                  <span className="mx-2 text-muted-foreground">+</span>
                  <span className="text-safe">{synergy.ingredientB}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {synergy.reasonKo}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 돌아가기 버튼 ── */}
      <div className="flex justify-center pt-2">
        <Button variant="outline" onClick={onReset} className="gap-2">
          <RotateCcw size={15} />
          다시 분석하기
        </Button>
      </div>
    </div>
  );
}
