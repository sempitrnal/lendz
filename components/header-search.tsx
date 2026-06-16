"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { isDarkColor } from "@/lib/utils";
import { useBorrowersSearch } from "@/hooks/use-borrowers-search";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";

interface HeaderSearchProps {
  className?: string;
}

export default function HeaderSearch({ className }: HeaderSearchProps) {
  const router = useRouter();
  const { data: borrowers = [] } = useBorrowersSearch();

  const [input, setInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(input);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const suggestions = useMemo<BorrowerSearchItem[]>(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return [];
    return borrowers
      .filter(
        (b) =>
          b.first_name.toLowerCase().includes(q) ||
          b.last_name.toLowerCase().includes(q) ||
          `${b.first_name} ${b.last_name}`.toLowerCase().includes(q) ||
          (b.contact ?? "").toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [borrowers, debouncedQuery]);

  function navigate(borrower: BorrowerSearchItem) {
    setShowSuggestions(false);
    setInput("");
    setDebouncedQuery("");
    router.push(`/borrowers/${borrower.id}`);
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full sm:max-w-md md:max-w-lg lg:max-w-xl
        ${className ?? ""}`}
    >
      <div className="relative flex items-center">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-3
            size-4"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          value={input}
          onChange={(e) => {
            const v = e.target.value;
            setInput(v);
            setShowSuggestions(v.trim().length > 0);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (input.trim()) setShowSuggestions(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowSuggestions(false);
              inputRef.current?.blur();
              return;
            }
            if (!showSuggestions || suggestions.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((p) => Math.min(p + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((p) => Math.max(p - 1, -1));
            } else if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              navigate(suggestions[activeIndex]);
            }
          }}
          placeholder="Search borrowers…"
          autoComplete="off"
          aria-label="Search borrowers"
          aria-autocomplete="list"
          aria-expanded={showSuggestions && suggestions.length > 0}
          className="dark:border-border dark:bg-card dark:text-foreground
            dark:placeholder:text-muted-foreground h-9 w-full rounded-lg border
            border-slate-900/30 bg-white py-2 pr-3 pl-9 text-sm text-slate-900
            outline-none placeholder:text-slate-400 transition
            focus:border-slate-900
            focus:shadow-[3px_3px_0px_0px_rgb(15_23_42/0.15)]
            dark:focus:border-border"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div
          role="listbox"
          className="dark:border-border dark:bg-card absolute top-full right-0
            left-0 z-50 mt-1 overflow-hidden rounded-xl border-2
            border-slate-900 bg-white
            shadow-[3px_3px_0px_0px_rgb(15_23_42/0.85)]
            dark:shadow-[3px_3px_0px_0px_rgb(0_0_0/0.5)]"
        >
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                navigate(s);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`dark:border-border/50 flex w-full items-center
              justify-between gap-3 border-b border-slate-100 px-3 py-2.5
              text-left transition-colors last:border-b-0 ${
                i === activeIndex
                  ? "dark:bg-muted bg-slate-100"
                  : "dark:bg-card bg-white"
              }`}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className="dark:text-foreground truncate text-sm font-black
                    text-slate-900 uppercase"
                >
                  {s.first_name} {s.last_name}
                </span>
                {s.borrower_categories?.[0]?.category[0] && (
                  <span
                    className="flex w-fit items-center gap-1 rounded-full border
                      border-slate-900/10 bg-slate-100 px-2 py-0.5 text-[10px]
                      font-semibold text-slate-600 capitalize
                      dark:border-white/10 dark:bg-slate-800
                      dark:text-slate-300"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          s.borrower_categories[0].category[0].color ??
                          "#cbd5e1",
                      }}
                    />
                    {s.borrower_categories[0].category[0].name}
                  </span>
                )}
              </span>
              {s.contact && (
                <span
                  className="dark:text-muted-foreground shrink-0 text-[10px]
                    text-slate-400 tabular-nums"
                >
                  {s.contact}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
