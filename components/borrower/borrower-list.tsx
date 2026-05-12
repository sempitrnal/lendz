"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { computeBorrowerNextCollectionById } from "@/lib/compute-borrower-next-collection";
import { supabase } from "@/lib/supabase/client";
import { formFieldInputClassName } from "@/lib/form-field-classes";
import {
  isInstallmentFullyPaid,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import AddBorrowerModal from "./add-borrower-modal";
import { BorrowerCard } from "./borrower-card";
import { BsChevronDown } from "react-icons/bs";

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

export default function BorrowersList() {
  const PAYMENT_SCHEDULE_PAGE_SIZE = 1000;
  const ACCOUNT_ID_CHUNK_SIZE = 120;
  const router = useRouter();
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
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

  async function enrichBorrowersWithNextCollection(
    rows: Borrower[]
  ): Promise<Borrower[]> {
    if (rows.length === 0) return rows;
    const borrowerIds = rows.map((b) => b.id);

    const { data: accountRows, error: accountsError } = await supabase
      .from("accounts")
      .select("id, borrower_id")
      .in("borrower_id", borrowerIds);

    if (accountsError) {
      console.error(accountsError);
      return rows.map((b) => ({
        ...b,
        has_accounts: false,
        next_collection_date: null,
        next_collection_amount: 0,
      }));
    }

    const accounts = accountRows ?? [];
    const accountIdsByBorrower = new Map<string, string[]>();
    for (const a of accounts) {
      const bid = a.borrower_id as string;
      const list = accountIdsByBorrower.get(bid) ?? [];
      list.push(a.id as string);
      accountIdsByBorrower.set(bid, list);
    }

    const allAccountIds = accounts.map((a) => a.id as string);
    if (allAccountIds.length === 0) {
      return rows.map((b) => ({
        ...b,
        has_accounts: false,
        next_collection_date: null,
        next_collection_amount: 0,
      }));
    }

    const schedules: Array<{
      account_id: string;
      due_date: string;
      amount_due: number | null;
      amount_paid: number | null;
      remaining_amount: number | null;
      status: string;
    }> = [];
    let hasScheduleError = false;

    for (let c = 0; c < allAccountIds.length; c += ACCOUNT_ID_CHUNK_SIZE) {
      const accountChunk = allAccountIds.slice(c, c + ACCOUNT_ID_CHUNK_SIZE);
      let from = 0;

      for (;;) {
        const { data: pageRows, error: scheduleError } = await supabase
          .from("payment_schedules")
          .select(
            "id, account_id, due_date, amount_due, amount_paid, remaining_amount, status"
          )
          .in("account_id", accountChunk)
          .order("due_date", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + PAYMENT_SCHEDULE_PAGE_SIZE - 1);

        if (scheduleError) {
          console.error(scheduleError);
          hasScheduleError = true;
          break;
        }

        const rowsInPage = (pageRows ?? []) as Array<{
          account_id: string;
          due_date: string;
          amount_due: number | null;
          amount_paid: number | null;
          remaining_amount: number | null;
          status: string;
        }>;
        schedules.push(...rowsInPage);

        if (rowsInPage.length < PAYMENT_SCHEDULE_PAGE_SIZE) {
          break;
        }

        from += PAYMENT_SCHEDULE_PAGE_SIZE;
      }

      if (hasScheduleError) {
        break;
      }
    }

    if (hasScheduleError) {
      return rows.map((b) => ({
        ...b,
        has_accounts: (accountIdsByBorrower.get(b.id)?.length ?? 0) > 0,
        next_collection_date: null,
        next_collection_amount: 0,
      }));
    }

    const nextById = computeBorrowerNextCollectionById(
      borrowerIds,
      accounts as Array<{ id: string; borrower_id: string }>,
      schedules
    );

    return rows.map((b) => {
      const accIds = accountIdsByBorrower.get(b.id) ?? [];
      const n = nextById[b.id] ?? {
        next_collection_date: null,
        next_collection_amount: 0,
      };
      return {
        ...b,
        has_accounts: accIds.length > 0,
        next_collection_date: n.next_collection_date,
        next_collection_amount: n.next_collection_amount,
        next_collection_amounts: n.next_collection_amounts,
      };
    });
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

    const nextSchedulesByAccount = new Map<
      string,
      {
        id: string;
        due_date: string;
        amount_due: number | null;
        amount_paid: number | null;
        remaining_amount: number | null;
        status: string;
      }
    >();
    for (const schedule of scheduleData ?? []) {
      if (isInstallmentFullyPaid(schedule)) continue;
      if (!nextSchedulesByAccount.has(schedule.account_id)) {
        nextSchedulesByAccount.set(schedule.account_id, {
          id: schedule.id,
          due_date: schedule.due_date,
          amount_due: schedule.amount_due,
          amount_paid: schedule.amount_paid,
          remaining_amount: schedule.remaining_amount,
          status: schedule.status,
        });
      }
    }

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
    await getBorrowers();
    router.refresh();
  };

  const getBorrowers = async () => {
    const { data, error } = await supabase
      .from("borrowers")
      .select(`
        *,
        borrower_categories (
          category:categories (
            id,
            name,
            color
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const enriched = await enrichBorrowersWithNextCollection(data || []);
    setBorrowers(enriched);
    setLoading(false);
  };

  useEffect(() => {
    getBorrowers();
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredBorrowers = borrowers.filter((borrower) => {
    const matchesCategory =
      selectedCategoryIds.length === 0 ||
      borrower.borrower_categories?.some((bc) =>
        selectedCategoryIds.includes(bc.category?.id)
      );

    if (!matchesCategory) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const fullName =
      `${borrower.first_name} ${borrower.last_name}`.toLowerCase();
    const contact = (borrower.contact ?? "").toLowerCase();

    return (
      fullName.includes(normalizedQuery) ||
      borrower.first_name.toLowerCase().includes(normalizedQuery) ||
      borrower.last_name.toLowerCase().includes(normalizedQuery) ||
      contact.includes(normalizedQuery)
    );
  });
  const categories = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; color: string | null }
    >();

    borrowers.forEach((borrower) => {
      borrower.borrower_categories?.forEach((bc) => {
        if (bc.category && !map.has(bc.category.id)) {
          map.set(bc.category.id, bc.category);
        }
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [borrowers]);

  if (loading) {
    return (
      <div className="">
        <AddBorrowerModal
          getBorrowers={getBorrowers}
          openModal={openAddBorrowerModal}
          isOpen={isAddBorrowerModalOpen}
          onClose={closeAddBorrowerModal}
        />
        <p>Loading borrowers...</p>
      </div>
    );
  }

  return (
    <div className="">
      <AddBorrowerModal
        getBorrowers={getBorrowers}
        openModal={openAddBorrowerModal}
        isOpen={isAddBorrowerModalOpen}
        onClose={closeAddBorrowerModal}
      />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black lowercase">Borrowers</h1>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
                        setSelectedCategoryIds((prev) =>
                          isSelected
                            ? prev.filter((id) => id !== category.id)
                            : [...prev, category.id]
                        );
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
                  onClick={() => setSelectedCategoryIds([])}
                  className="mt-2 w-full rounded-lg border-2 border-rose-800/35 bg-rose-50 px-3 py-2 text-center text-xs font-black uppercase tracking-wide text-rose-900 shadow-[1px_1px_0px_0px_rgb(190_18_60/0.25)] transition hover:bg-rose-100/90"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {borrowers.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-gray-500">No borrowers yet</p>
        </div>
      ) : filteredBorrowers.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-gray-500">
            No borrowers match the current search and category filters.
          </p>
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 *:min-w-0">
          {filteredBorrowers.map((borrower) => (
            <BorrowerCard
              key={borrower.id}
              borrower={borrower}
              showScheduleSummary
              onBorrowerUpdated={getBorrowers}
              isMarkingNextPaid={updatingBorrowerId === borrower.id}
              onMarkNextPaid={() => {
                void markNextPaymentPaid(borrower);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
