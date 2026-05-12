"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { formFieldInputClassName } from "@/lib/form-field-classes";
import {
  mapAccountIdToNextDueSchedule,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import AddBorrowerModal from "./add-borrower-modal";
import { BorrowerCard } from "./borrower-card";
import { BsChevronDown, BsChevronLeft, BsChevronRight } from "react-icons/bs";
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
  has_accounts?: boolean;
};

type BorrowersListProps = {
  initialBorrowers: Borrower[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  initialSearchQuery?: string;
  initialCategoryIds?: string[];
};

function buildBorrowersUrl(page: number, q: string, categoryIds: string[] = []): string {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (q) params.set("q", q);
  if (categoryIds.length > 0) params.set("categories", categoryIds.join(","));
  const qs = params.toString();
  return `/borrowers${qs ? `?${qs}` : ""}`;
}

export default function BorrowersList({
  initialBorrowers,
  currentPage,
  totalPages,
  totalCount,
  initialSearchQuery = "",
  initialCategoryIds = [],
}: BorrowersListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(initialCategoryIds);

  const navigateSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        router.push(buildBorrowersUrl(1, q, selectedCategoryIds));
      }, 400);
    },
    [router, selectedCategoryIds]
  );

  // Sync local state when server prop changes (e.g. back/forward navigation)
  useEffect(() => {
    setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery]);
  useEffect(() => {
    setSelectedCategoryIds(initialCategoryIds);
  }, [initialCategoryIds]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isAddBorrowerModalOpen, setIsAddBorrowerModalOpen] = useState(false);
  const [updatingBorrowerId, setUpdatingBorrowerId] = useState<string | null>(
    null
  );

  function openAddBorrowerModal() {
    setIsAddBorrowerModalOpen(true);
  }
  function closeAddBorrowerModal() {
    setIsAddBorrowerModalOpen(false);
  }

  function refreshPage() {
    router.refresh();
  }

  const markNextPaymentPaid = async (borrower: Borrower) => {
    setUpdatingBorrowerId(borrower.id);

    const { data: accountRows, error: accountsError } = await supabase
      .from("accounts")
      .select("id")
      .eq("borrower_id", borrower.id);
    const accountIds = (accountRows ?? []).map((row) => row.id);

    if (accountsError) {
      setUpdatingBorrowerId(null);
      toast.error(accountsError.message);
      return;
    }
    if (accountIds.length === 0) {
      setUpdatingBorrowerId(null);
      toast.info("No accounts found for this borrower.");
      return;
    }

    const { data: scheduleData, error: scheduleError } = await supabase
      .from("payment_schedules")
      .select(
        "id, account_id, due_date, amount_due, amount_paid, remaining_amount, status"
      )
      .in("account_id", accountIds)
      .order("due_date", { ascending: true })
      .order("id", { ascending: true });

    if (scheduleError) {
      setUpdatingBorrowerId(null);
      toast.error(scheduleError.message);
      return;
    }

    type ScheduleRow = {
      id: string;
      account_id: string;
      due_date: string;
      amount_due: number | null;
      amount_paid: number | null;
      remaining_amount: number | null;
      status: string;
    };
    const nextSchedulesByAccount = mapAccountIdToNextDueSchedule(
      (scheduleData ?? []) as ScheduleRow[]
    );

    const nextSchedules = Array.from(nextSchedulesByAccount.values());
    if (nextSchedules.length === 0) {
      setUpdatingBorrowerId(null);
      toast.info("No unpaid schedules found.");
      return;
    }

    for (const schedule of nextSchedules) {
      const due = Number(schedule.amount_due ?? 0);
      const { error: oneError } = await supabase
        .from("payment_schedules")
        .update({
          status: "paid",
          amount_paid: due,
          remaining_amount: 0,
        })
        .eq("id", schedule.id);
      if (oneError) {
        setUpdatingBorrowerId(null);
        toast.error(oneError.message);
        return;
      }
    }

    setUpdatingBorrowerId(null);

    const totalUpdatedAmount = nextSchedules.reduce(
      (sum, schedule) => sum + remainingOnInstallment(schedule),
      0
    );
    toast.success(
      `Marked ${nextSchedules.length} next schedule${nextSchedules.length === 1 ? "" : "s"} as paid across ${nextSchedulesByAccount.size} account${nextSchedulesByAccount.size === 1 ? "" : "s"} (PHP ${totalUpdatedAmount.toLocaleString()}) for ${borrower.first_name} ${borrower.last_name}.`
    );
    router.refresh();
  };

  const navigateCategories = useCallback(
    (newCategoryIds: string[]) => {
      router.push(buildBorrowersUrl(1, searchQuery.trim(), newCategoryIds));
    },
    [router, searchQuery]
  );

  const [categories, setCategories] = useState<
    { id: string; name: string; color: string | null }[]
  >([]);

  useEffect(() => {
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, color")
        .order("name", { ascending: true });

      if (!error) {
        setCategories(
          (data ?? []) as { id: string; name: string; color: string | null }[]
        );
      }
    };

    loadCategories();
  }, []);

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
          <h1 className="text-2xl font-black lowercase">Borrowers</h1>
          <p className="text-xs text-slate-500 mt-1">
            {totalCount} total
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            navigateSearch(e.target.value.trim());
          }}
          placeholder="Search by name or contact"
          className={formFieldInputClassName}
          aria-label="Search borrowers"
        />

        <div className="relative">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Categories
          </p>
          <button
            type="button"
            aria-expanded={isCategoryDropdownOpen}
            aria-haspopup="listbox"
            onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-slate-900/90 bg-white px-4 py-3 text-left shadow-[2px_2px_0px_0px_rgb(15_23_42/0.85)] transition hover:bg-slate-50/90 active:translate-y-px active:shadow-[1px_1px_0px_0px_rgb(15_23_42/0.85)]"
          >
            <span className="text-sm font-bold uppercase tracking-wide text-slate-900">
              {selectedCategoryIds.length > 0
                ? `${selectedCategoryIds.length} selected`
                : "All categories"}
            </span>

            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-900/20 bg-slate-50 text-slate-700">
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
              className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border-2 border-slate-900/90 bg-white p-2 shadow-[3px_3px_0px_0px_rgb(15_23_42/0.18)]"
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
                          ? selectedCategoryIds.filter((id) => id !== category.id)
                          : [...selectedCategoryIds, category.id];
                        setSelectedCategoryIds(next);
                        navigateCategories(next);
                      }}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${isSelected
                          ? "border-2 border-slate-900 bg-slate-900 text-white shadow-[1px_1px_0px_0px_rgb(15_23_42/0.5)]"
                          : "border border-slate-900/15 bg-slate-50/60 text-slate-800 shadow-[1px_1px_0px_0px_rgb(15_23_42/0.08)] hover:border-slate-900/35 hover:bg-white"
                        }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="size-3 shrink-0 rounded-full border-2 border-slate-900/25"
                          style={{
                            backgroundColor: category.color ?? "#cbd5e1",
                          }}
                        />

                        <span className="truncate capitalize">{category.name}</span>
                      </div>

                      {isSelected ? (
                        <span className="shrink-0 text-xs font-black" aria-hidden>
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {selectedCategoryIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryIds([]);
                    navigateCategories([]);
                  }}
                  className="mt-2 w-full rounded-lg border-2 border-rose-800/35 bg-rose-50 px-3 py-2 text-center text-xs font-black uppercase tracking-wide text-rose-900 shadow-[1px_1px_0px_0px_rgb(190_18_60/0.25)] transition hover:bg-rose-100/90"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {initialBorrowers.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-gray-500">
            {selectedCategoryIds.length > 0 || searchQuery.trim()
              ? "No borrowers match the current search and category filters."
              : "No borrowers yet"}
          </p>
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 *:min-w-0">
          {initialBorrowers.map((borrower) => (
            <BorrowerCard
              key={borrower.id}
              borrower={borrower}
              showScheduleSummary
              onBorrowerUpdated={refreshPage}
              isMarkingNextPaid={updatingBorrowerId === borrower.id}
              onMarkNextPaid={() => {
                void markNextPaymentPaid(borrower);
              }}
            />
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-8 flex items-center justify-center gap-2"
        >
          {currentPage > 1 ? (
            <Link
              href={buildBorrowersUrl(currentPage - 1, initialSearchQuery, selectedCategoryIds)}
              className="flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:bg-slate-50 active:translate-y-0 active:shadow-[1px_1px_0px_0px_#0f172a]"
            >
              <BsChevronLeft className="size-3" aria-hidden />
              Prev
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg border-2 border-slate-300 bg-slate-100 px-3 py-2 text-sm font-bold text-slate-400 cursor-not-allowed">
              <BsChevronLeft className="size-3" aria-hidden />
              Prev
            </span>
          )}

          <span className="rounded-lg border-2 border-slate-900 bg-slate-900 px-4 py-2 text-sm font-black tabular-nums text-white shadow-[2px_2px_0px_0px_rgb(15_23_42/0.3)]">
            {currentPage} / {totalPages}
          </span>

          {currentPage < totalPages ? (
            <Link
              href={buildBorrowersUrl(currentPage + 1, initialSearchQuery, selectedCategoryIds)}
              className="flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:bg-slate-50 active:translate-y-0 active:shadow-[1px_1px_0px_0px_#0f172a]"
            >
              Next
              <BsChevronRight className="size-3" aria-hidden />
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg border-2 border-slate-300 bg-slate-100 px-3 py-2 text-sm font-bold text-slate-400 cursor-not-allowed">
              Next
              <BsChevronRight className="size-3" aria-hidden />
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
