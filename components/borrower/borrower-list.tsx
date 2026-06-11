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
import { Users, ClipboardList, Activity } from "lucide-react";
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

export type RecentAccount = {
  id: string;
  borrower_id: string | null;
  type: string | null;
  principal_amount: number | null;
  created_at: string;
  release_date: string | null;
  schedule_mode: string | null;
  interest_type: string | null;
  borrower:
    | {
        first_name: string;
        last_name: string;
      }
    | Array<{
        first_name: string;
        last_name: string;
      }>
    | null;
};

export type AccountUpdate = {
  id: string;
  action: string;
  description: string;
  account_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  account: {
    id: string;
    borrower: {
      first_name: string;
      last_name: string;
    } | null;
  } | null;
};

type BorrowersListProps = {
  allBorrowers: Borrower[];
  initialSearchQuery?: string;
  initialCategoryIds?: string[];
  newlyCreatedBorrowers?: Borrower[];
  newlyCreatedAccounts?: RecentAccount[];
  recentAccountUpdates?: AccountUpdate[];
};

export default function BorrowersList({
  allBorrowers,
  initialSearchQuery = "",
  initialCategoryIds = [],
  newlyCreatedBorrowers = [],
  newlyCreatedAccounts = [],
  recentAccountUpdates = [],
}: BorrowersListProps) {
  const router = useRouter();

  const formatActivityDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    });
  };

  const getCategoryMeta = (borrower: Borrower) => {
    const entries =
      borrower.borrower_categories
        ?.map((row) => row.category)
        .filter(Boolean) ?? [];

    const label =
      entries.length > 0
        ? entries.map((entry) => entry.name).join(" / ")
        : "uncategorized";
    const color = entries.find((entry) => entry.color)?.color ?? null;
    return { label, color };
  };
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

      {/* Recent Activities Section */}
      <section className="mb-6">
        <article className="min-w-0 rounded-xl border-2 border-slate-900 bg-[#fffdf6] p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5 dark:border-slate-700 dark:bg-[#0b0f19]">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-md border-2 border-slate-900 bg-indigo-200 p-1.5 text-slate-900 dark:border-slate-700 dark:bg-indigo-400 dark:text-slate-900">
              <ClipboardList className="size-4" />
            </span>
            <h2 className="text-base font-black text-slate-900 lowercase dark:text-white">
              recent activities
            </h2>
          </div>

          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Newly Created Borrowers */}
            <div>
              <h3 className="mb-2 text-xs font-black tracking-wider text-slate-900 uppercase sm:mb-3 dark:text-white">
                newly created borrowers
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-3">
                {newlyCreatedBorrowers.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-slate-400 bg-[#eee8d5] p-3 text-sm font-bold text-slate-600 dark:bg-slate-700">
                    No recent borrowers created.
                  </div>
                ) : (
                  newlyCreatedBorrowers.map((borrower) => {
                    const categoryMeta = getCategoryMeta(borrower);
                    return (
                      <div
                        key={borrower.id}
                        className="rounded-lg border-2 border-slate-900 bg-[#fdf6e3] shadow-[3px_3px_0px_0px_#0f172a] transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#0f172a] active:translate-y-px active:shadow-[1px_1px_0px_0px_#0f172a] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[3px_3px_0px_0px_#000000] dark:hover:shadow-[4px_4px_0px_0px_rgb(255_255_255/0.12)] dark:active:shadow-[1px_1px_0px_0px_rgb(255_255_255/0.12)]"
                      >
                        <Link
                          href={`/borrowers/${borrower.id}`}
                          className="flex h-full flex-col outline-none"
                        >
                          <div className="flex flex-1 flex-col p-2 sm:p-3">
                            <span className="block text-sm font-black text-slate-900 uppercase sm:text-base dark:text-white">
                              {borrower.first_name} {borrower.last_name}
                            </span>
                            {borrower.contact && (
                              <p className="text-[11px] font-semibold text-slate-600 sm:text-xs dark:text-slate-300">
                                {borrower.contact}
                              </p>
                            )}
                            <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-md border-2 border-slate-900 bg-white px-1.5 py-0.5 text-[9px] font-black text-slate-900 uppercase shadow-[1px_1px_0px_0px_#0f172a] dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:shadow-[1px_1px_0px_0px_rgb(255_255_255/0.12)]">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{
                                  backgroundColor:
                                    categoryMeta.color ?? "#cbd5e1",
                                }}
                                aria-hidden
                              />
                              {categoryMeta.label}
                            </span>
                          </div>
                          <div className="border-t-2 border-slate-900 bg-[#eee8d5] p-2 text-[10px] font-black tracking-wider text-slate-900 uppercase sm:text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            added{" "}
                            {formatActivityDate(borrower.created_at || "")}
                          </div>
                        </Link>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Newly Created Accounts */}
            <div>
              <h3 className="mb-2 text-xs font-black tracking-wider text-slate-900 uppercase sm:mb-3 dark:text-white">
                newly created accounts
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-3">
                {newlyCreatedAccounts.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-slate-400 bg-[#eee8d5] p-3 text-sm font-bold text-slate-600 dark:bg-slate-700">
                    No recent accounts created.
                  </div>
                ) : (
                  newlyCreatedAccounts.map((account) => {
                    const borrowerObj = account.borrower
                      ? Array.isArray(account.borrower)
                        ? account.borrower[0]
                        : account.borrower
                      : null;
                    const isManual = account.schedule_mode === "manual";
                    const isRolling =
                      isManual && account.interest_type === "rolling";
                    const isCashAdvance = account.type === "cash_advance";
                    const typeLabel = isManual
                      ? isRolling
                        ? "rolling"
                        : "flat"
                      : isCashAdvance
                        ? "ca"
                        : "loan";
                    const typeBadgeBg = isManual
                      ? isRolling
                        ? "bg-cyan-200 text-cyan-900 dark:bg-cyan-800 dark:text-cyan-100"
                        : "bg-lime-200 text-lime-900 dark:bg-lime-800 dark:text-lime-100"
                      : isCashAdvance
                        ? "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100"
                        : "bg-violet-200 text-violet-900 dark:bg-violet-800 dark:text-violet-100";
                    return (
                      <div
                        key={account.id}
                        className="rounded-lg border-2 border-slate-900 bg-[#fdf6e3] shadow-[3px_3px_0px_0px_#0f172a] transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#0f172a] active:translate-y-px active:shadow-[1px_1px_0px_0px_#0f172a] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[3px_3px_0px_0px_#000000] dark:hover:shadow-[4px_4px_0px_0px_rgb(255_255_255/0.12)] dark:active:shadow-[1px_1px_0px_0px_rgb(255_255_255/0.12)]"
                      >
                        <Link
                          href={`/accounts/${account.id}`}
                          className="flex h-full flex-col outline-none"
                        >
                          <div className="flex flex-1 flex-col p-2 sm:p-3">
                            <div className="flex items-start justify-between gap-2">
                              <span className="block text-sm font-black text-slate-900 uppercase sm:text-base dark:text-white">
                                {borrowerObj
                                  ? `${borrowerObj.first_name} ${borrowerObj.last_name}`
                                  : "Unknown borrower"}
                              </span>
                              <span
                                className={`min-w-0 truncate rounded-md border-2 px-1.5 py-0.5 text-[8px] font-black tracking-wide uppercase shadow-[2px_2px_0px_0px_#0f172a] sm:px-2 sm:text-[9px] dark:shadow-[2px_2px_0px_0px_rgb(255_255_255/0.12)] ${typeBadgeBg} dark:border-slate-700`}
                              >
                                {typeLabel}
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-baseline gap-1.5">
                              <span className="text-xs font-black text-slate-900 sm:text-sm dark:text-white">
                                ₱
                                {(
                                  account.principal_amount ?? 0
                                ).toLocaleString()}
                              </span>
                              {account.release_date && (
                                <span className="rounded border border-slate-400 bg-white px-1 py-0.5 text-[8px] font-semibold text-slate-700 sm:px-1.5 sm:text-[10px] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {formatActivityDate(account.release_date)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="border-t-2 border-slate-900 bg-[#eee8d5] p-2 text-[10px] font-black tracking-wider text-slate-900 uppercase sm:text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            <div className="flex items-center justify-between gap-2">
                              <span>
                                created {formatActivityDate(account.created_at)}
                              </span>
                              {account.release_date && (
                                <span>
                                  released{" "}
                                  {formatActivityDate(account.release_date)}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Account Updates */}
            <div>
              <h3 className="mb-2 text-xs font-black tracking-wider text-slate-900 uppercase sm:mb-3 dark:text-white">
                account updates
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-3">
                {recentAccountUpdates.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-slate-400 bg-[#eee8d5] p-3 text-sm font-bold text-slate-600 dark:bg-slate-700">
                    No recent account updates.
                  </div>
                ) : (
                  recentAccountUpdates.map((update) => {
                    const meta = update.metadata ?? {};
                    const borrower = update.account?.borrower;
                    const borrowerName = borrower
                      ? `${borrower.first_name} ${borrower.last_name}`
                      : "Unknown borrower";

                    const actionStyles: Record<
                      string,
                      {
                        label: string;
                        bg: string;
                        border: string;
                        text: string;
                      }
                    > = {
                      "schedule.payment_applied": {
                        label: "payment",
                        bg: "bg-sky-200 dark:bg-sky-800",
                        border: "border-sky-900 dark:border-sky-600",
                        text: "text-sky-900 dark:text-sky-100",
                      },
                      "schedule.status_changed": {
                        label: "status",
                        bg: "bg-violet-200 dark:bg-violet-800",
                        border: "border-violet-900 dark:border-violet-600",
                        text: "text-violet-900 dark:text-violet-100",
                      },
                      "schedule.batch_paid": {
                        label: "batch paid",
                        bg: "bg-teal-200 dark:bg-teal-800",
                        border: "border-teal-900 dark:border-teal-600",
                        text: "text-teal-900 dark:text-teal-100",
                      },
                      "schedule.payment_deleted": {
                        label: "payment del.",
                        bg: "bg-rose-200 dark:bg-rose-800",
                        border: "border-rose-900 dark:border-rose-600",
                        text: "text-rose-900 dark:text-rose-100",
                      },
                      "schedule.deleted": {
                        label: "sched. del.",
                        bg: "bg-red-200 dark:bg-red-800",
                        border: "border-red-900 dark:border-red-600",
                        text: "text-red-900 dark:text-red-100",
                      },
                      "schedule.added": {
                        label: "sched. added",
                        bg: "bg-cyan-200 dark:bg-cyan-800",
                        border: "border-cyan-900 dark:border-cyan-600",
                        text: "text-cyan-900 dark:text-cyan-100",
                      },
                    };
                    const style = actionStyles[update.action] ?? {
                      label: update.action.replace(/.*\./, ""),
                      bg: "bg-slate-200 dark:bg-slate-700",
                      border: "border-slate-900 dark:border-slate-600",
                      text: "text-slate-900 dark:text-slate-200",
                    };

                    let amountDisplay: string | null = null;
                    let dateDisplay: string | null = null;

                    if (update.action === "schedule.payment_applied") {
                      const amt = Number(meta.amount ?? 0);
                      if (amt > 0) {
                        amountDisplay = `₱${amt.toLocaleString()}`;
                      }
                      const pd = meta.paymentDate as string | undefined;
                      if (pd) dateDisplay = formatActivityDate(pd);
                    } else if (update.action === "schedule.status_changed") {
                      const status = meta.status as string | undefined;
                      const due = Number(meta.amount_due ?? 0);
                      if (
                        (status === "paid" || status === "partial") &&
                        due > 0
                      ) {
                        amountDisplay = `₱${due.toLocaleString()}`;
                      }
                    } else if (update.action === "schedule.batch_paid") {
                      const ids = meta.ids as string[] | undefined;
                      const count = ids?.length ?? 0;
                      if (count > 0) {
                        amountDisplay = `${count} schedule${count === 1 ? "" : "s"}`;
                      }
                      const cd = meta.customDate as string | undefined;
                      if (cd) dateDisplay = formatActivityDate(cd);
                    } else if (update.action === "schedule.payment_deleted") {
                      const amt = Number(meta.amount ?? 0);
                      if (amt > 0) {
                        amountDisplay = `₱${amt.toLocaleString()}`;
                      }
                    } else if (update.action === "schedule.deleted") {
                      const due = Number(meta.amount_due ?? 0);
                      if (due > 0) {
                        amountDisplay = `₱${due.toLocaleString()}`;
                      }
                    }

                    const content = (
                      <div className="flex flex-1 flex-col p-2 sm:p-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="block text-sm font-black text-slate-900 uppercase sm:text-base dark:text-white">
                            {borrowerName}
                          </span>
                          <span
                            className={`shrink-0 rounded-md border-2 px-1.5 py-0.5 text-[8px] font-black tracking-wide uppercase shadow-[2px_2px_0px_0px_#0f172a] sm:px-2 sm:text-[9px] dark:shadow-[2px_2px_0px_0px_rgb(255_255_255/0.12)] ${style.bg} ${style.border} ${style.text}`}
                          >
                            {style.label}
                          </span>
                        </div>
                        {amountDisplay && (
                          <p className="mt-1 text-xs font-black text-slate-800 sm:text-sm dark:text-slate-200">
                            {amountDisplay}
                          </p>
                        )}
                        {dateDisplay && (
                          <p className="mt-0.5 text-[10px] font-bold text-slate-500 uppercase dark:text-slate-400">
                            paid {dateDisplay}
                          </p>
                        )}
                      </div>
                    );

                    return (
                      <div
                        key={update.id}
                        className="rounded-lg border-2 border-slate-900 bg-[#fdf6e3] shadow-[3px_3px_0px_0px_#0f172a] transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_#0f172a] active:translate-y-px active:shadow-[1px_1px_0px_0px_#0f172a] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[3px_3px_0px_0px_#000000] dark:hover:shadow-[4px_4px_0px_0px_rgb(255_255_255/0.12)] dark:active:shadow-[1px_1px_0px_0px_rgb(255_255_255/0.12)]"
                      >
                        {update.account_id ? (
                          <Link
                            href={`/accounts/${update.account_id}`}
                            className="flex h-full flex-col outline-none"
                          >
                            {content}
                            <div className="border-t-2 border-slate-900 bg-[#eee8d5] p-2 text-[10px] font-black tracking-wider text-slate-900 uppercase sm:text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              <span className="flex items-center gap-1.5">
                                <Activity className="size-3" />
                                {formatActivityDate(update.created_at)}
                              </span>
                            </div>
                          </Link>
                        ) : (
                          <div className="flex h-full flex-col">
                            {content}
                            <div className="border-t-2 border-slate-900 bg-[#eee8d5] p-2 text-[10px] font-black tracking-wider text-slate-900 uppercase sm:text-[11px] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              <span className="flex items-center gap-1.5">
                                <Activity className="size-3" />
                                {formatActivityDate(update.created_at)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </article>
      </section>

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
