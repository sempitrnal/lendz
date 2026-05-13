"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type SyntheticEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";


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
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [navigatingBorrowerId, setNavigatingBorrowerId] = useState<string | null>(
    null
  );
  const [, startNavigationTransition] = useTransition();

  const goToBorrower = (borrowerId: string) => {
    setNavigatingBorrowerId(borrowerId);
    startNavigationTransition(() => {
      router.push(`/borrowers/${borrowerId}`);
    });
  };

  const openBorrower = (entry: NextCollectionEntry, e: SyntheticEvent) => {
    if (!entry.borrowerId || navigatingBorrowerId !== null) return;
    if (isMarkingAll) return;
    if ((e.target as HTMLElement).closest("[data-prevent-borrower-card-open]")) {
      return;
    }
    goToBorrower(entry.borrowerId);
  };

  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, { color: string | null; entries: NextCollectionEntry[] }>();
    for (const entry of entries) {
      const existing = groups.get(entry.category);
      if (existing) {
        existing.entries.push(entry);
      } else {
        groups.set(entry.category, { color: entry.categoryColor ?? null, entries: [entry] });
      }
    }
    return Array.from(groups.entries()).map(([category, { color, entries: groupEntries }]) => ({
      category,
      color,
      entries: groupEntries,
      total: groupEntries.reduce((sum, e) => sum + e.amount, 0),
      accountCount: groupEntries.reduce((sum, e) => sum + e.schedules.length, 0),
    }));
  }, [entries]);

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
            disabled={
              isMarkingAll ||
              navigatingBorrowerId !== null
            }
            onClick={() => {
              void markAllNextPaid();
            }}
            className="rounded-md border-2 border-slate-900 bg-emerald-200 px-4 py-1 text-[12px] font-black uppercase text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70"
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
      {entries.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-400 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          No upcoming unpaid schedule.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByCategory.map((group) => (
            <div key={group.category}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full border border-slate-900/25"
                    style={{ backgroundColor: group.color ?? "#cbd5e1" }}
                    aria-hidden
                  />
                  <span className="text-xs font-black uppercase tracking-wide text-slate-700">
                    {group.category}
                  </span>
                  <span className="rounded-md border border-slate-900/20 bg-white px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-600">
                    {group.accountCount} account{group.accountCount === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  PHP {group.total.toLocaleString()}
                </span>
              </div>
              <ul className="min-w-0 space-y-2">
                {group.entries.map((entry) => {
                  const isOpening =
                    entry.borrowerId !== null &&
                    navigatingBorrowerId === entry.borrowerId;

                  return (
                    <li
                      key={entry.id}
                      role={entry.borrowerId ? "button" : undefined}
                      tabIndex={
                        entry.borrowerId && navigatingBorrowerId === null ? 0 : undefined
                      }
                      aria-busy={isOpening}
                      aria-disabled={!entry.borrowerId || isOpening}
                      onClick={(e) => {
                        openBorrower(entry, e);
                      }}
                      onKeyDown={(e) => {
                        if (!entry.borrowerId || isOpening || navigatingBorrowerId !== null)
                          return;
                        if (e.key !== "Enter" && e.key !== " ") return;
                        if (
                          (e.target as HTMLElement).closest(
                            "[data-prevent-borrower-card-open]"
                          )
                        ) {
                          return;
                        }
                        e.preventDefault();
                        goToBorrower(entry.borrowerId);
                      }}
                      className={`rounded-lg border-2 border-slate-900 bg-slate-50 px-3 py-2 ${
                        entry.borrowerId
                          ? `cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 ${
                              isOpening ? "cursor-wait opacity-80" : ""
                            }`
                          : ""
                      }`}
                    >
                      <div className="flex items-start mb-5 justify-between gap-2">
                        <p className="min-w-0 flex-1 text-xl font-black uppercase text-slate-900">
                          {entry.name}
                        </p>
                        {entry.schedules.length > 1 ? (
                          <span className="shrink-0 rounded-md border border-slate-900/20 bg-white px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-600">
                            {entry.schedules.length} accounts
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-700">
                          {entry.amounts && entry.amounts.length > 1
                            ? entry.amounts
                                .map((amount) => `PHP ${amount.toLocaleString()}`)
                                .join(" + ")
                            : `PHP ${entry.amount.toLocaleString()}`}
                        </p>
                      </div>
                      {!entry.borrowerId ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Borrower record unavailable.
                        </p>
                      ) : null}
                      {isOpening ? (
                        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <Loader2
                            className="size-3.5 shrink-0 animate-spin"
                            aria-hidden
                          />
                          Opening…
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="mt-3 flex items-center justify-between rounded-lg border-2 border-slate-900 bg-slate-900 px-3 py-2">
            <span className="text-xs font-black uppercase tracking-wide text-white">
              Total
            </span>
            <span className="text-xs font-black tabular-nums text-white">
              {entries.reduce((sum, e) => sum + e.schedules.length, 0)} account{entries.reduce((sum, e) => sum + e.schedules.length, 0) === 1 ? "" : "s"} • PHP {nextCollectionTotal.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </article>
  );
}
