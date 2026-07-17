"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { fetchCategoriesAction } from "@/lib/actions/categories";
import { useSeedBorrowersSearch } from "@/hooks/use-borrowers-search";

import AddBorrowerModal from "./add-borrower-modal";
import { BorrowerCard } from "./borrower-card";
import { ChevronDown, Plus, Users } from "lucide-react";
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
        id: string;
        first_name: string;
        last_name: string;
        borrower_categories: {
          category: { id: string; name: string; color: string | null };
        }[];
      }
    | Array<{
        id: string;
        first_name: string;
        last_name: string;
        borrower_categories: {
          category: { id: string; name: string; color: string | null };
        }[];
      }>
    | null;
};

type BorrowerInfo = { id?: string; first_name: string; last_name: string };

export type AccountUpdate = {
  id: string;
  action: string;
  description: string;
  account_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  account:
    | { id: string; borrower: BorrowerInfo | BorrowerInfo[] | null }
    | { id: string; borrower: BorrowerInfo | BorrowerInfo[] | null }[]
    | null;
};

type SortMode =
  | "default"
  | "most-loyal"
  | "most-accounts"
  | "biggest-borrower"
  | "almost-there"
  | "most-overdue"
  | "newest-member"
  | "highest-risk";

type BorrowersListProps = {
  allBorrowers: Borrower[];
  initialCategoryIds?: string[];
};

