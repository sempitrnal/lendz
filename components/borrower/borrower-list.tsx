"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { fetchCategoriesAction } from "@/lib/actions/categories";
import { formFieldInputClassName } from "@/lib/form-field-classes";

import AddBorrowerModal from "./add-borrower-modal";
import { BorrowerCard } from "./borrower-card";
import { BsChevronDown } from "react-icons/bs";
import { FaPlus } from "react-icons/fa6";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PullToRefresh } from "@/components/pull-to-refresh";
import Link from "next/link";

export type Borrower = {
  id: string;
  first_name: string;
  last_name: string;
  contact: string | null;
  created_at: string;
  borrower_categories: {
    category: {
      id: string;
      name: string;
      color: string | null;
    };
  }[];
  next_collection_date?: string | null;
  next_collection_amount?: number;
  next_collection_amounts?: number[];
  next_collection_status?: string | null;
  has_accounts?: boolean;
  all_accounts_pending?: boolean;
  pending_principal_total?: number;
  overdue_total?: number;
  overdue_count?: number;
  accounts_count?: number;
  account_schedules?: {
    account_id?: string;
    due_date: string;
    amount: number;
    status: string;
    total_schedules?: number;
    paid_schedules_count?: number;
    schedule_mode?: string | null;
    principal_amount?: number | null;
    amount_paid_total?: number;
    interest_rate?: number | null;
    amount_due_per_schedule?: number | null;
    overdue_schedules?: { due_date: string; amount: number }[];
    type?: string | null;
    interest_type?: string | null;
  }[];
  overdue_schedules?: { due_date: string; amount: number; status: string }[];
  manual_total_principal?: number;
  manual_total_paid?: number;
  manual_total_remaining?: number;
  manual_accounts_count?: number;
};

type BorrowersListProps = {
  allBorrowers: Borrower[];
  initialSearchQuery?: string;
  initialCategoryIds?: string[];
};

