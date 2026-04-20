"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SlotData } from "@/types/analyze";

// ---------------------------------------------------------------------------
// 더미 제품 데이터 (Phase 1 목업 — 실제 DB UUID 사용)
// ---------------------------------------------------------------------------
const DUMMY_PRODUCTS = [
  {
    id: "da2a4905-43c3-4829-b9e7-cecb126cf0df",
    name: "토리든 다이브인 세럼",
    brand: "토리든",
  },
  {
    id: "16f71e35-6f26-43f2-a39c-87098dff14f5",
    name: "이니스프리 레티놀 앰플",
    brand: "이니스프리",
  },
  {
    id: "dde5397d-90f7-4bdc-8fea-034f88cf41ad",
    name: "에스트라 아토베리어365 크림",
    brand: "에스트라",
  },
  {
    id: "6fe4f229-db32-4f7f-a86a-06fcaae5f96b",
    name: "메디힐 에센셜 마스크팩 (마데카소사이드)",
    brand: "메디힐",
  },
  {
    id: "8393e1e3-d9db-4e71-947e-a3e0eab9a9ef",
    name: "메디힐 더마 패드 (마데카소사이드)",
    brand: "메디힐",
  },
  {
    id: "274f3174-259e-4dce-8133-ec45a98e1ae5",
    name: "메노킨 퀵 버블 마스크 (리프트)",
    brand: "메노킨",
  },
];

interface ProductSearchProps {
  /** 슬롯 구분 레이블 */
  slotLabel: "A" | "B";
  /** 제품 선택 완료 콜백 */
  onSelect: (slot: SlotData) => void;
  /** 직접 입력 버튼 클릭 콜백 */
  onManualInput: () => void;
}

export default function ProductSearch({
  slotLabel,
  onSelect,
  onManualInput,
}: ProductSearchProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (product: (typeof DUMMY_PRODUCTS)[number]) => {
    onSelect({
      type: "product",
      productId: product.id,
      productName: product.name,
      brand: product.brand,
    });
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 슬롯 레이블 */}
      <p className="text-sm font-medium text-muted-foreground">
        제품 <span className="font-bold text-brand">{slotLabel}</span> 선택
      </p>

      <div className="flex items-center gap-2">
        {/* 제품 검색 Popover + Command */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full max-w-sm justify-between"
            >
              <span className="text-muted-foreground">
                제품명으로 검색하세요
              </span>
              <ChevronsUpDown
                size={16}
                className="shrink-0 text-muted-foreground"
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-sm p-0" align="start">
            <Command>
              <CommandInput placeholder="제품명 또는 브랜드 검색..." />
              <CommandList>
                <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                <CommandGroup>
                  {DUMMY_PRODUCTS.map((product) => (
                    <CommandItem
                      key={product.id}
                      value={`${product.name} ${product.brand}`}
                      onSelect={() => handleSelect(product)}
                      className="flex items-center gap-2"
                    >
                      <Check size={14} className="opacity-0" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {product.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {product.brand}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* 직접 입력 버튼 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onManualInput}
          className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Pencil size={14} />
          직접 입력
        </Button>
      </div>
    </div>
  );
}
