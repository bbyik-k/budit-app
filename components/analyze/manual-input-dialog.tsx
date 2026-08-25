"use client";

import { useState } from "react";
import {
  Braces,
  CheckCircle2,
  Link2,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { parseIngredientText } from "@/lib/ingredients/parse";
import type { SlotData } from "@/types/analyze";
import type { MatchedItem, MatchResponse } from "@/types/api";

interface ManualInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 대상 슬롯 레이블 */
  slotLabel: "A" | "B";
  /** 확인 콜백 */
  onConfirm: (slot: SlotData) => void;
}

/** 성분 직접 입력 다이얼로그 */
export default function ManualInputDialog({
  open,
  onOpenChange,
  slotLabel,
  onConfirm,
}: ManualInputDialogProps) {
  const [inputText, setInputText] = useState("");
  const [matchResult, setMatchResult] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** 전성분 텍스트 파싱 (괄호 깊이·@ 구분자·대괄호 노이즈 처리 포함) */
  const parsedIngredients = parseIngredientText(inputText);

  /** 미리보기 상태 전부 초기화 */
  const resetPreview = () => {
    setMatchResult(null);
    setLoading(false);
    setErrorMsg(null);
  };

  /** 다이얼로그 닫힐 때 내부 상태 초기화 (상시 마운트라 A→B 전환 시 누수 방지) */
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setInputText("");
      resetPreview();
    }
    onOpenChange(nextOpen);
  };

  /** '성분 확인' — 매칭 API 호출 */
  const handlePreview = async () => {
    if (parsedIngredients.length === 0) return;
    setLoading(true);
    setErrorMsg(null);
    setMatchResult(null);

    try {
      const res = await fetch("/api/ingredients/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: parsedIngredients }),
      });

      if (!res.ok) {
        // 500 시 Next가 HTML을 반환할 수 있어 json() 파싱도 보호한다
        let message = "성분 확인 중 오류가 발생했습니다";
        try {
          const body = await res.json();
          message = body?.error?.message ?? message;
        } catch {
          // 파싱 실패 시 기본 문구 유지
        }
        setErrorMsg(message);
        return;
      }

      const body: MatchResponse = await res.json();
      setMatchResult(body);
    } catch {
      setErrorMsg("성분 확인 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  /** '분석에 사용' — 슬롯에 반영 후 닫기 (원문 전체 전달) */
  const handleConfirm = () => {
    onConfirm({
      type: "manual",
      productName: "직접 입력",
      ingredients: parsedIngredients,
    });
    handleOpenChange(false);
  };

  // 응답 기준 5분류
  const byType = (t: MatchedItem["match_type"]) =>
    matchResult?.matched.filter((m) => m.match_type === t) ?? [];
  const exactItems = byType("exact");
  const nospaceItems = byType("exact_nospace");
  const aliasItems = byType("alias");
  const fuzzyItems = byType("fuzzy");
  const unmatchedItems = matchResult?.unmatched ?? [];
  const totalCount = (matchResult?.matched.length ?? 0) + unmatchedItems.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            제품 <span className="text-brand">{slotLabel}</span> — 성분 직접
            입력
          </DialogTitle>
          <DialogDescription>
            성분명을 쉼표(,)로 구분하여 입력하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 성분 입력 영역 */}
          <Textarea
            placeholder="예: 레티놀, 나이아신아마이드, 히알루론산, 세라마이드"
            value={inputText}
            disabled={loading}
            onChange={(e) => {
              setInputText(e.target.value);
              /* 텍스트 변경 시 미리보기 초기화 */
              resetPreview();
            }}
            className="min-h-24 resize-none"
          />

          {/* 파싱된 성분 수 표시 — 미리보기 후에는 응답 기준 합계 */}
          {parsedIngredients.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {matchResult ? totalCount : parsedIngredients.length}개 성분
              인식됨
            </p>
          )}

          {/* 오류 표시 */}
          {errorMsg && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-destructive">
              {errorMsg}
            </div>
          )}

          {/* 매칭 미리보기 — 4분류 */}
          {matchResult && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              {/* 정확 일치 */}
              {exactItems.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-medium text-safe">
                    <CheckCircle2 size={14} />
                    정확 일치 ({exactItems.length})
                  </div>
                  <div className="flex flex-wrap gap-1 pl-5">
                    {exactItems.map((m, i) => (
                      <span
                        key={`exact-${i}`}
                        className="rounded-full bg-safe/10 px-2 py-0.5 text-xs text-safe"
                      >
                        {m.ingredient_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 공백 무시 일치 */}
              {nospaceItems.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-medium text-safe">
                    <Braces size={14} />
                    공백 무시 일치 ({nospaceItems.length})
                  </div>
                  <div className="flex flex-wrap gap-1 pl-5">
                    {nospaceItems.map((m, i) => (
                      <span
                        key={`nospace-${i}`}
                        className="rounded-full bg-safe/10 px-2 py-0.5 text-xs text-safe"
                      >
                        {m.raw_name} → {m.ingredient_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 별칭 일치 */}
              {aliasItems.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-medium text-safe">
                    <Link2 size={14} />
                    별칭 일치 ({aliasItems.length})
                  </div>
                  <div className="flex flex-wrap gap-1 pl-5">
                    {aliasItems.map((m, i) => (
                      <span
                        key={`alias-${i}`}
                        className="rounded-full bg-safe/10 px-2 py-0.5 text-xs text-safe"
                      >
                        {m.raw_name} → {m.ingredient_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 유사 일치 */}
              {fuzzyItems.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-medium text-caution">
                    <Sparkles size={14} />
                    유사 일치 ({fuzzyItems.length})
                  </div>
                  <div className="flex flex-wrap gap-1 pl-5">
                    {fuzzyItems.map((m, i) => (
                      <span
                        key={`fuzzy-${i}`}
                        className="rounded-full bg-caution/10 px-2 py-0.5 text-xs text-caution"
                      >
                        {m.raw_name} → {m.ingredient_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 미매칭 성분 */}
              {unmatchedItems.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    <XCircle size={14} />
                    미매칭 ({unmatchedItems.length}) — 분석에서 제외됩니다
                  </div>
                  <div className="flex flex-wrap gap-1 pl-5">
                    {unmatchedItems.map((name, i) => (
                      <span
                        key={`unmatched-${i}`}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 버튼 영역 */}
          <div className="flex justify-end gap-2 pt-1">
            {/* 미리보기 전: '성분 확인' / 미리보기 후: '분석에 사용' */}
            {!matchResult ? (
              <Button
                onClick={handlePreview}
                disabled={parsedIngredients.length === 0 || loading}
                className="bg-brand text-brand-foreground hover:bg-brand/90"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                성분 확인
              </Button>
            ) : (
              <Button
                onClick={handleConfirm}
                className="bg-brand text-brand-foreground hover:bg-brand/90"
              >
                분석에 사용
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
