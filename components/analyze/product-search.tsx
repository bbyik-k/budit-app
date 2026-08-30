"use client";

import { useEffect, useRef, useState } from "react";
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

  // 검색어 입력 전 기본 노출용 인기 제품 (서브카테고리별 최상위 랭크 18건)
  const [featured, setFeatured] = useState<ProductSearchItem[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  // 팝오버를 여러 번 열어도 요청은 1회만 나가게 하는 플래그
  const featuredRequested = useRef(false);

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

  // 인기 제품 목록 로드
  // 마운트가 아니라 팝오버 첫 오픈 시 부른다. 마운트 시점에 부르면 슬롯 A/B
  // 두 인스턴스가 페이지 로드마다 요청을 보내게 된다.
  const loadFeatured = async () => {
    if (featuredRequested.current) return;
    featuredRequested.current = true;
    setFeaturedLoading(true);

    try {
      const res = await fetch("/api/products/featured");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body: ProductSearchResponse = await res.json();
      setFeatured(body.items ?? []);
    } catch {
      // 기본 목록은 실패해도 에러 문구를 띄우지 않는다. 검색 기능 자체는
      // 그대로 동작해 사용자가 취할 조치가 없기 때문이다.
      // 다음 오픈 때 재시도할 수 있도록 플래그만 되돌린다.
      featuredRequested.current = false;
      setFeatured([]);
    } finally {
      setFeaturedLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);

    if (next) {
      void loadFeatured();
      return;
    }

    // 팝오버 닫힘 시 검색 상태만 초기화한다. featured는 캐시로 유지한다.
    setQuery("");
    setItems([]);
    setLoading(false);
    setErrorMsg(null);
  };

  const isSearching = query.trim().length > 0;

  // 인기 제품과 검색 결과가 동일한 마크업을 쓰므로 렌더를 공유한다
  const renderItem = (product: ProductSearchItem) => (
    <CommandItem
      key={product.id}
      value={product.id}
      onSelect={() => handleSelect(product)}
      className="flex items-center gap-2"
    >
      <Check size={14} className="opacity-0" />
      <div className="flex flex-col">
        <span className="text-sm font-medium">{product.name}</span>
        <span className="text-xs text-muted-foreground">{product.brand}</span>
      </div>
    </CommandItem>
  );

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
                {/* 검색어 입력 전 — 인기 제품 기본 노출 */}
                {!isSearching && featuredLoading && (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    불러오는 중...
                  </div>
                )}

                {!isSearching && !featuredLoading && featured.length > 0 && (
                  <CommandGroup heading="인기 제품">
                    {featured.map(renderItem)}
                  </CommandGroup>
                )}

                {/* 검색 중 */}
                {isSearching && loading && (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    검색 중...
                  </div>
                )}

                {isSearching && !loading && errorMsg && (
                  <div className="py-6 text-center text-sm text-destructive">
                    {errorMsg}
                  </div>
                )}

                {/* shouldFilter={false}에서는 CommandEmpty가 빈 쿼리에도 뜨므로 조건부 렌더 */}
                {isSearching && !loading && !errorMsg && items.length === 0 && (
                  <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                )}

                {isSearching && items.length > 0 && (
                  <CommandGroup>{items.map(renderItem)}</CommandGroup>
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
