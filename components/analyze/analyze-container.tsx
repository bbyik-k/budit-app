"use client";

import { useReducer, useCallback, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  X,
  FlaskConical,
  Loader2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import type {
  AnalyzeState,
  AnalyzeAction,
  AnalyzeResult,
  SlotData,
} from "@/types/analyze";
import StepIndicator from "@/components/analyze/step-indicator";
import ProductSearch from "@/components/analyze/product-search";
import ResultPanel from "@/components/analyze/result-panel";
import ManualInputDialog from "@/components/analyze/manual-input-dialog";

// ---------------------------------------------------------------------------
// 초기 상태
// ---------------------------------------------------------------------------
const initialState: AnalyzeState = {
  step: "select-a",
  slotA: null,
  slotB: null,
  result: null,
  error: null,
};

// ---------------------------------------------------------------------------
// Reducer — 전이표 기반. 허용되지 않는 (step, action) 조합은 state를 그대로 반환한다.
//
// | action        | 허용 from step   | to step   | 상태 변경                   |
// | SELECT_SLOT_A | select-a         | select-b  | slotA = payload             |
// | SELECT_SLOT_B | select-b         | ready     | slotB = payload             |
// | CLEAR_SLOT_B  | ready            | select-b  | slotB = null                |
// | START_ANALYZE | ready, error     | analyzing | error = null, result = null |
// | SET_RESULT    | analyzing        | result    | result = payload            |
// | SET_ERROR     | analyzing        | error     | error = payload             |
// | RESET         | 모든 step        | select-a  | initialState                |
// ---------------------------------------------------------------------------
function analyzeReducer(
  state: AnalyzeState,
  action: AnalyzeAction
): AnalyzeState {
  switch (action.type) {
    case "SELECT_SLOT_A":
      if (state.step !== "select-a") return state;
      return { ...state, slotA: action.payload, step: "select-b" };
    case "SELECT_SLOT_B":
      if (state.step !== "select-b") return state;
      return { ...state, slotB: action.payload, step: "ready" };
    case "CLEAR_SLOT_B":
      if (state.step !== "ready") return state;
      return { ...state, slotB: null, step: "select-b" };
    case "START_ANALYZE":
      if (state.step !== "ready" && state.step !== "error") return state;
      return { ...state, step: "analyzing", error: null, result: null };
    case "SET_RESULT":
      if (state.step !== "analyzing") return state;
      return { ...state, result: action.payload, step: "result" };
    case "SET_ERROR":
      if (state.step !== "analyzing") return state;
      return { ...state, error: action.payload, step: "error" };
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

  /** 로고 클릭 시 발생하는 budit:reset 이벤트 수신 → 상태 초기화 */
  useEffect(() => {
    const handleReset = () => dispatch({ type: "RESET" });
    window.addEventListener("budit:reset", handleReset);
    return () => window.removeEventListener("budit:reset", handleReset);
  }, []);

  /** 직접 입력 다이얼로그 열림 여부 */
  const [dialogOpen, setDialogOpen] = useState(false);
  /** 직접 입력 다이얼로그 대상 슬롯 */
  const [dialogTargetSlot, setDialogTargetSlot] = useState<"A" | "B">("A");

  /** 분석 시작: /api/analyze API 호출 */
  const handleAnalyze = useCallback(async () => {
    if (!state.slotA || !state.slotB) return;
    dispatch({ type: "START_ANALYZE" });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotA: state.slotA, slotB: state.slotB }),
      });
      if (!res.ok) {
        console.error("[handleAnalyze] API error:", res.status);
        // 서버 에러 바디 { error: { code, message } } 파싱 — 실패 시 기본 문구
        let payload = { message: "분석 중 오류가 발생했습니다" } as {
          code?: string;
          message: string;
        };
        try {
          const body = await res.json();
          if (body?.error?.message) {
            payload = { code: body.error.code, message: body.error.message };
          }
        } catch {
          // 500 시 HTML이 올 수 있어 파싱 실패는 무시하고 기본 문구 사용
        }
        dispatch({ type: "SET_ERROR", payload });
        return;
      }
      const payload: AnalyzeResult = await res.json();
      dispatch({ type: "SET_RESULT", payload });
    } catch (err) {
      console.error("[handleAnalyze] fetch error:", err);
      dispatch({
        type: "SET_ERROR",
        payload: { message: "네트워크 오류로 분석에 실패했습니다" },
      });
    }
  }, [state.slotA, state.slotB]);

  /** 슬롯 A 선택 해제 → select-a 상태로 복귀 */
  const handleClearSlotA = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  /** 슬롯 B 선택 해제 → select-b 상태로 복귀 */
  const handleClearSlotB = useCallback(() => {
    dispatch({ type: "CLEAR_SLOT_B" });
  }, []);

  /** 직접 입력 다이얼로그 열기 */
  const handleOpenManualInput = useCallback((slot: "A" | "B") => {
    setDialogTargetSlot(slot);
    setDialogOpen(true);
  }, []);

  /** 직접 입력 확인 — 대상 슬롯에 반영 */
  const handleManualConfirm = useCallback(
    (slot: SlotData) => {
      if (dialogTargetSlot === "A") {
        dispatch({ type: "SELECT_SLOT_A", payload: slot });
      } else {
        dispatch({ type: "SELECT_SLOT_B", payload: slot });
      }
    },
    [dialogTargetSlot]
  );

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
                  onManualInput={() => handleOpenManualInput("A")}
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
                  onManualInput={() => handleOpenManualInput("B")}
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

      {/* ── 분석 실패 ── */}
      {state.step === "error" && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-destructive/40 bg-card p-10 text-center">
          <AlertTriangle size={32} className="text-destructive" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-destructive">
              분석에 실패했습니다
            </p>
            <p className="text-sm text-muted-foreground">
              {state.error?.message ?? "알 수 없는 오류가 발생했습니다"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleAnalyze}
              className="gap-2 bg-brand text-brand-foreground hover:bg-brand/90"
            >
              <RotateCcw size={16} />
              재시도
            </Button>
            <Button
              variant="outline"
              onClick={() => dispatch({ type: "RESET" })}
            >
              처음부터
            </Button>
          </div>
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

      {/* ── 성분 직접 입력 다이얼로그 ── */}
      <ManualInputDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        slotLabel={dialogTargetSlot}
        onConfirm={handleManualConfirm}
      />
    </div>
  );
}
