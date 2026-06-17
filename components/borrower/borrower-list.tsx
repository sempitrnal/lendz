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
import { useSeedBorrowersSearch } from "@/hooks/use-borrowers-search";

import AddBorrowerModal from "./add-borrower-modal";
import { BorrowerCard } from "./borrower-card";
import { BsChevronDown } from "react-icons/bs";
import { BsChevronUp } from "react-icons/bs";
import { FaPlus } from "react-icons/fa6";
import {
  Users,
  ClipboardList,
  Activity,
  Calendar,
  CheckCircle2,
  Banknote,
  Heart,
  AlertTriangle,
  ArrowUpDown,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PullToRefresh } from "@/components/pull-to-refresh";
import Link from "next/link";
import { isDarkColor } from "@/lib/utils";

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
  newlyCreatedBorrowers?: Borrower[];
  newlyCreatedAccounts?: RecentAccount[];
  recentAccountUpdates?: AccountUpdate[];
};

export default function BorrowersList({
  allBorrowers,
  initialCategoryIds = [],
  newlyCreatedBorrowers = [],
  newlyCreatedAccounts = [],
  recentAccountUpdates = [],
}: BorrowersListProps) {
  const router = useRouter();
  const seedBorrowersSearch = useSeedBorrowersSearch();

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
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    initialCategoryIds ?? [],
  );

  // Sync local state when server prop changes (e.g. back/forward navigation)
  useEffect(() => {
    setSelectedCategoryIds((initialCategoryIds as string[] | undefined) ?? []);
  }, [initialCategoryIds]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isAddBorrowerModalOpen, setIsAddBorrowerModalOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
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

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set([
      "newly-created-borrowers",
      "newly-created-accounts",
      "payment-updates",
    ]),
  );

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

  // Sort helpers
  function getTotalPrincipal(b: Borrower): number {
    const autoPrincipal = (b.account_schedules ?? []).reduce(
      (sum, s) => sum + (s.principal_amount ?? 0),
      0,
    );
    return autoPrincipal + (b.manual_total_principal ?? 0);
  }

  function getCompletionRatio(b: Borrower): number {
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

    if (totalWeight === 0) return 0;

    const autoRatio = autoTotal > 0 ? autoPaid / autoTotal : 0;
    const manualRatio =
      manualPrincipal > 0 ? Math.min(1, manualPaid / manualPrincipal) : 0;

    return (autoRatio * autoWeight + manualRatio * manualWeight) / totalWeight;
  }

  const SORT_OPTIONS: {
    value: SortMode;
    label: string;
    icon: React.ElementType;
  }[] = [
    { value: "default", label: "Default", icon: ArrowUpDown },
    { value: "most-loyal", label: "Most Loyal", icon: Heart },
    { value: "most-accounts", label: "Most Accounts", icon: Users },
    { value: "biggest-borrower", label: "Biggest Borrower", icon: Banknote },
    { value: "almost-there", label: "Almost There", icon: CheckCircle2 },
    { value: "most-overdue", label: "Most Overdue", icon: Activity },
    { value: "newest-member", label: "Newest Member", icon: Calendar },
    { value: "highest-risk", label: "Highest Risk", icon: AlertTriangle },
  ];

  const sortedBorrowers = useMemo(() => {
    if (sortMode === "default") return filteredBorrowers;

    const hasAccounts = (b: Borrower) => (b.accounts_count ?? 0) > 0;

    return [...filteredBorrowers].sort((a, b) => {
      switch (sortMode) {
        case "most-loyal":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "most-accounts":
          return (b.accounts_count ?? 0) - (a.accounts_count ?? 0);
        case "biggest-borrower": {
          const totalA = getTotalPrincipal(a);
          const totalB = getTotalPrincipal(b);
          if (totalB !== totalA) return totalB - totalA;
          return (b.accounts_count ?? 0) - (a.accounts_count ?? 0);
        }
        case "almost-there": {
          const hasA = hasAccounts(a);
          const hasB = hasAccounts(b);
          if (hasA && !hasB) return -1;
          if (!hasA && hasB) return 1;
          if (!hasA && !hasB) return 0;
          return getCompletionRatio(b) - getCompletionRatio(a);
        }
        case "most-overdue":
          return (b.overdue_count ?? 0) - (a.overdue_count ?? 0);
        case "newest-member":
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case "highest-risk": {
          const totalA = getTotalPrincipal(a);
          const totalB = getTotalPrincipal(b);
          const riskA = totalA > 0 ? (a.overdue_total ?? 0) / totalA : -1;
          const riskB = totalB > 0 ? (b.overdue_total ?? 0) / totalB : -1;
          return riskB - riskA;
        }
        default:
          return 0;
      }
    });
  }, [filteredBorrowers, sortMode]);

  const openBorrower = useCallback(
    (borrower: Borrower) => {
      sessionStorage.setItem("borrowers-list-scroll", String(window.scrollY));
      recordVisit({
        id: borrower.id,
        first_name: borrower.first_name,
        last_name: borrower.last_name,
        categoryColor:
          borrower.borrower_categories?.[0]?.category?.color ?? null,
      });
      router.push(`/borrowers/${borrower.id}`);
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
            className="dark:border-border dark:text-background fixed right-4
              bottom-[76px] z-40 flex size-14 items-center justify-center
              rounded-full border-2 border-slate-900 bg-green-400 text-slate-600
              shadow-[3px_3px_0px_0px_rgb(15_23_42/0.4)] transition-transform
              duration-200 active:scale-95 dark:bg-green-400
              dark:shadow-[3px_3px_0px_0px_rgb(0_0_0/0.5)]"
          >
            <FaPlus className="size-5" />
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
              items-center justify-between gap-3 rounded-xl border-2
              border-slate-900/90 px-4 py-3 text-left
              shadow-[2px_2px_0px_0px_rgb(15_23_42/0.85)] transition
              active:translate-y-px
              active:shadow-[1px_1px_0px_0px_rgb(15_23_42/0.85)]
              dark:shadow-none"
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
                justify-center rounded-lg border border-slate-900/20 bg-slate-50
                text-slate-700"
            >
              <BsChevronDown
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
                max-h-72 w-full overflow-y-auto rounded-xl border-2
                border-slate-900/90 bg-white p-2
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

      {/* Recent Activities Section */}
      <section className="mb-6">
        <article className="">
          <div className="mb-4 flex items-center gap-2">
            <span
              className="rounded-md border-2 border-slate-900 bg-indigo-200
                p-1.5 text-slate-600 dark:border-slate-700 dark:bg-indigo-400
                dark:text-slate-600"
            >
              <ClipboardList className="size-4" />
            </span>
            <h2
              className="text-base font-black text-slate-600 lowercase
                dark:text-white"
            >
              recent activities
            </h2>
          </div>

          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Newly Created Borrowers */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection("newly-created-borrowers")}
                className="mb-3 inline-flex cursor-pointer items-center gap-1.5
                  rounded-lg border border-slate-900 bg-white px-3 py-1.5
                  text-[10px] font-black tracking-wider text-slate-600 uppercase
                  shadow-[2px_2px_0px_0px_#0f172a] transition
                  hover:-translate-y-px sm:mb-3 dark:border-slate-600
                  dark:bg-slate-800 dark:text-white dark:shadow-none
                  select-none"
              >
                <Users className="size-3.5" />
                newly created borrowers
                {collapsedSections.has("newly-created-borrowers") ? (
                  <BsChevronDown className="size-3" />
                ) : (
                  <BsChevronUp className="size-3" />
                )}
              </button>
              <div
                className={`grid transition-all duration-300 ease-out ${
                  collapsedSections.has("newly-created-borrowers")
                    ? "grid-rows-[0fr]"
                    : "grid-rows-[1fr]"
                  }`}
              >
                <div className="overflow-hidden">
                  <div
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3
                      md:grid-cols-3"
                  >
                    {newlyCreatedBorrowers.length === 0 ? (
                      <div
                        className="rounded-xl border border-dashed
                          border-slate-300 bg-slate-50 p-3 text-sm font-medium
                          text-slate-500 sm:rounded-lg sm:border-2
                          sm:border-dashed sm:border-slate-400
                          dark:border-slate-600 dark:bg-slate-800/50
                          dark:text-slate-400"
                      >
                        No recent borrowers created.
                      </div>
                    ) : (
                      newlyCreatedBorrowers.map((borrower) => {
                        const categoryMeta = getCategoryMeta(borrower);
                        return (
                          <div
                            key={borrower.id}
                            className="mb-2 rounded-lg border-2 border-slate-900
                              bg-white transition-all dark:border-border
                              dark:bg-card"
                          >
                            <Link
                              href={`/borrowers/${borrower.id}`}
                              className="flex h-full flex-col outline-none"
                              onClick={() =>
                                recordVisit({
                                  id: borrower.id,
                                  first_name: borrower.first_name,
                                  last_name: borrower.last_name,
                                  categoryColor: categoryMeta.color ?? null,
                                })
                              }
                            >
                              <div className="flex flex-1 flex-col p-2 sm:p-3">
                                <span
                                  className="block text-xl font-bold
                                    text-slate-700 lowercase
                                    dark:text-foreground"
                                >
                                  {borrower.first_name} {borrower.last_name}
                                </span>
                                {borrower.contact && (
                                  <p
                                    className="text-[11px] font-semibold
                                      text-slate-600 sm:text-xs
                                      dark:text-slate-300"
                                  >
                                    {borrower.contact}
                                  </p>
                                )}
                                <span
                                  className="mt-1 inline-flex w-fit items-center
                                    gap-1.5 rounded-full border
                                    border-slate-900/15 px-2.5 py-0.5
                                    text-[10px] font-bold uppercase
                                    dark:border-border/40"
                                >
                                  <span
                                    className="size-2 shrink-0 rounded-full
                                      border border-slate-900/15"
                                    style={{
                                      backgroundColor:
                                        categoryMeta.color ?? "#cbd5e1",
                                    }}
                                  />
                                  {categoryMeta.label}
                                </span>
                              </div>
                              <div
                                className="border-t mt-2 rounded-b-lg
                                  border-slate-100 bg-slate-50 p-2 text-[11px]
                                  font-medium text-slate-600
                                  dark:border-border/50 dark:bg-muted/40
                                  dark:text-muted-foreground"
                              >
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="size-3 shrink-0" />
                                  Added{" "}
                                  {formatActivityDate(
                                    borrower.created_at || "",
                                  )}
                                </span>
                              </div>
                            </Link>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Newly Created Accounts */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection("newly-created-accounts")}
                className="mb-3 inline-flex cursor-pointer items-center gap-1.5
                  rounded-lg border border-slate-900 bg-white px-3 py-1.5
                  text-[10px] font-black tracking-wider text-slate-600 uppercase
                  shadow-[2px_2px_0px_0px_#0f172a] transition
                  hover:-translate-y-px sm:mb-3 dark:border-slate-600
                  dark:bg-slate-800 dark:text-white dark:shadow-none
                  select-none"
              >
                <ClipboardList className="size-3.5" />
                newly created accounts
                {collapsedSections.has("newly-created-accounts") ? (
                  <BsChevronDown className="size-3" />
                ) : (
                  <BsChevronUp className="size-3" />
                )}
              </button>
              <div
                className={`grid transition-all duration-300 ease-out ${
                  collapsedSections.has("newly-created-accounts")
                    ? "grid-rows-[0fr]"
                    : "grid-rows-[1fr]"
                  }`}
              >
                <div className="overflow-hidden">
                  <div
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3
                      md:grid-cols-3"
                  >
                    {newlyCreatedAccounts.length === 0 ? (
                      <div
                        className="rounded-xl border border-dashed
                          border-slate-300 bg-slate-50 p-3 text-sm font-medium
                          text-slate-500 sm:rounded-lg sm:border-2
                          sm:border-dashed sm:border-slate-400
                          dark:border-slate-600 dark:bg-slate-800/50
                          dark:text-slate-400"
                      >
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
                            className="mb-2 rounded-lg border-2 border-slate-900
                              bg-white transition-all dark:border-border
                              dark:bg-card"
                          >
                            <Link
                              href={`/accounts/${account.id}`}
                              className="flex h-full flex-col outline-none"
                            >
                              <div className="flex flex-1 flex-col p-2 sm:p-3">
                                <div
                                  className="flex items-start justify-between
                                    gap-2"
                                >
                                  <span
                                    className="block text-xl font-bold
                                      text-slate-700 lowercase
                                      dark:text-foreground"
                                  >
                                    {borrowerObj
                                      ? `${borrowerObj.first_name} ${borrowerObj.last_name}`
                                      : "Unknown borrower"}
                                  </span>
                                  <span
                                    className={`min-w-0 truncate rounded-md px-2
                                      py-0.5 text-[10px] font-black uppercase
                                      ${typeBadgeBg}`}
                                  >
                                    {typeLabel}
                                  </span>
                                </div>
                                <div
                                  className="mt-1.5 flex items-baseline gap-1.5"
                                >
                                  <span
                                    className="text-xs font-bold text-slate-600
                                      dark:text-foreground"
                                  >
                                    ₱
                                    {(
                                      account.principal_amount ?? 0
                                    ).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                              <div
                                className="border-t mt-2 rounded-b-lg
                                  border-slate-100 bg-slate-50 p-2 text-[11px]
                                  font-medium text-slate-600
                                  dark:border-border/50 dark:bg-muted/40
                                  dark:text-muted-foreground"
                              >
                                <div className="flex flex-col gap-1.5">
                                  <span className="flex items-center gap-1.5">
                                    <Calendar className="size-3 shrink-0" />
                                    Created{" "}
                                    {formatActivityDate(account.created_at)}
                                  </span>
                                  {account.release_date && (
                                    <span className="flex items-center gap-1.5">
                                      <CheckCircle2
                                        className="size-3 shrink-0
                                          text-emerald-600
                                          dark:text-emerald-400"
                                      />
                                      Released{" "}
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
              </div>
            </div>

            {/* Payment Updates */}
            <div>
              <button
                type="button"
                onClick={() => toggleSection("payment-updates")}
                className="mb-3 inline-flex cursor-pointer items-center gap-1.5
                  rounded-lg border border-slate-900 bg-white px-3 py-1.5
                  text-[10px] font-black tracking-wider text-slate-600 uppercase
                  shadow-[2px_2px_0px_0px_#0f172a] transition
                  hover:-translate-y-px sm:mb-3 dark:border-slate-600
                  dark:bg-slate-800 dark:text-white dark:shadow-none
                  select-none"
              >
                <Activity className="size-3.5" />
                payment updates
                {collapsedSections.has("payment-updates") ? (
                  <BsChevronDown className="size-3" />
                ) : (
                  <BsChevronUp className="size-3" />
                )}
              </button>
              <div
                className={`grid transition-all duration-300 ease-out ${
                  collapsedSections.has("payment-updates")
                    ? "grid-rows-[0fr]"
                    : "grid-rows-[1fr]"
                  }`}
              >
                <div className="overflow-hidden">
                  <div
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3
                      md:grid-cols-3"
                  >
                    {recentAccountUpdates.length === 0 ? (
                      <div
                        className="rounded-xl border border-dashed
                          border-slate-300 bg-slate-50 p-3 text-sm font-medium
                          text-slate-500 sm:rounded-lg sm:border-2
                          sm:border-dashed sm:border-slate-400
                          dark:border-slate-600 dark:bg-slate-800/50
                          dark:text-slate-400"
                      >
                        No recent payment updates.
                      </div>
                    ) : (
                      recentAccountUpdates.map((update) => {
                        const meta = update.metadata ?? {};
                        const accountObj = update.account
                          ? Array.isArray(update.account)
                            ? update.account[0]
                            : update.account
                          : null;
                        const borrowerRaw = accountObj?.borrower;
                        const borrower = borrowerRaw
                          ? Array.isArray(borrowerRaw)
                            ? borrowerRaw[0]
                            : borrowerRaw
                          : null;
                        const borrowerName = borrower
                          ? `${borrower.first_name} ${borrower.last_name}`
                          : "Unknown borrower";

                        // Determine paid state for badge + display
                        const statusVal = meta.status || meta.newStatus || "";
                        const isPaid =
                          statusVal === "paid" ||
                          update.action === "schedule.batch_paid";
                        const isPartial = statusVal === "partial";

                        const badgeStyle = isPaid
                          ? {
                              label: "Paid",
                              bg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
                            }
                          : isPartial
                            ? {
                                label: "Partial",
                                bg: "bg-purple-100 text-amber-800 dark:bg-purple-900/60 dark:text-amber-200",
                              }
                            : {
                                label: update.action.replace(/.*\./, ""),
                                bg: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
                              };

                        // Extract display fields
                        let amountLine: string | null = null;
                        let dueDate: string | null = null;
                        let paidDate: string | null = null;
                        let remaining: number | null = null;

                        if (update.action === "schedule.payment_applied") {
                          const amt = Number(meta.amount ?? 0);
                          if (amt > 0) amountLine = `₱${amt.toLocaleString()}`;
                          dueDate = (meta.due_date as string) || null;
                          paidDate = (meta.paymentDate as string) || null;
                          const rem = Number(meta.remaining_amount ?? 0);
                          if (rem > 0) remaining = rem;
                        } else if (
                          update.action === "schedule.status_changed"
                        ) {
                          const due = Number(meta.amount_due ?? 0);
                          if (due > 0) amountLine = `₱${due.toLocaleString()}`;
                          dueDate = (meta.due_date as string) || null;
                          paidDate = (meta.paid_date as string) || null;
                          const rem = Number(meta.remaining_amount ?? 0);
                          if (rem > 0) remaining = rem;
                        } else if (update.action === "schedule.batch_paid") {
                          const ids = meta.ids as string[] | undefined;
                          const count = ids?.length ?? 0;
                          if (count > 0)
                            amountLine = `${count} schedule${count === 1 ? "" : "s"}`;
                          paidDate = (meta.customDate as string) || null;
                        }

                        if (!amountLine && !dueDate && !paidDate) {
                          amountLine = update.description;
                        }

                        const content = (
                          <div className="flex flex-1 flex-col p-2 sm:p-3">
                            <div
                              className="flex items-start justify-between gap-2"
                            >
                              <span
                                className="block text-xl font-bold
                                  text-slate-700 lowercase dark:text-foreground"
                              >
                                {borrowerName}
                              </span>
                              <span
                                className={`shrink-0 rounded-md px-2 py-0.5
                                  text-[10px] font-black uppercase
                                  ${badgeStyle.bg}`}
                              >
                                {badgeStyle.label}
                              </span>
                            </div>
                            {amountLine && (
                              <p
                                className="mt-1 text-sm font-bold text-slate-600
                                  dark:text-foreground"
                              >
                                {amountLine}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                              {dueDate && (
                                <span
                                  className="flex items-center gap-1 text-[11px]
                                    font-medium text-slate-500
                                    dark:text-slate-400"
                                >
                                  <Calendar className="size-3" />
                                  Due {formatActivityDate(dueDate)}
                                </span>
                              )}
                              {paidDate && (
                                <span
                                  className="flex items-center gap-1 text-[11px]
                                    font-medium text-slate-500
                                    dark:text-slate-400"
                                >
                                  <Banknote className="size-3" />
                                  Paid {formatActivityDate(paidDate)}
                                </span>
                              )}
                              {remaining !== null && remaining > 0 && (
                                <span
                                  className="flex items-center gap-1 text-[11px]
                                    font-medium text-slate-500
                                    dark:text-slate-400"
                                >
                                  ₱{remaining.toLocaleString()} remaining
                                </span>
                              )}
                            </div>
                          </div>
                        );

                        return (
                          <div
                            key={update.id}
                            className="mb-2 rounded-lg border-2 border-slate-900
                              bg-white transition-all dark:border-border
                              dark:bg-card"
                          >
                            {update.account_id ? (
                              <Link
                                href={`/accounts/${update.account_id}`}
                                className="flex h-full flex-col outline-none"
                                onClick={() => {
                                  if (borrower) {
                                    recordVisit({
                                      id:
                                        borrower.id || update.account_id || "",
                                      first_name: borrower.first_name,
                                      last_name: borrower.last_name,
                                      categoryColor: null,
                                    });
                                  }
                                }}
                              >
                                {content}
                                <div
                                  className="border-t mt-2 rounded-b-lg
                                    border-slate-100 bg-slate-50 p-2 text-[11px]
                                    font-medium text-slate-600
                                    dark:border-border/50 dark:bg-muted/40
                                    dark:text-muted-foreground"
                                >
                                  <span className="flex items-center gap-1.5">
                                    <Activity className="size-3" />
                                    {formatActivityDate(update.created_at)}
                                  </span>
                                </div>
                              </Link>
                            ) : (
                              <div className="flex h-full flex-col">
                                {content}
                                <div
                                  className="border-t mt-2 rounded-b-lg
                                    border-slate-100 bg-slate-50 p-2 text-[11px]
                                    font-medium text-slate-600
                                    dark:border-border/50 dark:bg-muted/40
                                    dark:text-muted-foreground"
                                >
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
            </div>
          </div>
        </article>
      </section>

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

        {/* Sort Dropdown */}
        <div className="relative w-full max-w-[240px]">
          <button
            type="button"
            aria-expanded={isSortDropdownOpen}
            aria-haspopup="listbox"
            onClick={() => setIsSortDropdownOpen((prev) => !prev)}
            className="dark:border-border dark:hover:bg-muted flex w-full
              items-center justify-between gap-3 rounded-xl border-2
              border-slate-900/90 px-4 py-2.5 text-left
              shadow-[2px_2px_0px_0px_rgb(15_23_42/0.85)] transition
              active:translate-y-px
              active:shadow-[1px_1px_0px_0px_rgb(15_23_42/0.85)]
              dark:shadow-none"
          >
            <span className="flex items-center gap-2">
              {(() => {
                const opt = SORT_OPTIONS.find((o) => o.value === sortMode);
                const Icon = opt?.icon;
                return (
                  <>
                    {Icon && <Icon className="size-4" />}
                    <span
                      className="dark:text-foreground text-sm font-bold
                        tracking-wide text-slate-600 uppercase"
                    >
                      {opt?.label ?? "Default"}
                    </span>
                  </>
                );
              })()}
            </span>

            <span
              className="dark:border-border dark:bg-muted
                dark:text-muted-foreground flex size-8 shrink-0 items-center
                justify-center rounded-lg border border-slate-900/20 bg-slate-50
                text-slate-700"
            >
              <BsChevronDown
                className={`size-3.5 transition-transform
                  ${isSortDropdownOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </span>
          </button>

          {isSortDropdownOpen ? (
            <div
              role="listbox"
              className="dark:border-border dark:bg-card absolute right-0 z-20
                mt-2 max-h-80 w-72 overflow-y-auto rounded-xl border-2
                border-slate-900/90 bg-white p-2
                shadow-[3px_3px_0px_0px_rgb(15_23_42/0.18)] dark:shadow-none"
            >
              <div className="flex flex-col gap-1.5">
                {SORT_OPTIONS.map((option) => {
                  const isSelected = sortMode === option.value;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        setSortMode(option.value);
                        setIsSortDropdownOpen(false);
                      }}
                      className={`flex items-center gap-2.5 rounded-lg border
                        px-3 py-2.5 text-left text-sm font-semibold transition
                        ${
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
                      {Icon && (
                        <span
                          className={`flex size-7 shrink-0 items-center
                            justify-center rounded-md border-2 ${
                              isSelected
                                ? "border-white/30 bg-white/15"
                                : "border-slate-900/15 bg-slate-100"
                            }`}
                        >
                          <Icon className="size-3.5" />
                        </span>
                      )}
                      <span className="truncate">{option.label}</span>
                      {isSelected ? (
                        <span
                          className="ml-auto shrink-0 text-xs font-black"
                          aria-hidden
                        >
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
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
            borrowers={sortedBorrowers}
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
