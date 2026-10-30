"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCategories } from "@/lib/categories/use-categories";
import { useSeedBorrowersSearch } from "@/hooks/use-borrowers-search";
import {
  RECENT_BORROWERS_CHANGED,
  type RecentBorrower,
  clearRecentBorrowers,
  loadRecentBorrowers,
  saveRecentBorrower,
} from "@/lib/recent-borrowers";

import AddBorrowerFab from "./add-borrower-fab";
import { buildBorrowerScheduleCardProps } from "./borrower-schedule-card";
import BorrowerRowCard from "./borrower-row-card";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
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
  /** PostgREST embedded count: `borrower_notes(count)` */
  borrower_notes?: { count: number }[];
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
  total_paid?: number;
  total_remaining?: number;
  total_expected?: number;
  all_schedules?: {
    due_date: string;
    amount: number;
    amount_paid: number;
    remaining: number;
    status: string;
  }[];
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
  const [sortMode] = useState<SortMode>("default");

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

  const [recentBorrowers, setRecentBorrowers] = useState<RecentBorrower[]>([]);

  useEffect(() => {
    setRecentBorrowers(loadRecentBorrowers());
  }, []);

  useEffect(() => {
    const handle = () => setRecentBorrowers(loadRecentBorrowers());
    window.addEventListener(RECENT_BORROWERS_CHANGED, handle);
    return () => window.removeEventListener(RECENT_BORROWERS_CHANGED, handle);
  }, []);

  const recordVisit = useCallback(
    (borrower: {
      id: string;
      first_name: string;
      last_name: string;
      categoryColor: string | null;
    }) => {
      const next = saveRecentBorrower(borrower);
      setRecentBorrowers(next);
    },
    [],
  );

  const refreshPage = useCallback(() => {
    router.refresh();
  }, [router]);

  // Also what the add sheet's picker shows, so it opens already filled.
  const { data: categoryRows } = useCategories();
  const categories = categoryRows ?? [];

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

  const withAccounts = safeBorrowers.filter(
    (b) => b.has_accounts ?? (b.accounts_count ?? 0) > 0,
  ).length;
  const overdue = safeBorrowers.filter((b) => (b.overdue_count ?? 0) > 0);
  const overdueTotal = overdue.reduce((s, b) => s + (b.overdue_total ?? 0), 0);
  const toggleCategory = (id: string) =>
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <div className="pb-16">
      {/* The green band; the search above it is the mobile top bar. */}
      <div
        data-settle-group="band"
        className="relative -mt-16 px-4 pt-[4.75rem] pb-14 text-white sm:mt-0
          sm:px-6 sm:pt-6"
      >
        <div
          aria-hidden="true"
          data-nav-band
          className="band-bg absolute inset-0 rounded-b-3xl"
        />
        <div className="relative z-20 flex items-center justify-between">
          <p className="text-xs font-bold tracking-wider uppercase">
            borrowers
          </p>
          <AddBorrowerFab onSuccess={refreshPage} variant="band" />
        </div>
        <div className="relative z-20 mt-4">
          <p className="text-xs font-semibold opacity-80">
            {safeCategoryIds.length > 0 ? "In these categories" : "Everyone"}
          </p>
          <p
            className="text-[40px] leading-tight font-black tracking-tight
              tabular-nums"
          >
            {sortedBorrowers.length}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span
              className="rounded-full bg-white/20 px-2.5 py-1 text-[11px]
                font-semibold"
            >
              {withAccounts} with accounts
            </span>
            {overdue.length > 0 && (
              <span
                className="rounded-full bg-white px-2.5 py-1 text-[11px]
                  font-bold text-rose-600"
              >
                {overdue.length} overdue · ₱
                {Math.round(overdueTotal).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div data-settle className="relative z-10 -mt-8 space-y-4 px-3 sm:px-6">
        {/* Category filters: tap any to narrow the list, "all" to undo. */}
        <div
          className="flex gap-1.5 overflow-x-auto rounded-3xl border
            border-border bg-card p-1.5 shadow-sm [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Filter by category"
        >
          <button
            type="button"
            aria-pressed={safeCategoryIds.length === 0}
            onClick={() => setSelectedCategoryIds([])}
            className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold
              transition active:scale-95 ${
                safeCategoryIds.length === 0
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
          >
            all
          </button>
          {categories.map((category) => {
            const on = safeCategoryIds.includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCategory(category.id)}
                style={
                  {
                    "--cat": category.color ?? "#94a3b8",
                  } as React.CSSProperties
                }
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full
                border px-3 text-[13px] font-semibold whitespace-nowrap
                lowercase transition active:scale-95 ${
                  on
                    ? `border-(--cat)
                      bg-[color-mix(in_oklab,var(--cat)_20%,var(--card))]
                      text-foreground`
                    : "border-transparent text-muted-foreground"
                }`}
              >
                <span
                  className="size-2 rounded-full bg-(--cat)"
                  aria-hidden="true"
                />
                {category.name}
              </button>
            );
          })}
        </div>

        {recentBorrowers.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center justify-between px-1">
              <p
                className="text-[11px] font-bold tracking-wider
                  text-muted-foreground uppercase"
              >
                Recently visited
              </p>
              <button
                type="button"
                onClick={() => {
                  setRecentBorrowers([]);
                  clearRecentBorrowers();
                }}
                className="text-[11px] font-bold text-muted-foreground
                  transition hover:text-rose-500"
              >
                clear
              </button>
            </div>
            <div
              className="-mx-3 -mt-1.5 flex gap-2 overflow-x-auto px-3.5 pt-2.5
                pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6
                [&::-webkit-scrollbar]:hidden"
            >
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
                    style={
                      {
                        "--cat": b.categoryColor ?? "#94a3b8",
                      } as React.CSSProperties
                    }
                    className="flex w-16 shrink-0 flex-col items-center gap-1
                      active:scale-95"
                  >
                    <span
                      className="relative flex size-12 items-center
                        justify-center rounded-full
                        bg-[color-mix(in_oklab,var(--cat)_22%,var(--card))]
                        text-sm font-black
                        text-[color-mix(in_oklab,var(--cat)_45%,var(--foreground))]
                        ring-2 ring-(--cat)"
                    >
                      {initials}
                      {b.visitCount > 1 && (
                        <span
                          className="absolute -top-1 -right-1 flex h-4 min-w-4
                            items-center justify-center rounded-full
                            bg-foreground px-1 text-[9px] font-black
                            text-background"
                          aria-label={`${b.visitCount} visits`}
                        >
                          {b.visitCount}
                        </span>
                      )}
                    </span>
                    <span
                      className="w-full truncate text-center text-[11px]
                        font-semibold lowercase"
                    >
                      {b.first_name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {sortedBorrowers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              safeCategoryIds.length > 0
                ? "No matches found"
                : "No borrowers yet"
            }
            description={
              safeCategoryIds.length > 0
                ? "Try clearing the category filters."
                : "Add your first borrower to start tracking loans and collections."
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {sortedBorrowers.map((borrower) => (
              <BorrowerRowCard
                key={borrower.id}
                onVisit={recordVisit}
                {...buildBorrowerScheduleCardProps(borrower)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