export default function BorrowersList({
  allBorrowers,
  initialCategoryIds = [],
}: BorrowersListProps) {
  const router = useRouter();
  const seedBorrowersSearch = useSeedBorrowersSearch();

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    initialCategoryIds ?? [],
  );

  // Sync local state when server prop changes (e.g. back/forward navigation)
  useEffect(() => {
    setSelectedCategoryIds((initialCategoryIds as string[] | undefined) ?? []);
  }, [initialCategoryIds]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [sortMode] = useState<SortMode>("default");
  const [isAddBorrowerModalOpen, setIsAddBorrowerModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (allBorrowers.length > 0) {
      seedBorrowersSearch(
        allBorrowers.map((b) => ({
          id: b.id,
          first_name: b.first_name,
          last_name: b.last_name,
          contact: b.contact ?? null,
          borrower_categories:
            b.borrower_categories?.map((bc) => ({
              category: [bc.category],
            })) ?? [],
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBorrowers]);

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

  const safeBorrowers = (allBorrowers as Borrower[] | undefined) ?? [];
  const safeCategoryIds = (selectedCategoryIds as string[] | undefined) ?? [];

  const filteredBorrowers = useMemo(() => {
    let result = safeBorrowers;
    if (safeCategoryIds.length > 0) {
      result = result.filter((b) =>
        b.borrower_categories?.some((bc) =>
          safeCategoryIds.includes(bc.category.id),
        ),
      );
    }
    return result;
  }, [safeBorrowers, safeCategoryIds]);

  useEffect(() => {
    setVisibleCount(12);
  }, [safeCategoryIds, sortMode]);

  // Pre-compute sort metrics once per borrower instead of O(n log n) times inside sort comparator
  const borrowersWithMetrics = useMemo(() => {
    return filteredBorrowers.map((b) => {
      const autoPrincipal = (b.account_schedules ?? []).reduce(
        (sum, s) => sum + (s.principal_amount ?? 0),
        0,
      );
      const totalPrincipal = autoPrincipal + (b.manual_total_principal ?? 0);

      const autoSchedules = b.account_schedules ?? [];
      const autoTotal = autoSchedules.reduce(
        (sum, s) => sum + (s.total_schedules ?? 0),
        0,
      );
      const autoPaid = autoSchedules.reduce(
        (sum, s) => sum + (s.paid_schedules_count ?? 0),
        0,
      );
      const manualPrincipal = b.manual_total_principal ?? 0;
      const manualPaid = b.manual_total_paid ?? 0;
      const autoWeight = autoTotal;
      const manualWeight = manualPrincipal > 0 ? 1 : 0;
      const totalWeight = autoWeight + manualWeight;
      const completionRatio =
        totalWeight === 0
          ? 0
          : ((autoTotal > 0 ? autoPaid / autoTotal : 0) * autoWeight +
              (manualPrincipal > 0
                ? Math.min(1, manualPaid / manualPrincipal)
                : 0) *
                manualWeight) /
            totalWeight;
      const risk =
        totalPrincipal > 0 ? (b.overdue_total ?? 0) / totalPrincipal : -1;

      return {
        ...b,
        _totalPrincipal: totalPrincipal,
        _completionRatio: completionRatio,
        _risk: risk,
      };
    });
  }, [filteredBorrowers]);

  const sortedBorrowers = useMemo(() => {
    if (sortMode === "default") return borrowersWithMetrics;

    const hasAccounts = (b: Borrower) => (b.accounts_count ?? 0) > 0;

    return [...borrowersWithMetrics].sort((a, b) => {
      switch (sortMode) {
        case "most-loyal":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "most-accounts":
          return (b.accounts_count ?? 0) - (a.accounts_count ?? 0);
        case "biggest-borrower": {
          if (b._totalPrincipal !== a._totalPrincipal)
            return b._totalPrincipal - a._totalPrincipal;
          return (b.accounts_count ?? 0) - (a.accounts_count ?? 0);
        }
        case "almost-there": {
          const hasA = hasAccounts(a);
          const hasB = hasAccounts(b);
          if (hasA && !hasB) return -1;
          if (!hasA && hasB) return 1;
          if (!hasA && !hasB) return 0;
          return b._completionRatio - a._completionRatio;
        }
        case "most-overdue":
          return (b.overdue_count ?? 0) - (a.overdue_count ?? 0);
        case "newest-member":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "highest-risk": {
          return b._risk - a._risk;
        }
        default:
          return 0;
      }
    });
  }, [borrowersWithMetrics, sortMode]);

  return (
    <div className="">
      <AddBorrowerModal
        getBorrowers={refreshPage}
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
            className="dark:border-border dark:text-background fixed right-4
              bottom-[76px] z-40 flex size-14 items-center justify-center
              rounded-full border-2 border-slate-900 bg-green-400 text-slate-600
              shadow-[3px_3px_0px_0px_rgb(15_23_42/0.4)] transition-transform
              duration-200 active:scale-95 dark:bg-green-400
              dark:shadow-[3px_3px_0px_0px_rgb(0_0_0/0.5)]"
          >
            <Plus className="size-5" />
          </button>,
          document.body,
        )}

      <div className="mb-6 flex flex-col gap-3">
        {recentBorrowers.length > 0 ? (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p
                className="dark:text-muted-foreground text-[10px] font-bold
                  tracking-[0.14em] text-slate-500 uppercase"
              >
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
                className="text-[10px] font-bold tracking-wide text-slate-400
                  uppercase transition hover:text-rose-500"
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
                    className="dark:border-border dark:bg-muted
                      dark:text-foreground dark:hover:bg-muted/70 flex
                      items-center gap-2 rounded-full border border-slate-900/15
                      bg-[#fffdf6] px-3 py-1.5 text-xs font-semibold
                      text-slate-800 uppercase
                      shadow-[1px_1px_0px_0px_rgb(15_23_42/0.08)] transition
                      hover:bg-white"
                  >
                    <span
                      className="flex size-5 shrink-0 items-center
                        justify-center rounded-full text-[9px] font-black
                        text-white"
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

        <div className="relative">
          <p
            className="dark:text-muted-foreground mb-1.5 text-[10px] font-bold
              tracking-[0.14em] text-slate-500 uppercase"
          >
            Categories
          </p>
          <button
            type="button"
            aria-expanded={isCategoryDropdownOpen}
            aria-haspopup="listbox"
            onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
            className="dark:border-border dark:hover:bg-muted flex w-full
              items-center justify-between gap-3 rounded-xl border bg-white
              border-slate-300 px-4 py-3 text-left transition dark:shadow-none"
          >
            <span
              className="dark:text-foreground text-sm font-bold tracking-wide
                text-slate-600 uppercase"
            >
              {safeCategoryIds.length > 0
                ? `${safeCategoryIds.length} selected`
                : "All categories"}
            </span>

            <span
              className="dark:border-border dark:bg-muted
                dark:text-muted-foreground flex size-8 shrink-0 items-center
                justify-center rounded-lg border border-slate-300 bg-slate-50
                text-slate-700"
            >
              <ChevronDown
                className={`size-3.5 transition-transform
                  ${isCategoryDropdownOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </span>
          </button>

          {isCategoryDropdownOpen ? (
            <div
              role="listbox"
              aria-multiselectable
              className="dark:border-border dark:bg-card absolute z-20 mt-2
                max-h-72 w-full overflow-y-auto rounded-xl border
                border-slate-300 bg-white p-2
                shadow-[3px_3px_0px_0px_rgb(15_23_42/0.18)] dark:shadow-none"
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
                      className={`flex items-center justify-between gap-2
                        rounded-lg border px-3 py-2.5 text-left text-sm
                        font-semibold transition ${
                          isSelected
                            ? `dark:border-border dark:bg-foreground
                              dark:text-background border-2 border-slate-900
                              bg-slate-900 text-white
                              shadow-[1px_1px_0px_0px_rgb(15_23_42/0.5)]
                              dark:shadow-none`
                            : `dark:border-border dark:bg-muted
                              dark:text-foreground dark:hover:border-border
                              dark:hover:bg-muted/70 border border-slate-900/15
                              bg-slate-50/60 text-slate-800
                              shadow-[1px_1px_0px_0px_rgb(15_23_42/0.08)]
                              hover:border-slate-900/35 hover:bg-white
                              dark:shadow-none`
                        }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="dark:border-border size-3 shrink-0
                            rounded-full border-2 border-slate-900/25"
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
                  className="mt-2 w-full rounded-lg border-2 border-rose-800/35
                    bg-rose-50 px-3 py-2 text-center text-xs font-black
                    tracking-wide text-rose-900 uppercase
                    shadow-[1px_1px_0px_0px_rgb(190_18_60/0.25)] transition
                    hover:bg-rose-100/90 dark:border-rose-900/40
                    dark:bg-rose-950/30 dark:text-rose-300 dark:shadow-none
                    dark:hover:bg-rose-950/50"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Borrowers list header + sort */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="rounded-md border-2 border-slate-900 bg-slate-900 p-1.5
              text-white dark:border-slate-600 dark:bg-slate-100
              dark:text-slate-600"
          >
            <Users className="size-4" />
          </span>
          <h2
            className="text-base font-black lowercase tracking-wide
              text-slate-600 dark:text-white"
          >
            borrowers
          </h2>
          <span
            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black
              text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {sortedBorrowers.length}
          </span>
        </div>
      </div>

      {sortedBorrowers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            safeCategoryIds.length > 0 ? "No matches found" : "No borrowers yet"
          }
          description={
            safeCategoryIds.length > 0
              ? "Try adjusting your search or clearing category filters."
              : "Add your first borrower to start tracking loans and collections."
          }
          action={
            safeCategoryIds.length === 0
              ? { label: "Add borrower", href: "/borrowers" }
              : undefined
          }
        />
      ) : (
        <PullToRefresh>
          <MasonryGrid
            borrowers={sortedBorrowers.slice(0, visibleCount)}
            onBorrowerUpdated={refreshPage}
            onVisit={recordVisit}
          />
          {sortedBorrowers.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + 12)}
              className="mx-auto mt-4 block rounded-xl border-2 border-slate-900
                bg-white px-4 py-2.5 text-xs font-black tracking-wide
                text-slate-700 uppercase shadow-[2px_2px_0px_0px_#0f172a]
                transition active:translate-y-px active:shadow-none
                dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200
                dark:shadow-none"
            >
              load more ({sortedBorrowers.length - visibleCount} remaining)
            </button>
          )}
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
        <div key={ci} className="flex min-w-0 flex-1 flex-col gap-6">
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