export default function BorrowersList({
  allBorrowers,
  initialSearchQuery = "",
  initialCategoryIds = [],
}: BorrowersListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [listQuery, setListQuery] = useState(initialSearchQuery);
  const listDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    initialCategoryIds ?? [],
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync local state when server prop changes (e.g. back/forward navigation)
  useEffect(() => {
    setSearchQuery(initialSearchQuery ?? "");
  }, [initialSearchQuery]);
  useEffect(() => {
    setSelectedCategoryIds((initialCategoryIds as string[] | undefined) ?? []);
  }, [initialCategoryIds]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isAddBorrowerModalOpen, setIsAddBorrowerModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Restore scroll position when returning from borrower detail
  useEffect(() => {
    const saved = sessionStorage.getItem("borrowers-list-scroll");
    if (saved) {
      sessionStorage.removeItem("borrowers-list-scroll");
      const y = parseInt(saved, 10);
      // Delay to let Next.js finish its initial paint/scroll-to-top
      setTimeout(() => {
        window.scrollTo({ top: y, behavior: "instant" });
      }, 150);
    }
  }, []);

  const [updatingBorrowerId, setUpdatingBorrowerId] = useState<string | null>(
    null,
  );

  const RECENT_KEY = "borrowers-recent-visits";
  const [recentBorrowers, setRecentBorrowers] = useState<
    {
      id: string;
      first_name: string;
      last_name: string;
      categoryColor: string | null;
    }[]
  >([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) setRecentBorrowers(JSON.parse(stored));
    } catch {}
  }, []);

  const recordVisit = useCallback(
    (borrower: {
      id: string;
      first_name: string;
      last_name: string;
      categoryColor: string | null;
    }) => {
      setRecentBorrowers((prev) => {
        const filtered = prev.filter((b) => b.id !== borrower.id);
        const next = [borrower, ...filtered].slice(0, 10);
        try {
          localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [],
  );

  const openAddBorrowerModal = useCallback(() => {
    setIsAddBorrowerModalOpen(true);
  }, []);
  const closeAddBorrowerModal = useCallback(() => {
    setIsAddBorrowerModalOpen(false);
  }, []);

  const refreshPage = useCallback(() => {
    router.refresh();
  }, [router]);

  const [categories, setCategories] = useState<
    { id: string; name: string; color: string | null }[]
  >([]);

  useEffect(() => {
    fetchCategoriesAction().then((rows) => {
      setCategories(
        rows.map((c) => ({ id: c.id, name: c.name, color: c.color })),
      );
    });
  }, []);

  // Debounce list filtering so typing stays responsive
  useEffect(() => {
    if (listDebounceRef.current) clearTimeout(listDebounceRef.current);
    listDebounceRef.current = setTimeout(() => {
      setListQuery(searchQuery);
    }, 250);
  }, [searchQuery]);

  const safeBorrowers = (allBorrowers as Borrower[] | undefined) ?? [];
  const safeCategoryIds = (selectedCategoryIds as string[] | undefined) ?? [];

  const filteredBorrowers = useMemo(() => {
    let result = safeBorrowers;
    const q = listQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (b) =>
          b.first_name.toLowerCase().includes(q) ||
          b.last_name.toLowerCase().includes(q) ||
          `${b.first_name} ${b.last_name}`.toLowerCase().includes(q) ||
          (b.contact ?? "").toLowerCase().includes(q),
      );
    }
    if (safeCategoryIds.length > 0) {
      result = result.filter((b) =>
        b.borrower_categories?.some((bc) =>
          safeCategoryIds.includes(bc.category.id),
        ),
      );
    }
    return result;
  }, [safeBorrowers, listQuery, safeCategoryIds]);

  // Instant client-side suggestions from cached borrowers (no network)
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return safeBorrowers
      .filter(
        (b) =>
          b.first_name.toLowerCase().includes(q) ||
          b.last_name.toLowerCase().includes(q) ||
          `${b.first_name} ${b.last_name}`.toLowerCase().includes(q) ||
          (b.contact ?? "").toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [safeBorrowers, searchQuery]);

  const openSuggestion = useCallback(
    (s: Borrower) => {
      setShowSuggestions(false);
      sessionStorage.setItem("borrowers-list-scroll", String(window.scrollY));
      recordVisit({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        categoryColor: s.borrower_categories?.[0]?.category?.color ?? null,
      });
      router.push(`/borrowers/${s.id}`);
    },
    [recordVisit, router],
  );

  return (
    <div className="">
      <AddBorrowerModal
        getBorrowers={refreshPage}
        openModal={openAddBorrowerModal}
        isOpen={isAddBorrowerModalOpen}
        onClose={closeAddBorrowerModal}
      />

      <div className="mb-6 flex items-center justify-between">
        <div>
          {/* <h1 className="text-2xl font-black lowercase">Borrowers</h1> */}
          {/* <p className="text-xs text-slate-500 mt-1">
            {totalCount} total
          </p> */}
        </div>
      </div>

      {isMounted &&
        createPortal(
          <button
            type="button"
            onClick={openAddBorrowerModal}
            aria-label="Add borrower"
            className="dark:border-border dark:text-background fixed right-4 bottom-[76px] z-[2] flex size-14 items-center justify-center rounded-full border-2 border-slate-900 bg-green-400 text-slate-900 shadow-[3px_3px_0px_0px_rgb(15_23_42/0.4)] transition-transform duration-200 active:scale-95 dark:bg-green-400 dark:shadow-[3px_3px_0px_0px_rgb(0_0_0/0.5)]"
          >
            <FaPlus className="size-5" />
          </button>,
          document.body,
        )}

      <div className="mb-6 flex flex-col gap-3">
        {recentBorrowers.length > 0 ? (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="dark:text-muted-foreground text-[10px] font-bold tracking-[0.14em] text-slate-500 uppercase">
                Recently visited
              </p>
              <button
                type="button"
                onClick={() => {
                  setRecentBorrowers([]);
                  try {
                    localStorage.removeItem(RECENT_KEY);
                  } catch {}
                }}
                className="text-[10px] font-bold tracking-wide text-slate-400 uppercase transition hover:text-rose-500"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentBorrowers.map((b) => {
                const initials =
                  `${b.first_name[0] ?? ""}${b.last_name[0] ?? ""}`.toUpperCase();
                return (
                  <Link
                    key={b.id}
                    href={`/borrowers/${b.id}`}
                    onClick={() => {
                      sessionStorage.setItem(
                        "borrowers-list-scroll",
                        String(window.scrollY),
                      );
                    }}
                    className="dark:border-border dark:bg-muted dark:text-foreground dark:hover:bg-muted/70 flex items-center gap-2 rounded-full border border-slate-900/15 bg-[#fffdf6] px-3 py-1.5 text-xs font-semibold text-slate-800 uppercase shadow-[1px_1px_0px_0px_rgb(15_23_42/0.08)] transition hover:bg-white"
                  >
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white"
                      style={{
                        backgroundColor: b.categoryColor ?? "#0f172a",
                      }}
                    >
                      {initials}
                    </span>
                    {b.first_name} {b.last_name}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        <div ref={searchWrapperRef} className="relative">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              const v = e.target.value;
              setSearchQuery(v);
              setShowSuggestions(v.trim().length > 0);
              setActiveSuggestion(-1);
            }}
            onFocus={() => {
              if (searchQuery.trim()) setShowSuggestions(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowSuggestions(false);
                return;
              }
              if (!showSuggestions || suggestions.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveSuggestion((p) =>
                  Math.min(p + 1, suggestions.length - 1),
                );
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveSuggestion((p) => Math.max(p - 1, -1));
              } else if (e.key === "Enter" && activeSuggestion >= 0) {
                e.preventDefault();
                openSuggestion(suggestions[activeSuggestion]);
              }
            }}
            placeholder="Search by name or contact"
            className={formFieldInputClassName}
            aria-label="Search borrowers"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              role="listbox"
              className="dark:border-border dark:bg-card absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_rgb(15_23_42/0.85)] dark:shadow-[3px_3px_0px_0px_rgb(0_0_0/0.5)]"
            >
              {suggestions.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={i === activeSuggestion}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    openSuggestion(s);
                  }}
                  onMouseEnter={() => setActiveSuggestion(i)}
                  className={`dark:border-border/50 flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition-colors last:border-b-0 ${
                    i === activeSuggestion
                      ? "dark:bg-muted bg-slate-100"
                      : "dark:bg-card bg-white"
                  }`}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                    <span className="dark:text-foreground text-sm font-black text-slate-900 uppercase">
                      {s.first_name} {s.last_name}
                    </span>
                    {s.borrower_categories?.[0]?.category && (
                      <span className="flex shrink-0 items-center gap-1">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              s.borrower_categories[0].category.color ??
                              "#cbd5e1",
                          }}
                        />
                        <span className="dark:text-muted-foreground text-[10px] font-semibold text-slate-400 capitalize">
                          {s.borrower_categories[0].category.name}
                        </span>
                      </span>
                    )}
                  </span>
                  {s.contact && (
                    <span className="dark:text-muted-foreground shrink-0 text-[10px] text-slate-400 tabular-nums">
                      {s.contact}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <p className="dark:text-muted-foreground mb-1.5 text-[10px] font-bold tracking-[0.14em] text-slate-500 uppercase">
            Categories
          </p>
          <button
            type="button"
            aria-expanded={isCategoryDropdownOpen}
            aria-haspopup="listbox"
            onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
            className="dark:border-border dark:hover:bg-muted flex w-full items-center justify-between gap-3 rounded-xl border-2 border-slate-900/90 px-4 py-3 text-left shadow-[2px_2px_0px_0px_rgb(15_23_42/0.85)] transition active:translate-y-px active:shadow-[1px_1px_0px_0px_rgb(15_23_42/0.85)] dark:shadow-none"
          >
            <span className="dark:text-foreground text-sm font-bold tracking-wide text-slate-900 uppercase">
              {safeCategoryIds.length > 0
                ? `${safeCategoryIds.length} selected`
                : "All categories"}
            </span>

            <span className="dark:border-border dark:bg-muted dark:text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-900/20 bg-slate-50 text-slate-700">
              <BsChevronDown
                className={`size-3.5 transition-transform ${isCategoryDropdownOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </span>
          </button>

          {isCategoryDropdownOpen ? (
            <div
              role="listbox"
              aria-multiselectable
              className="dark:border-border dark:bg-card absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border-2 border-slate-900/90 bg-white p-2 shadow-[3px_3px_0px_0px_rgb(15_23_42/0.18)] dark:shadow-none"
            >
              <div className="flex flex-col gap-1.5">
                {categories.map((category) => {
                  const isSelected = selectedCategoryIds.includes(category.id);

                  return (
                    <button
                      key={category.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        const next = isSelected
                          ? selectedCategoryIds.filter(
                              (id) => id !== category.id,
                            )
                          : [...selectedCategoryIds, category.id];
                        setSelectedCategoryIds(next);
                      }}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${
                        isSelected
                          ? "dark:border-border dark:bg-foreground dark:text-background border-2 border-slate-900 bg-slate-900 text-white shadow-[1px_1px_0px_0px_rgb(15_23_42/0.5)] dark:shadow-none"
                          : "dark:border-border dark:bg-muted dark:text-foreground dark:hover:border-border dark:hover:bg-muted/70 border border-slate-900/15 bg-slate-50/60 text-slate-800 shadow-[1px_1px_0px_0px_rgb(15_23_42/0.08)] hover:border-slate-900/35 hover:bg-white dark:shadow-none"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="dark:border-border size-3 shrink-0 rounded-full border-2 border-slate-900/25"
                          style={{
                            backgroundColor: category.color ?? "#cbd5e1",
                          }}
                        />

                        <span className="truncate capitalize">
                          {category.name}
                        </span>
                      </div>

                      {isSelected ? (
                        <span
                          className="shrink-0 text-xs font-black"
                          aria-hidden
                        >
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {safeCategoryIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryIds([]);
                  }}
                  className="mt-2 w-full rounded-lg border-2 border-rose-800/35 bg-rose-50 px-3 py-2 text-center text-xs font-black tracking-wide text-rose-900 uppercase shadow-[1px_1px_0px_0px_rgb(190_18_60/0.25)] transition hover:bg-rose-100/90 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 dark:shadow-none dark:hover:bg-rose-950/50"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {filteredBorrowers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            safeCategoryIds.length > 0 || listQuery.trim()
              ? "No matches found"
              : "No borrowers yet"
          }
          description={
            safeCategoryIds.length > 0 || listQuery.trim()
              ? "Try adjusting your search or clearing category filters."
              : "Add your first borrower to start tracking loans and collections."
          }
          action={
            safeCategoryIds.length === 0 && !listQuery.trim()
              ? { label: "Add borrower", href: "/borrowers" }
              : undefined
          }
        />
      ) : (
        <PullToRefresh>
          <MasonryGrid
            borrowers={filteredBorrowers}
            onBorrowerUpdated={refreshPage}
            onVisit={recordVisit}
          />
        </PullToRefresh>
      )}
    </div>
  );
}

function useMasonryColCount(): number {
  const [cols, setCols] = useState(0);

  useLayoutEffect(() => {
    const update = () => {
      if (window.matchMedia("(min-width: 1280px)").matches) setCols(3);
      else if (window.matchMedia("(min-width: 768px)").matches) setCols(2);
      else setCols(1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return cols;
}

const MasonryGrid = memo(function MasonryGrid({
  borrowers,
  onBorrowerUpdated,
  onVisit,
}: {
  borrowers: Borrower[];
  onBorrowerUpdated: () => void;
  onVisit: (borrower: {
    id: string;
    first_name: string;
    last_name: string;
    categoryColor: string | null;
  }) => void;
}) {
  const colCount = useMasonryColCount();

  if (colCount === 0) {
    return (
      <div className="flex w-full flex-col gap-4">
        {borrowers.map((borrower) => (
          <BorrowerCard
            key={borrower.id}
            borrower={borrower}
            showScheduleSummary
            onBorrowerUpdated={onBorrowerUpdated}
            onVisit={onVisit}
          />
        ))}
      </div>
    );
  }

  const columns: Borrower[][] = Array.from({ length: colCount }, () => []);
  borrowers.forEach((b, i) => columns[i % colCount].push(b));

  return (
    <div className="flex w-full items-start gap-4">
      {columns.map((col, ci) => (
        <div key={ci} className="flex min-w-0 flex-1 flex-col gap-4">
          {col.map((borrower) => (
            <BorrowerCard
              key={borrower.id}
              borrower={borrower}
              showScheduleSummary
              onBorrowerUpdated={onBorrowerUpdated}
              onVisit={onVisit}
            />
          ))}
        </div>
      ))}
    </div>
  );
});
