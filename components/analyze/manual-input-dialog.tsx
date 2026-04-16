"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { SlotData } from "@/types/analyze";

// ---------------------------------------------------------------------------
// 더미 매칭 DB (Phase 1 목업 — API 연동 전 하드코딩)
// ---------------------------------------------------------------------------
const KNOWN_INGREDIENTS = new Set([
  "레티놀",
  "비타민c",
  "비타민C",
  "나이아신아마이드",
  "AHA",
  "BHA",
  "글리콜산",
]);

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
  const [matchPreview, setMatchPreview] = useState(false);

  /** 쉼표 기준 파싱 */
  const parsedIngredients = inputText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  /** 더미 매칭 분류 */
  const matched = parsedIngredients.filter((ing) => KNOWN_INGREDIENTS.has(ing));
  const unmatched = parsedIngredients.filter(
    (ing) => !KNOWN_INGREDIENTS.has(ing)
  );

  /** 다이얼로그 닫힐 때 내부 상태 초기화 */
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setInputText("");
      setMatchPreview(false);
    }
    onOpenChange(nextOpen);
  };

  /** '성분 확인' — 미리보기 상태로 전환 */
  const handlePreview = () => {
    if (parsedIngredients.length === 0) return;
    setMatchPreview(true);
  };

  /** '분석에 사용' — 슬롯에 반영 후 닫기 */
  const handleConfirm = () => {
    onConfirm({
      type: "manual",
      productName: "직접 입력",
      ingredients: parsedIngredients,
    });
    handleOpenChange(false);
  };

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
            onChange={(e) => {
              setInputText(e.target.value);
              /* 텍스트 변경 시 미리보기 초기화 */
              setMatchPreview(false);
            }}
            className="min-h-24 resize-none"
          />

          {/* 파싱된 성분 수 표시 */}
          {parsedIngredients.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {parsedIngredients.length}개 성분 인식됨
            </p>
          )}

          {/* 매칭 미리보기 */}
          {matchPreview && parsedIngredients.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              {/* DB 매칭 성공 */}
              {matched.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-medium text-safe">
                    <CheckCircle2 size={14} />
                    DB 매칭 성공 ({matched.length})
                  </div>
                  <div className="flex flex-wrap gap-1 pl-5">
                    {matched.map((ing) => (
                      <span
                        key={ing}
                        className="rounded-full bg-safe/10 px-2 py-0.5 text-xs text-safe"
                      >
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 미매칭 성분 */}
              {unmatched.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    <XCircle size={14} />
                    미매칭 ({unmatched.length}) — 분석에는 포함됩니다
                  </div>
                  <div className="flex flex-wrap gap-1 pl-5">
                    {unmatched.map((ing) => (
                      <span
                        key={ing}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {ing}
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
            {!matchPreview ? (
              <Button
                onClick={handlePreview}
                disabled={parsedIngredients.length === 0}
                className="bg-brand text-brand-foreground hover:bg-brand/90"
              >
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
