"use client";

import { useReducer, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, FlaskConical, Loader2 } from "lucide-react";
import type {
  AnalyzeState,
  AnalyzeAction,
  AnalyzeResult,
  SlotData,
} from "@/types/analyze";
import StepIndicator from "@/components/analyze/step-indicator";
import ProductSearch from "@/components/analyze/product-search";
import ResultPanel from "@/components/analyze/result-panel";

// ---------------------------------------------------------------------------
// 초기 상태
// ---------------------------------------------------------------------------
const initialState: AnalyzeState = {
  step: "select-a",
  slotA: null,
  slotB: null,
  result: null,
};

// ---------------------------------------------------------------------------
// 더미 분석 결과 (Phase 1 목업용 — API 연동 전 하드코딩)
// ---------------------------------------------------------------------------
const DUMMY_RESULT: AnalyzeResult = {
  conflicts: [
    {
      ingredientA: "레티놀",
      ingredientB: "비타민C",
      conflictType: "avoid",
      severity: "high",
      reasonKo:
        "레티놀과 비타민C(아스코르브산)는 산성 환경에서 레티놀 분해를 촉진합니다.",
      recommend: "아침(비타민C) / 저녁(레티놀)으로 분리 사용 권장",
    },
    {
      ingredientA: "레티놀 계열",
      ingredientB: "AHA 계열",
      conflictType: "avoid",
      severity: "high",
      reasonKo:
        "AHA의 낮은 pH가 레티놀을 불안정하게 만들어 피부 자극을 유발합니다.",
      recommend: "레티놀은 저녁, AHA는 다른 날 저녁 사용",
    },
  ],
  synergies: [
    {
      ingredientA: "히알루론산",
      ingredientB: "세라마이드",
      reasonKo:
        "수분 공급(히알루론산)과 장벽 강화(세라마이드)의 시너지 보습 효과",
    },
  ],
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
function analyzeReducer(
  state: AnalyzeState,
  action: AnalyzeAction
): AnalyzeState {
  switch (action.type) {
    case "SELECT_SLOT_A":
      return { ...state, slotA: action.payload, step: "select-b" };
    case "SELECT_SLOT_B":
      return { ...state, slotB: action.payload, step: "ready" };
    case "START_ANALYZE":
      return { ...state, step: "analyzing" };
    case "SET_RESULT":
      return { ...state, result: action.payload, step: "result" };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// 선택된 슬롯 뱃지 컴포넌트
// ---------------------------------------------------------------------------
function SlotBadge({
  slot,
  label,
  onClear,
}: {
  slot: SlotData;
  label: "A" | "B";
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-muted-foreground">
        제품 <span className="font-bold text-brand">{label}</span>
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2">
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-semibold">{slot.productName}</span>
          <span className="text-xs text-muted-foreground">{slot.brand}</span>
        </div>
        <button
          onClick={onClear}
          className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="선택 취소"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnalyzeContainer (클라이언트 상태 관리 최상위)
// ---------------------------------------------------------------------------
export default function AnalyzeContainer() {
  const [state, dispatch] = useReducer(analyzeReducer, initialState);
  /** 직접 입력 다이얼로그 대상 슬롯 (Task 7에서 ManualInputDialog와 연결 예정) */
  const [, setDialogSlot] = useState<"A" | "B" | null>(null);

  /** 분석 시작: 1.5초 후 더미 결과로 전환 */
  const handleAnalyze = useCallback(() => {
    dispatch({ type: "START_ANALYZE" });
    setTimeout(() => {
      dispatch({ type: "SET_RESULT", payload: DUMMY_RESULT });
    }, 1500);
  }, []);

  /** 슬롯 A 선택 해제 → select-a 상태로 복귀 */
  const handleClearSlotA = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  /** 슬롯 B 선택 해제 → select-b 상태로 복귀 */
  const handleClearSlotB = useCallback(() => {
    dispatch({ type: "SELECT_SLOT_A", payload: state.slotA! });
  }, [state.slotA]);

  return (
    <div className="flex flex-col gap-8">
      {/* 단계 표시 */}
      <div className="flex justify-center">
        <StepIndicator step={state.step} />
      </div>

      {/* ── 검색/선택 영역 ── */}
      {(state.step === "select-a" ||
        state.step === "select-b" ||
        state.step === "ready") && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            {/* 슬롯 A */}
            <div className="flex-1">
              {state.slotA ? (
                <SlotBadge
                  slot={state.slotA}
                  label="A"
                  onClear={handleClearSlotA}
                />
              ) : (
                <ProductSearch
                  slotLabel="A"
                  onSelect={(slot) =>
                    dispatch({ type: "SELECT_SLOT_A", payload: slot })
                  }
                  onManualInput={() => setDialogSlot("A")}
                />
              )}
            </div>

            {/* 구분 텍스트 */}
            <div className="flex items-center justify-center sm:pt-7">
              <span className="text-sm font-medium text-muted-foreground">
                VS
              </span>
            </div>

            {/* 슬롯 B */}
            <div className="flex-1">
              {state.slotB ? (
                <SlotBadge
                  slot={state.slotB}
                  label="B"
                  onClear={handleClearSlotB}
                />
              ) : state.step === "select-b" || state.step === "ready" ? (
                <ProductSearch
                  slotLabel="B"
                  onSelect={(slot) =>
                    dispatch({ type: "SELECT_SLOT_B", payload: slot })
                  }
                  onManualInput={() => setDialogSlot("B")}
                />
              ) : (
                /* 슬롯 A 미선택 상태에서 슬롯 B는 비활성 플레이스홀더 */
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium text-muted-foreground">
                    제품{" "}
                    <span className="font-bold text-muted-foreground">B</span>
                  </p>
                  <div className="flex h-10 items-center rounded-lg border border-dashed border-border px-3">
                    <span className="text-sm text-muted-foreground/50">
                      제품 A를 먼저 선택하세요
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 분석 버튼 (ready 상태) */}
          {state.step === "ready" && (
            <div className="mt-6 flex justify-center border-t border-border pt-5">
              <Button
                onClick={handleAnalyze}
                size="lg"
                className="gap-2 bg-brand px-8 text-brand-foreground hover:bg-brand/90"
              >
                <FlaskConical size={18} />
                성분 충돌 분석
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── 분석 중 ── */}
      {state.step === "analyzing" && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-12">
          <Loader2 size={32} className="animate-spin text-brand" />
          <p className="text-sm font-medium text-muted-foreground">
            성분 충돌을 분석하는 중입니다...
          </p>
        </div>
      )}

      {/* ── 결과 화면 ── */}
      {state.step === "result" && state.result && (
        <ResultPanel
          result={state.result}
          slotAName={state.slotA?.productName ?? "제품 A"}
          slotBName={state.slotB?.productName ?? "제품 B"}
          onReset={() => dispatch({ type: "RESET" })}
        />
      )}
    </div>
  );
}
