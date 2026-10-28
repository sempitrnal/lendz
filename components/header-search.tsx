"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Search, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBorrowersSearch } from "@/hooks/use-borrowers-search";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import {
  RECENT_BORROWERS_CHANGED,
  loadRecentBorrowers,
  saveRecentBorrower,
} from "@/lib/recent-borrowers";

interface HeaderSearchProps {
  className?: string;
  /** Translucent-white field for sitting on a coloured header. */
  onColor?: boolean;
  onFocusChange?: (focused: boolean) => void;
}

function loadRecentIds(): string[] {
  return loadRecentBorrowers().map((b) => b.id);
}

export default function HeaderSearch({
  className,
  onColor = false,
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
    setRecentIds(loadRecentIds());
  }, []);

  useEffect(() => {
    const handle = () => setRecentIds(loadRecentIds());
    window.addEventListener(RECENT_BORROWERS_CHANGED, handle);
    return () => window.removeEventListener(RECENT_BORROWERS_CHANGED, handle);
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
    const category = borrower.borrower_categories[0]?.category[0];
    const next = saveRecentBorrower({
      id: borrower.id,
      first_name: borrower.first_name,
      last_name: borrower.last_name,
      categoryColor: category?.color ?? null,
    });
    setRecentIds(next.map((b) => b.id));
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
          className={cn(
            "text-muted-foreground pointer-events-none absolute left-3 size-4",
            onColor && "text-white/80",
          )}
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
          className={cn(
            `dark:border-border dark:bg-card dark:text-foreground
            dark:placeholder:text-muted-foreground h-9 w-full rounded-lg border
            border-slate-300 bg-white py-2 pr-14 pl-9 text-sm text-slate-600
            outline-none placeholder:text-slate-400 transition
            focus:border-slate-400 dark:focus:border-slate-500`,
            onColor &&
              `rounded-full border-transparent bg-white/20 font-semibold
              text-white placeholder:text-white/70 focus:border-white/40
              focus:bg-white/25 dark:border-transparent dark:bg-white/20
              dark:text-white dark:placeholder:text-white/70
              dark:focus:border-white/40`,
          )}
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
            className={cn(
              `dark:text-muted-foreground absolute top-1/2 z-10 -translate-y-1/2
              rounded-md p-1 text-slate-400 transition hover:bg-slate-100
              hover:text-slate-600 dark:hover:bg-white/10
              dark:hover:text-foreground`,
              showSuggestions ? "right-8" : "right-2.5",
              onColor &&
                `text-white/80 hover:bg-white/15 hover:text-white
                dark:text-white/80 dark:hover:text-white`,
            )}
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
            className={cn(
              `dark:text-muted-foreground absolute top-1/2 right-2.5 z-10
              -translate-y-1/2 rounded-md p-1 text-slate-400 transition
              hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10
              dark:hover:text-foreground`,
              onColor &&
                `text-white/80 hover:bg-white/15 hover:text-white
                dark:text-white/80 dark:hover:text-white`,
            )}
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
          className={cn(
            `dark:border-border dark:bg-card absolute top-full right-0 left-0
            z-50 mt-1 overflow-hidden rounded-xl border border-slate-300
            bg-white shadow-sm dark:shadow-none`,
            onColor &&
              `-left-[3.25rem] -right-9 mt-3 rounded-2xl border-0 bg-card
              shadow-xl ring-1 shadow-emerald-900/10 ring-black/5 dark:border-0
              dark:ring-white/10`,
          )}
        >
          {!isQuery && (
            <div
              className={cn(
                `dark:border-border/40 flex items-center gap-1.5 border-b
                border-slate-100 px-3 py-1.5 text-[10px] font-black uppercase
                tracking-wide text-slate-400 dark:text-muted-foreground`,
                onColor &&
                  `border-0 bg-emerald-50 px-4 py-2 text-emerald-700
                  dark:bg-emerald-500/10 dark:text-emerald-300`,
              )}
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
              className={cn(
                `dark:border-border/50 flex w-full items-center justify-between
                gap-3 border-b border-secondary px-3 py-2.5 text-left
                transition-colors last:border-b-0`,
                i === activeIndex
                  ? "dark:bg-muted bg-secondary/50"
                  : "dark:bg-card bg-white",
                onColor &&
                  `gap-3 border-0 px-4 py-3 ${
                    i === activeIndex
                      ? "bg-emerald-50 dark:bg-emerald-500/10"
                      : "bg-card dark:bg-card"
                  }`,
              )}
            >
              {onColor && (
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center
                    rounded-full bg-emerald-100 text-sm font-bold uppercase
                    text-emerald-700 dark:bg-emerald-500/20
                    dark:text-emerald-300"
                >
                  {(s.first_name?.[0] ?? "") + (s.last_name?.[0] ?? "")}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className={cn(
                    `dark:text-foreground truncate text-base font-bold
                    text-slate-600 lowercase`,
                    onColor && "text-sm text-card-foreground/80",
                  )}
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
                          className={cn(
                            `inline-flex items-center gap-1 rounded-full border
                            border-slate-900/10 bg-secondary/30 px-2 py-0.5 text-[11px]
                            font-semibold text-slate-600 capitalize
                            dark:border-white/10 dark:bg-slate-800
                            dark:text-slate-300`,
                            onColor && "border-0 bg-muted dark:bg-white/10",
                          )}
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
