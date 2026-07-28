import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAccountDetailPageData } from "@/lib/cache/accounts";
import {
  amountPaidOnInstallment,
  remainingOnInstallment,
  isInstallmentFullyPaid,
} from "@/lib/payment-schedule/schedule-balances";
import ThemeToggle from "@/components/theme-toggle";
import {
  PaymentSchedules,
  type PaymentScheduleItem,
} from "@/components/components-2/dashboard/payment-schedules";
import { formatDate } from "@/lib/utils";

type Props = {
  params: Promise<{ id: string }>;
};

function formatMoney(value: number) {
  return `₱${value.toLocaleString("en-US")}`;
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
  const description = `₱${principal.toLocaleString("en-US")} ${typeLabel} · ${progressPct}% paid · ${schedules.length} installments`;

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
  const nextDueIndex = schedules.findIndex((s) => s.status === "pending");
  const nextNumber = nextDueIndex >= 0 ? nextDueIndex + 1 : null;

  const scheduleItems: PaymentScheduleItem[] = schedules.map((s, i) => ({
    id: s.id,
    number: i + 1,
    amount: Math.max(0, Number(s.amount_due ?? 0)),
    dueDate: formatDate(s.due_date),
    status: s.status as PaymentScheduleItem["status"],
    paid: amountPaidOnInstallment(s),
    remaining: remainingOnInstallment(s),
    paidDate: s.paid_date,
    note: s.note,
  }));

  const borrowerName = borrower
    ? `${borrower.first_name} ${borrower.last_name}`
    : "Borrower";

  return (
    <div
      className="relative space-y-4 p-2 sm:space-y-5 md:p-0 lg:grid
        lg:grid-cols-12 lg:gap-8 lg:space-y-0"
    >
      <div className="absolute top-0 right-0 md:-top-10 md:-right-24">
        <ThemeToggle />
      </div>
      {/* Left sidebar — summary */}
      <div className="space-y-3 sm:space-y-4 lg:col-span-4 lg:space-y-5">
        {/* Header */}
        <div className="text-center lg:text-left">
          <p
            className="text-[10px] font-black tracking-[0.2em] text-slate-400
              uppercase dark:text-zinc-500"
          >
            Loan Details
          </p>
          <h1
            className="mt-1 text-2xl font-black tracking-tight text-slate-600
              uppercase dark:text-zinc-100"
          >
            {borrowerName}
          </h1>
          <span
            className={`mt-2 inline-block rounded-full border px-3 py-1
              text-[10px] font-black tracking-widest uppercase ${
                account.type === "cash_advance"
                  ? `border-amber-600 bg-amber-100 text-amber-900
                    dark:border-amber-400/40 dark:bg-amber-400/20
                    dark:text-amber-300`
                  : `border-violet-600 bg-violet-100 text-violet-900
                    dark:border-violet-400/40 dark:bg-violet-400/20
                    dark:text-violet-300`
              }`}
          >
            {account.type.replace("_", " ")}
          </span>
        </div>

        {/* Loan Summary */}
        <div
          className="rounded-xl border border-slate-300 bg-white p-4
            dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p
                className="text-[10px] font-bold tracking-wider text-slate-400
                  uppercase dark:text-zinc-500"
              >
                Principal
              </p>
              <p
                className="text-lg font-black text-slate-600 dark:text-zinc-100"
              >
                {formatMoney(principal)}
              </p>
            </div>
            <div>
              <p
                className="text-[10px] font-bold tracking-wider text-slate-400
                  uppercase dark:text-zinc-500"
              >
                Interest Rate
              </p>
              <p
                className="text-lg font-black text-slate-600 dark:text-zinc-100"
              >
                {interestRate}%
              </p>
            </div>
            <div>
              <p
                className="text-[10px] font-bold tracking-wider text-slate-400
                  uppercase dark:text-zinc-500"
              >
                Term
              </p>
              <p
                className="text-lg font-black text-slate-600 dark:text-zinc-100"
              >
                {account.term_months ?? 0}{" "}
                <span
                  className="text-sm font-semibold text-slate-500
                    dark:text-zinc-500"
                >
                  {account.term_months === 1 ? "month" : "months"}
                </span>
              </p>
            </div>
            <div>
              <p
                className="text-[10px] font-bold tracking-wider text-slate-400
                  uppercase dark:text-zinc-500"
              >
                Frequency
              </p>
              <p
                className="text-lg font-black text-slate-600 capitalize
                  dark:text-zinc-100"
              >
                {account.payment_frequency?.replace("_", " ") ?? "—"}
              </p>
            </div>
          </div>
          {account.release_date && (
            <div
              className="mt-4 border-t border-slate-200 pt-4
                dark:border-zinc-700"
            >
              <p
                className="text-[10px] font-bold tracking-wider text-slate-400
                  uppercase dark:text-zinc-500"
              >
                Released
              </p>
              <p
                className="text-sm font-semibold text-slate-700
                  dark:text-zinc-300"
              >
                {formatDate(account.release_date)}
              </p>
            </div>
          )}
        </div>

        {/* Progress */}
        <div
          className="rounded-xl border border-slate-300 bg-white p-4
            dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className="text-[10px] font-bold tracking-wider text-slate-400
                  uppercase dark:text-zinc-500"
              >
                Progress
              </p>
              <p
                className="text-3xl font-black text-slate-600
                  dark:text-zinc-100"
              >
                {progressPct}%
              </p>
            </div>
            <div className="text-right">
              <p
                className="text-sm font-black text-emerald-700
                  dark:text-emerald-400"
              >
                {formatMoney(paidTotal)}
              </p>
              <p
                className="text-[10px] font-bold text-slate-400
                  dark:text-zinc-500"
              >
                of {formatMoney(totalDue)}
              </p>
            </div>
          </div>
          <div
            className="mt-4 h-3 overflow-hidden rounded-full border
              border-slate-300 bg-slate-100 dark:border-zinc-700
              dark:bg-zinc-800"
          >
            <div
              className="h-full bg-emerald-400 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between text-xs">
            <span
              className="font-semibold text-emerald-700 dark:text-emerald-400"
            >
              {paidCount} paid
            </span>
            <span className="font-semibold text-rose-700 dark:text-rose-400">
              {formatMoney(totalRemaining)} left
            </span>
          </div>
        </div>

        {/* Next Due */}
        {nextDue && (
          <div
            className="rounded-xl border border-sky-500 bg-sky-50 p-4
              dark:border-sky-500 dark:bg-sky-900/20"
          >
            <p
              className="text-[10px] font-black tracking-widest text-sky-700
                uppercase dark:text-sky-300"
            >
              Next Payment Due
            </p>
            <p
              className="mt-1 text-xl font-black text-sky-900 dark:text-sky-100"
            >
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
        <PaymentSchedules
          title="Payment Schedule"
          nextDueDate={nextDue ? formatDate(nextDue.due_date) : null}
          nextDueAmount={nextDue ? remainingOnInstallment(nextDue) : undefined}
          progress={progressPct}
          nextNumber={nextNumber}
          schedules={scheduleItems}
          renderCardActions={() => null}
        />
      </div>

      {/* Footer */}
      <div className="pt-4 pb-6 text-center sm:pt-6 sm:pb-8 lg:col-span-12">
        <p
          className="text-[10px] font-bold tracking-widest text-slate-300
            uppercase dark:text-zinc-700"
        >
          Powered by Utangz
        </p>
      </div>
    </div>
  );
}
