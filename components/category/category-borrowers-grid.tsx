"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BorrowerCard } from "@/components/borrower/borrower-card";
import type { Borrower } from "@/components/borrower/borrower-list";
import type { BorrowerNextCollection } from "@/lib/compute-borrower-next-collection";
import { supabase } from "@/lib/supabase/client";
import {
  mapAccountIdToNextDueSchedule,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";

type CategoryBorrower = Pick<
  Borrower,
  "id" | "first_name" | "last_name" | "contact" | "created_at"
> & {
  borrower_categories?: Borrower["borrower_categories"];
};

type CategoryBorrowersGridProps = {
  borrowers: CategoryBorrower[];
  borrowerAccountCountById: Record<string, number>;
  borrowerNextCollectionById: Record<string, BorrowerNextCollection>;
};

export default function CategoryBorrowersGrid({
  borrowers,
  borrowerAccountCountById,
  borrowerNextCollectionById,
}: CategoryBorrowersGridProps) {
  const router = useRouter();
  const [updatingBorrowerId, setUpdatingBorrowerId] = useState<string | null>(
    null
  );

  const markNextPaymentPaid = async (borrower: CategoryBorrower) => {
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

  return (
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 *:min-w-0">
      {borrowers.map((borrower) => {
        const nextMeta = borrowerNextCollectionById[borrower.id] ?? {
          next_collection_date: null,
          next_collection_amount: 0,
        };
        const hasAccounts = (borrowerAccountCountById[borrower.id] ?? 0) > 0;
        return (
          <BorrowerCard
            key={borrower.id}
            borrower={
              {
                ...borrower,
                borrower_categories: borrower.borrower_categories ?? [],
                has_accounts: hasAccounts,
                next_collection_date: nextMeta.next_collection_date,
                next_collection_amount: nextMeta.next_collection_amount,
              } as Borrower
            }
            showScheduleSummary
            isMarkingNextPaid={updatingBorrowerId === borrower.id}
            onMarkNextPaid={
              hasAccounts
                ? () => {
                    void markNextPaymentPaid(borrower);
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}
