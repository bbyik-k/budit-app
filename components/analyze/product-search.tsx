"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Pencil } from "lucide-react";
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
import type { ProductSearchItem, ProductSearchResponse } from "@/types/api";

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
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ProductSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 250ms 디바운스 + AbortController로 이전 요청 취소 (응답 역전 방지)
  useEffect(() => {
    const trimmed = query.trim();

    // 빈 쿼리는 서버가 400을 반환하므로 fetch 자체를 건너뛴다
    if (!trimmed) {
      setItems([]);
      setLoading(false);
      setErrorMsg(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setErrorMsg(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          // 500 시 Next가 HTML을 반환할 수 있어 json() 파싱도 보호한다
          let message = "검색 중 오류가 발생했습니다";
          try {
            const body = await res.json();
            message = body?.error?.message ?? message;
          } catch {
            // 파싱 실패 시 기본 문구 유지
          }
          setItems([]);
          setErrorMsg(message);
          return;
        }

        const body: ProductSearchResponse = await res.json();
        setItems(body.items ?? []);
      } catch (err) {
        // abort는 정상 취소이므로 에러로 표시하지 않는다
        if (err instanceof Error && err.name === "AbortError") return;
        setItems([]);
        setErrorMsg("검색 중 오류가 발생했습니다");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handleSelect = (product: ProductSearchItem) => {
    onSelect({
      type: "product",
      productId: product.id,
      productName: product.name,
      brand: product.brand,
    });
    setOpen(false);
  };

  // 팝오버 닫힘 시 검색 상태 초기화
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setItems([]);
      setLoading(false);
      setErrorMsg(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 슬롯 레이블 */}
      <p className="text-sm font-medium text-muted-foreground">
        제품 <span className="font-bold text-brand">{slotLabel}</span> 선택
      </p>

      <div className="flex items-center gap-2">
        {/* 제품 검색 Popover + Command */}
        <Popover open={open} onOpenChange={handleOpenChange}>
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
            {/* 서버 검색 결과를 cmdk가 재필터링하지 않도록 shouldFilter 해제 */}
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="제품명 또는 브랜드 검색..."
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                {loading && (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    검색 중...
                  </div>
                )}

                {!loading && errorMsg && (
                  <div className="py-6 text-center text-sm text-destructive">
                    {errorMsg}
                  </div>
                )}

                {/* shouldFilter={false}에서는 CommandEmpty가 빈 쿼리에도 뜨므로 조건부 렌더 */}
                {!loading &&
                  !errorMsg &&
                  query.trim() &&
                  items.length === 0 && (
                    <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                  )}

                {items.length > 0 && (
                  <CommandGroup>
                    {items.map((product) => (
                      <CommandItem
                        key={product.id}
                        value={product.id}
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
                )}
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
