import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAccountDetailPageData } from "@/lib/cache/accounts";
import {
  amountPaidOnInstallment,
  remainingOnInstallment,
  isInstallmentFullyPaid,
} from "@/lib/payment-schedule/schedule-balances";

type Props = {
  params: Promise<{ id: string }>;
};

function formatMoney(value: number) {
  return `₱${value.toLocaleString()}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusBadgeClasses(status: string) {
  switch (status) {
    case "paid":
      return "border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-400/[0.15] dark:text-emerald-300";
    case "partial":
      return "border-violet-600 bg-violet-50 text-violet-900 dark:border-violet-400/40 dark:bg-violet-400/[0.15] dark:text-violet-300";
    case "overdue":
      return "border-rose-600 bg-rose-50 text-rose-900 dark:border-rose-400/40 dark:bg-rose-400/[0.15] dark:text-rose-300";
    default:
      return "border-amber-600 bg-amber-50 text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/[0.15] dark:text-amber-300";
  }
}

function statusRowClasses(status: string) {
  switch (status) {
    case "paid":
      return "bg-emerald-50/60 dark:bg-emerald-400/[0.08]";
    case "partial":
      return "bg-violet-50/60 dark:bg-violet-400/[0.08]";
    case "overdue":
      return "bg-rose-50/60 dark:bg-rose-400/[0.08]";
    default:
      return "bg-white dark:bg-zinc-900/40";
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  let data;
  try {
    data = await getAccountDetailPageData(id);
  } catch {
    return { title: "Loan Details | Utangz" };
  }

  const { account, borrower, schedules } = data;
  const borrowerName = borrower
    ? `${borrower.first_name} ${borrower.last_name}`
    : "Borrower";
  const typeLabel = account.type.replace("_", " ");
  const principal = Number(account.principal_amount ?? 0);
  const paidTotal = schedules.reduce(
    (sum, s) => sum + amountPaidOnInstallment(s),
    0,
  );
  const totalDue = schedules.reduce(
    (sum, s) => sum + Number(s.amount_due ?? 0),
    0,
  );
  const progressPct =
    totalDue > 0 ? Math.round((paidTotal / totalDue) * 100) : 0;

  const title = `${borrowerName} - ${typeLabel} | Utangz`;
  const description = `₱${principal.toLocaleString()} ${typeLabel} · ${progressPct}% paid · ${schedules.length} installments`;

  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";

  return {
    title,
    description,
    metadataBase: new URL(`${protocol}://${host}`),
    openGraph: {
      title,
      description,
      type: "website",
      url: `/accounts/${id}/view`,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PublicAccountViewPage({ params }: Props) {
  const { id } = await params;

  let data;
  try {
    data = await getAccountDetailPageData(id);
  } catch {
    notFound();
  }

  const { account, borrower, schedules } = data;

  const principal = Number(account.principal_amount ?? 0);
  const interestRate = Number(account.interest_rate ?? 0);

  const paidTotal = schedules.reduce(
    (sum, s) => sum + amountPaidOnInstallment(s),
    0,
  );
  const totalRemaining = schedules.reduce(
    (sum, s) => sum + remainingOnInstallment(s),
    0,
  );
  const totalDue = schedules.reduce(
    (sum, s) => sum + Number(s.amount_due ?? 0),
    0,
  );
  const progressPct =
    totalDue > 0 ? Math.min(100, Math.round((paidTotal / totalDue) * 100)) : 0;

  const paidCount = schedules.filter((s) => isInstallmentFullyPaid(s)).length;
  const nextDue = schedules.find((s) => s.status === "pending");

  const borrowerName = borrower
    ? `${borrower.first_name} ${borrower.last_name}`
    : "Borrower";

  return (
    <div className="space-y-4 sm:space-y-5 lg:grid lg:grid-cols-12 lg:gap-8 lg:space-y-0">
      {/* Left sidebar — summary */}
      <div className="space-y-3 sm:space-y-4 lg:col-span-4 lg:space-y-5">
        {/* Header */}
        <div className="text-center lg:text-left">
          <p className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase dark:text-zinc-500">
            Loan Details
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 uppercase dark:text-zinc-100">
            {borrowerName}
          </h1>
          <span
            className={`mt-2 inline-block rounded-full border-2 px-3 py-1 text-[10px] font-black tracking-widest uppercase shadow-[2px_2px_0px_0px_#0f172a] dark:shadow-none ${
              account.type === "cash_advance"
                ? "border-amber-700 bg-amber-100 text-amber-900 dark:border-amber-400/50 dark:bg-amber-400/20 dark:text-amber-300"
                : "border-violet-700 bg-violet-100 text-violet-900 dark:border-violet-400/50 dark:bg-violet-400/20 dark:text-violet-300"
            }`}
          >
            {account.type.replace("_", " ")}
          </span>
        </div>

        {/* Loan Summary */}
        <div className="rounded-xl border-2 border-slate-900 bg-white p-2.5 shadow-[3px_3px_0px_0px_#0f172a] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-none">
          <div className="grid grid-cols-2 gap-2.5 text-sm">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-zinc-500">
                Principal
              </p>
              <p className="text-lg font-black text-slate-900 dark:text-zinc-100">
                {formatMoney(principal)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-zinc-500">
                Interest Rate
              </p>
              <p className="text-lg font-black text-slate-900 dark:text-zinc-100">
                {interestRate}%
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-zinc-500">
                Term
              </p>
              <p className="text-lg font-black text-slate-900 dark:text-zinc-100">
                {account.term_months ?? 0}{" "}
                <span className="text-sm font-semibold text-slate-500 dark:text-zinc-500">
                  {account.term_months === 1 ? "month" : "months"}
                </span>
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-zinc-500">
                Frequency
              </p>
              <p className="text-lg font-black text-slate-900 capitalize dark:text-zinc-100">
                {account.payment_frequency?.replace("_", " ") ?? "—"}
              </p>
            </div>
          </div>
          {account.release_date && (
            <div className="mt-3 border-t border-dashed border-slate-200 pt-3 dark:border-zinc-700">
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-zinc-500">
                Released
              </p>
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                {formatDate(account.release_date)}
              </p>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="rounded-xl border-2 border-slate-900 bg-white p-2.5 shadow-[3px_3px_0px_0px_#0f172a] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase dark:text-zinc-500">
                Progress
              </p>
              <p className="text-3xl font-black text-slate-900 dark:text-zinc-100">
                {progressPct}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                {formatMoney(paidTotal)}
              </p>
              <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500">
                of {formatMoney(totalDue)}
              </p>
            </div>
          </div>
          <div className="mt-2.5 h-3 overflow-hidden rounded-full border-2 border-slate-900 bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800">
            <div
              className="h-full bg-emerald-400 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {paidCount} paid
            </span>
            <span className="font-semibold text-rose-700 dark:text-rose-400">
              {formatMoney(totalRemaining)} left
            </span>
          </div>
        </div>

        {/* Next Due */}
        {nextDue && (
          <div className="rounded-xl border-2 border-sky-600 bg-sky-50 p-2.5 shadow-[3px_3px_0px_0px_#0369a1] dark:border-sky-500 dark:bg-sky-900/20 dark:shadow-none">
            <p className="text-[10px] font-black tracking-widest text-sky-700 uppercase dark:text-sky-300">
              Next Payment Due
            </p>
            <p className="mt-1 text-xl font-black text-sky-900 dark:text-sky-100">
              {formatMoney(Number(nextDue.amount_due ?? 0))}
            </p>
            <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">
              {formatDate(nextDue.due_date)}
            </p>
          </div>
        )}
      </div>

      {/* Right column — schedule */}
      <div className="lg:col-span-8">
        <p className="mb-3 text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase dark:text-zinc-500">
          Payment Schedule
        </p>
        <div className="space-y-1">
          {schedules.map((schedule, i) => {
            const due = Number(schedule.amount_due ?? 0);
            const paid = amountPaidOnInstallment(schedule);
            const remaining = remainingOnInstallment(schedule);
            const isNext = schedule.id === nextDue?.id;
            const partialPct =
              due > 0 ? Math.min(100, Math.round((paid / due) * 100)) : 0;

            return (
              <div
                key={schedule.id}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border-2 p-2 ${isNext ? "border-sky-600 shadow-[2px_2px_0px_0px_#0369a1] dark:border-sky-500 dark:shadow-none" : "border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] dark:border-zinc-700 dark:shadow-none"} ${statusRowClasses(schedule.status)}`}
              >
                {/* Index + Next */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500">
                    #{i + 1}
                  </span>
                  {isNext && (
                    <span className="rounded border border-sky-600 bg-sky-100 px-1 py-px text-[7px] font-black tracking-wide text-sky-800 uppercase dark:border-sky-500 dark:bg-sky-900/40 dark:text-sky-300">
                      Next
                    </span>
                  )}
                </div>

                {/* Amount */}
                <span className="text-base font-black text-slate-900 dark:text-zinc-100">
                  {formatMoney(due)}
                </span>

                {/* Date */}
                <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400">
                  {formatDate(schedule.due_date)}
                </span>

                {/* Partial mini indicator */}
                {schedule.status === "partial" && (
                  <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                    {partialPct}%
                  </span>
                )}

                {/* Paid date inline */}
                {schedule.status === "paid" && schedule.paid_date && (
                  <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatDate(schedule.paid_date)}
                  </span>
                )}

                {/* Status badge — pushed right */}
                <span
                  className={`ml-auto rounded-full border-2 px-2 py-px text-[8px] font-black tracking-wider uppercase ${statusBadgeClasses(schedule.status)}`}
                >
                  {schedule.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 pb-6 text-center sm:pt-6 sm:pb-8 lg:col-span-12">
        <p className="text-[10px] font-bold tracking-widest text-slate-300 uppercase dark:text-zinc-700">
          Powered by Utangz
        </p>
      </div>
    </div>
  );
}
