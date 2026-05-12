"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { isDarkColor } from "@/lib/utils";

type NextCollectionEntry = {
  id: string;
  schedules: Array<{
    id: string;
    amountDue: number | null;
    amount: number;
  }>;
  borrowerId: string | null;
  name: string;
  amount: number;
  amounts?: number[];
  category: string;
  categoryColor?: string | null;
};

type NextCollectionPanelProps = {
  nextCollectionDate: string | null;
  nextCollectionTotal: number;
  entries: NextCollectionEntry[];
};

export default function NextCollectionPanel({
  nextCollectionDate,
  nextCollectionTotal,
  entries,
}: NextCollectionPanelProps) {
  const router = useRouter();
  const [updatingScheduleId, setUpdatingScheduleId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const markSchedulePaid = async (entry: NextCollectionEntry) => {
    const scheduleIds = entry.schedules.map((s) => s.id);
    if (scheduleIds.length === 0) return;

    setUpdatingScheduleId(entry.id);
    for (const schedule of entry.schedules) {
      const due = Number(schedule.amountDue ?? schedule.amount);
      const { error } = await supabase
        .from("payment_schedules")
        .update({
          status: "paid",
          amount_paid: due,
          remaining_amount: 0,
        })
        .eq("id", schedule.id);
      if (error) {
        setUpdatingScheduleId(null);
        toast.error(error.message);
        return;
      }
    }
    setUpdatingScheduleId(null);

    toast.success(`Marked next payment paid for ${entry.name}.`);
    router.refresh();
  };

  const markAllNextPaid = async () => {
    if (entries.length === 0) return;

    setIsMarkingAll(true);
    let updatedCount = 0;

    for (const entry of entries) {
      for (const schedule of entry.schedules) {
        const due = Number(schedule.amountDue ?? schedule.amount);
        const { error } = await supabase
          .from("payment_schedules")
          .update({
            status: "paid",
            amount_paid: due,
            remaining_amount: 0,
          })
          .eq("id", schedule.id);

        if (error) {
          setIsMarkingAll(false);
          toast.error(error.message);
          return;
        }

        updatedCount += 1;
      }
    }

    setIsMarkingAll(false);
    toast.success(
      `Marked ${updatedCount} next schedule${updatedCount === 1 ? "" : "s"} as paid.`
    );
    router.refresh();
  };

  return (
    <article className="min-w-0 rounded-xl border-2 border-slate-900 bg-linear-to-br from-emerald-50 via-white to-lime-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-black lowercase text-slate-900">
          next collection
        </h2>
        {entries.length > 0 ? (
          <button
            type="button"
            disabled={isMarkingAll || updatingScheduleId !== null}
            onClick={() => {
              void markAllNextPaid();
            }}
            className="rounded-md border-2 border-slate-900 bg-emerald-200 px-2 py-1 text-[10px] font-bold uppercase text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70"
          >
            {isMarkingAll ? "..." : "Mark all next paid"}
          </button>
        ) : null}
      </div>
      {nextCollectionDate ? (
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {new Date(nextCollectionDate).toLocaleDateString()} • PHP{" "}
          {nextCollectionTotal.toLocaleString()}
        </p>
      ) : null}
      <ul className="min-w-0 space-y-2">
        {entries.length === 0 ? (
          <li className="rounded-lg border-2 border-dashed border-slate-400 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            No upcoming unpaid schedule.
          </li>
        ) : (
          entries.map((entry) => {
            return (
              <li
            key={entry.id}
            className="rounded-lg border-2 border-slate-900 bg-slate-50 px-3 py-2"
          >
            <div className="flex items-start mb-5 justify-between gap-2">
              {entry.borrowerId ? (
                <Link
                  href={`/borrowers/${entry.borrowerId}`}
                  className="min-w-0 flex-1"
                >
                  <p className=" font-bold lowercase text-slate-900">
                    {entry.name}
                  </p>
                </Link>
              ) : (
                <p className="min-w-0 flex-1 truncate font-bold lowercase text-slate-900">
                  {entry.name}
                </p>
              )}
              <span style={{
                backgroundColor: entry.categoryColor ?? "#cbd5e1",
                color: isDarkColor(entry.categoryColor ?? "#cbd5e1") ? "white" : "#1e1a4d",
              }} className="inline-flex items-center gap-1.5 rounded-md border-2 border-slate-900  px-2 py-1 text-[8px] font-black uppercase text-slate-600">
                {entry.category}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700">
                {entry.amounts && entry.amounts.length > 1
                  ? entry.amounts
                      .map((amount) => `PHP ${amount.toLocaleString()}`)
                      .join(" + ")
                  : `PHP ${entry.amount.toLocaleString()}`}
              </p>
              <button
                type="button"
                disabled={isMarkingAll || updatingScheduleId === entry.id}
                onClick={() => {
                  void markSchedulePaid(entry);
                }}
                className="rounded-md border-2 border-slate-900 bg-emerald-200 px-2 py-1 text-[10px] font-bold uppercase text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70"
              >
                {updatingScheduleId === entry.id ? "..." : "Mark next paid"}
              </button>
            </div>
            {!entry.borrowerId ? (
              <p className="mt-1 text-xs text-slate-500">
                Borrower record unavailable.
              </p>
            ) : null}
          </li>
            );
          })
        )}
      </ul>
    </article>
  );
}
