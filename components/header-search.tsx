"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Search, X, XCircle } from "lucide-react";
import { useBorrowersSearch } from "@/hooks/use-borrowers-search";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";

const RECENT_KEY = "lendz:search-recent";

interface HeaderSearchProps {
  className?: string;
  onFocusChange?: (focused: boolean) => void;
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveRecent(id: string) {
  try {
    const current = loadRecent();
    const next = [id, ...current.filter((x) => x !== id)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export default function HeaderSearch({
  className,
  onFocusChange,
}: HeaderSearchProps) {
  const router = useRouter();
  const { data: borrowers = [] } = useBorrowersSearch();

  const [input, setInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRecentIds(loadRecent());
  }, []);

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

  const isQuery = debouncedQuery.trim().length > 0;

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

  const recents = useMemo<BorrowerSearchItem[]>(() => {
    const map = new Map(borrowers.map((b) => [b.id, b]));
    return recentIds
      .map((id) => map.get(id))
      .filter((b): b is BorrowerSearchItem => Boolean(b));
  }, [borrowers, recentIds]);

  const visibleItems = isQuery ? suggestions : recents;

  function navigate(borrower: BorrowerSearchItem) {
    saveRecent(borrower.id);
    setRecentIds((prev) =>
      [borrower.id, ...prev.filter((x) => x !== borrower.id)].slice(0, 5),
    );
    setShowSuggestions(false);
    setInput("");
    setDebouncedQuery("");
    inputRef.current?.blur();
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
          type="text"
          value={input}
          onChange={(e) => {
            const v = e.target.value;
            setInput(v);
            setShowSuggestions(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            setShowSuggestions(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            onFocusChange?.(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowSuggestions(false);
              inputRef.current?.blur();
              return;
            }
            if (!showSuggestions || visibleItems.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((p) => Math.min(p + 1, visibleItems.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((p) => Math.max(p - 1, -1));
            } else if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              navigate(visibleItems[activeIndex]);
            }
          }}
          placeholder="Search borrowers…"
          autoComplete="off"
          aria-label="Search borrowers"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          className="dark:border-border dark:bg-card dark:text-foreground
            dark:placeholder:text-muted-foreground h-9 w-full rounded-lg border
            border-slate-300 bg-white py-2 pr-14 pl-9 text-sm text-slate-600
            outline-none placeholder:text-slate-400 transition
            focus:border-slate-400 dark:focus:border-slate-500"
        />

        {/* Clear button */}
        {input.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setInput("");
              setDebouncedQuery("");
              inputRef.current?.focus();
            }}
            className={`dark:text-muted-foreground absolute top-1/2 z-10
            -translate-y-1/2 rounded-md p-1 text-slate-400 transition
            hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10
            dark:hover:text-foreground
            ${showSuggestions ? "right-8" : "right-2.5"}`}
            aria-label="Clear search"
          >
            <XCircle className="size-3.5" />
          </button>
        )}

        {/* Exit / close button */}
        {showSuggestions && (
          <button
            type="button"
            onClick={() => {
              setShowSuggestions(false);
              inputRef.current?.blur();
            }}
            className="dark:text-muted-foreground absolute top-1/2 right-2.5
              z-10 -translate-y-1/2 rounded-md p-1 text-slate-400 transition
              hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10
              dark:hover:text-foreground"
            aria-label="Close search"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {showSuggestions && (
        <div
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
          className="dark:border-border dark:bg-card absolute top-full right-0
            left-0 z-50 mt-1 overflow-hidden rounded-xl border border-slate-300
            bg-white shadow-sm dark:shadow-none"
        >
          {!isQuery && (
            <div
              className="dark:border-border/40 flex items-center gap-1.5
                border-b border-slate-100 px-3 py-1.5 text-[10px] font-black
                uppercase tracking-wide text-slate-400
                dark:text-muted-foreground"
            >
              <Clock className="size-3" />
              Recently visited
            </div>
          )}
          {visibleItems.map((s, i) => (
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
              justify-between gap-3 border-b border-secondary px-3 py-2.5
              text-left transition-colors last:border-b-0 ${
                i === activeIndex
                  ? "dark:bg-muted bg-secondary/50"
                  : "dark:bg-card bg-white"
              }`}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className="dark:text-foreground truncate text-base font-bold
                    text-slate-600 lowercase"
                >
                  {s.first_name} {s.last_name}
                </span>
                {(() => {
                  const cats = (s.borrower_categories ?? [])
                    .flatMap((bc) => bc.category ?? [])
                    .filter(Boolean);
                  if (cats.length === 0) return null;
                  return (
                    <span className="flex flex-wrap items-center gap-1">
                      {cats.map((cat) => (
                        <span
                          key={cat.id}
                          className="inline-flex items-center gap-1 rounded-full border
                            border-slate-900/10 bg-secondary/30 px-2 py-0.5 text-[11px]
                            font-semibold text-slate-600 capitalize
                            dark:border-white/10 dark:bg-slate-800
                            dark:text-slate-300"
                        >
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: cat.color ?? "#cbd5e1",
                            }}
                          />
                          {cat.name}
                        </span>
                      ))}
                    </span>
                  );
                })()}
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
