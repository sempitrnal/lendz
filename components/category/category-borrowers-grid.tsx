"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BorrowerCard } from "@/components/borrower/borrower-card";
import type { Borrower } from "@/components/borrower/borrower-list";
import { supabase } from "@/lib/supabase/client";

type CategoryBorrower = Pick<
  Borrower,
  "id" | "first_name" | "last_name" | "contact" | "created_at"
> & {
  borrower_categories?: Borrower["borrower_categories"];
};

type CategoryBorrowersGridProps = {
  borrowers: CategoryBorrower[];
  borrowerAccountCountById: Record<string, number>;
};

export default function CategoryBorrowersGrid({
  borrowers,
  borrowerAccountCountById,
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
      .select("id, account_id, due_date, amount_due, status")
      .in("account_id", accountIds)
      .neq("status", "paid")
      .order("due_date", { ascending: true })
      .order("id", { ascending: true });

    if (scheduleError) {
      setUpdatingBorrowerId(null);
      toast.error(scheduleError.message);
      return;
    }

    const nextSchedulesByAccount = new Map<
      string,
      { id: string; due_date: string; amount_due: number | null }
    >();
    for (const schedule of scheduleData ?? []) {
      if (!nextSchedulesByAccount.has(schedule.account_id)) {
        nextSchedulesByAccount.set(schedule.account_id, {
          id: schedule.id,
          due_date: schedule.due_date,
          amount_due: schedule.amount_due,
        });
      }
    }

    const nextSchedules = Array.from(nextSchedulesByAccount.values());
    if (nextSchedules.length === 0) {
      setUpdatingBorrowerId(null);
      toast.info("No unpaid schedules found.");
      return;
    }

    const { error: updateError } = await supabase
      .from("payment_schedules")
      .update({ status: "paid" })
      .in(
        "id",
        nextSchedules.map((schedule) => schedule.id)
      );

    setUpdatingBorrowerId(null);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    const totalUpdatedAmount = nextSchedules.reduce(
      (sum, schedule) => sum + Number(schedule.amount_due ?? 0),
      0
    );
    toast.success(
      `Marked ${nextSchedules.length} next schedule${nextSchedules.length === 1 ? "" : "s"} as paid across ${nextSchedulesByAccount.size} account${nextSchedulesByAccount.size === 1 ? "" : "s"} (PHP ${totalUpdatedAmount.toLocaleString()}) for ${borrower.first_name} ${borrower.last_name}.`
    );
    router.refresh();
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {borrowers.map((borrower) => (
        <BorrowerCard
          key={borrower.id}
          borrower={
            {
              ...borrower,
              borrower_categories: borrower.borrower_categories ?? [],
            } as Borrower
          }
          quickAction={
            (borrowerAccountCountById[borrower.id] ?? 0) > 0
              ? {
                  label: "Mark next paid",
                  onClick: () => {
                    void markNextPaymentPaid(borrower);
                  },
                  isLoading: updatingBorrowerId === borrower.id,
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}
