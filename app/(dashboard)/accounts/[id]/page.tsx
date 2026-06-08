import { connection } from "next/server";
import { getAccountDetailPageData } from "@/lib/cache/accounts";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import BackButton from "@/components/back-button";
import StickyAccountStrip from "@/components/sticky-account-strip";
import PartialPaymentForm from "@/components/partial-payment-form";
import ScheduleStatusForm from "@/components/schedule-status-form";
import PaymentHistoryPanel from "@/components/payment-history-panel";
import type { SchedulePayment } from "@/components/payment-history-panel";
import AddSchedulesPanel from "@/components/add-schedules-panel";
import PrintButton from "@/components/print-button";
import { ScheduleSelectionProvider } from "@/components/schedule-selection-provider";
import { ScheduleCheckbox } from "@/components/schedule-checkbox";
import { ScheduleCheckboxCell } from "@/components/schedule-checkbox-cell";
import { ScheduleMobileCard } from "@/components/schedule-mobile-card";
import { ScheduleDesktopActions } from "@/components/schedule-desktop-actions";
import { ScheduleSelectAll } from "@/components/schedule-select-all";
import { ScheduleSelectAllHeader } from "@/components/schedule-select-all-header";
import { ScheduleEditBar } from "@/components/schedule-edit-bar";
import { ScheduleDeleteButton } from "@/components/schedule-delete-button";
import BatchScheduleToolbar from "@/components/batch-schedule-toolbar";
import type { PaidDateStrategy } from "@/components/batch-schedule-toolbar";
import ShareScheduleButton from "@/components/share-schedule-button";
import type { ShareSchedule } from "@/components/share-schedule-button";
import { CopyPublicLinkButton } from "@/components/copy-public-link-button";
import AnimatedNumber from "@/components/animated-number";
import NextScheduleScroller from "@/components/next-schedule-scroller";
import PaidCheck from "@/components/paid-check";
import OverdueSad from "@/components/overdue-sad";
import PartialPie from "@/components/partial-pie";
import PendingActivationBanner from "@/components/accounts/pending-activation-banner";
import { GlowBorder } from "@/components/glow-border";
import { ImpasNaBannerClient as ImpasNaBanner } from "@/components/impas-na-banner-client";
import type { ActivateAccountData } from "@/app/actions/accounts";
import {
  amountPaidOnInstallment,
  isInstallmentFullyPaid,
  isInstallmentNextHighlight,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import { countSkippedSchedules } from "@/lib/payment-schedule/build-payload";
import { cn } from "@/lib/utils";
import { Check, Info } from "lucide-react";
import {
  updateScheduleStatusAction,
  batchUpdateScheduleStatusAction,
  applyPartialPaymentAction,
  updatePaymentEntryAction,
  deletePaymentEntryAction,
  deleteScheduleAction,
  addSchedulesAction,
} from "@/lib/actions/schedules";

type AccountRow = {
  id: string;
  borrower_id: string;
  type: string;
  status: string;
  release_date: string | null;
  principal_amount: number | null;
  interest_rate: number | null;
  term_months: number | null;
  payment_frequency: string | null;
  schedule_mode: string | null;
  interest_type: string | null;
  first_payment_date: string | null;
  calculate_skipped_schedules: boolean | null;
  created_at: string;
};

type BorrowerRow = {
  id: string;
  first_name: string;
  last_name: string;
};

type PaymentScheduleRow = {
  id: string;
  account_id: string;
  due_date: string;
  amount_due: number | null;
  amount_paid: number | null;
  remaining_amount: number | null;
  note: string | null;
  paid_date: string | null;
  status: string;
};

type SchedulePaymentRow = {
  id: string;
  schedule_id: string;
  amount: number;
  payment_date: string | null;
  note: string | null;
  created_at: string;
};

type AccountDetailPageProps = {
  params: Promise<{ id: string }>;
};

const nb = {
  card: "rounded-xl border-2 border-slate-900 bg-background shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#020617] dark:bg-slate-900 dark:shadow-[2px_2px_0px_0px_#020617]",
  cardSoft:
    "rounded-xl border-2 border-slate-900 bg-background shadow-[1px_1px_0px_0px_#0f172a] dark:border-[#020617] dark:bg-slate-900 dark:shadow-[1px_1px_0px_0px_#020617]",
  inset:
    "rounded-lg border-2 border-slate-900 bg-slate-50 dark:border-[#020617] dark:bg-slate-900",
  label:
    "text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400",
  /** Payment schedule block */
  scheduleShell:
    "overflow-hidden rounded-xl border-2 border-slate-900 bg-background dark:border-[#020617] dark:bg-slate-900",
  scheduleHead:
    "border-b-2 border-slate-900 bg-green-300 px-4 py-3 sm:px-5 sm:py-4 dark:border-[#020617] dark:bg-emerald-500",
  scheduleTh:
    "border-r-2 border-b-2 border-slate-900 bg-slate-100 px-3 py-2.5 text-left text-[11px] font-black uppercase tracking-wide text-slate-900 last:border-r-0 dark:border-[#020617] dark:bg-slate-800 dark:text-slate-100",
  scheduleTd:
    "border-r-2 border-b-2 border-slate-900 px-3 py-2.5 align-middle text-slate-900 last:border-r-0 dark:border-[#020617] dark:text-slate-100",
};

function formatMoney(value: number) {
  return `₱${value.toLocaleString()}`;
}

function getAccountStatusClasses(status: string) {
  if (status === "paid") {
    return {
      badge:
        "border-emerald-700/80 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-600/15",
    };
  }
  if (status === "overdue") {
    return {
      badge:
        "border-rose-700/80 bg-rose-50 text-rose-900 ring-1 ring-rose-600/15",
    };
  }
  return {
    badge:
      "border-slate-700/80 bg-slate-50 text-slate-900 ring-1 ring-slate-600/10",
  };
}

function getScheduleStatusClasses(status: string) {
  if (status === "paid") {
    return {
      badge:
        "border-emerald-600/80 bg-emerald-50 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-400/[0.18] dark:text-emerald-300",
      row: "bg-emerald-100 dark:bg-emerald-400/[0.10]",
      dot: "bg-emerald-500 dark:bg-emerald-400",
      text: "text-green-500 dark:text-emerald-300",
    };
  }
  if (status === "partial") {
    return {
      badge:
        "border-violet-600/80 bg-violet-50 text-violet-950 dark:border-violet-400/40 dark:bg-violet-400/[0.18] dark:text-violet-300",
      row: "bg-violet-100 dark:bg-violet-400/[0.10]",
      dot: "bg-violet-500 dark:bg-violet-400",
      text: "text-violet-500 dark:text-violet-300",
    };
  }
  if (status === "overdue") {
    return {
      badge:
        "border-rose-600/80 bg-rose-50 text-rose-900 dark:border-rose-400/40 dark:bg-rose-400/[0.18] dark:text-rose-300",
      row: "bg-rose-50 dark:bg-rose-400/[0.10]",
      dot: "bg-rose-500 dark:bg-rose-400",
      text: "text-rose-800 dark:text-rose-300",
    };
  }
  return {
    badge:
      "border-amber-600/80 bg-amber-50 text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/[0.18] dark:text-amber-300",
    row: "bg-amber-50/50 dark:bg-[#141103]",
    dot: "bg-amber-500 dark:bg-amber-400",
    text: "text-amber-800 dark:text-amber-300",
  };
}

export default async function AccountDetailPage({
  params,
  searchParams,
}: AccountDetailPageProps & {
  searchParams: Promise<{ focus?: string }>;
}) {
  await connection();
  const { id } = await params;
  const { focus: focusScheduleId } = await searchParams;

  let accountDetail;
  try {
    accountDetail = await getAccountDetailPageData(id);
  } catch {
    notFound();
  }

  const {
    account: accountRow,
    borrower,
    schedules,
    paymentsMap,
  } = accountDetail;
  const accountStatusClasses = getAccountStatusClasses(accountRow.status);
  const totalPayment = schedules.reduce(
    (sum, s) => sum + (s.amount_due ?? 0),
    0,
  );

  const amountPaid = schedules.reduce(
    (sum, s) => sum + amountPaidOnInstallment(s),
    0,
  );

  const amountLeftRaw = schedules.reduce(
    (sum, s) => sum + remainingOnInstallment(s),
    0,
  );
  const amountLeftRolling = schedules
    .filter((s) => s.status !== "partial")
    .reduce((sum, s) => sum + remainingOnInstallment(s), 0);

  const principal = Number(accountRow.principal_amount ?? 0);
  const interestRate = Number(accountRow.interest_rate ?? 0);
  const isManual = accountRow.schedule_mode === "manual";
  const isRolling = isManual && accountRow.interest_type === "rolling";
  const isFlatManual = isManual && !isRolling;
  const manualFlatTotal = isFlatManual
    ? principal * (1 + interestRate / 100)
    : 0;

  const totalScheduledDue = schedules.reduce(
    (s, r) => s + Math.max(0, Number(r.amount_due ?? 0)),
    0,
  );
  const totalScheduledPaid = schedules.reduce(
    (s, r) => s + Math.max(0, Number(r.amount_paid ?? 0)),
    0,
  );

  const amountLeft = isFlatManual
    ? Math.max(0, manualFlatTotal - amountPaid)
    : isRolling
      ? amountLeftRolling
      : amountLeftRaw;

  const rollingTotalContract = isRolling ? amountPaid + amountLeft : 0;
  const profit = isFlatManual
    ? manualFlatTotal - principal
    : isRolling
      ? rollingTotalContract - principal
      : totalPayment - principal;

  const totalInstallments = schedules.length;
  const profitPerPayroll =
    totalInstallments > 0
      ? Math.round(Math.max(0, profit) / totalInstallments)
      : 0;
  const progressPct = isFlatManual
    ? manualFlatTotal > 0
      ? Math.min(100, Math.round((amountPaid / manualFlatTotal) * 100))
      : 0
    : totalScheduledDue > 0
      ? Math.min(
          100,
          Math.round((totalScheduledPaid / totalScheduledDue) * 100),
        )
      : 0;

  const nextHighlightIndex = schedules.findIndex((s) =>
    isInstallmentNextHighlight(s),
  );
  const nextDue =
    nextHighlightIndex >= 0 ? schedules[nextHighlightIndex] : null;

  const updateScheduleStatus = updateScheduleStatusAction.bind(
    null,
    accountRow.id,
  );
  const batchUpdateScheduleStatus = batchUpdateScheduleStatusAction.bind(
    null,
    accountRow.id,
  );
  const applyPartialPayment = applyPartialPaymentAction;
  const updatePaymentEntry = updatePaymentEntryAction.bind(null, id);
  const deletePaymentEntry = deletePaymentEntryAction.bind(null, id);
  const deleteSchedule = deleteScheduleAction.bind(null, id);
  const addSchedules = addSchedulesAction.bind(null, id);

  const borrowerName = borrower
    ? `${borrower.first_name} ${borrower.last_name}`
    : "Unknown borrower";

  const indexedSchedules = schedules.map((s, i) => ({ s, i }));
  const totalRemaining = schedules.reduce(
    (sum, s) => sum + remainingOnInstallment(s),
    0,
  );

  const renderDesktopLi = (schedule: PaymentScheduleRow, i: number) => {
    const st = getScheduleStatusClasses(schedule.status);
    const isNext = i === nextHighlightIndex;
    const hasHistory =
      schedule.status === "partial" &&
      (paymentsMap.get(schedule.id) ?? []).length > 0;
    const paidDiffDays =
      schedule.paid_date && schedule.paid_date !== schedule.due_date
        ? Math.round(
            (new Date(schedule.paid_date).getTime() -
              new Date(schedule.due_date).getTime()) /
              86400000,
          )
        : null;
    return (
      <li
        key={schedule.id}
        id={isNext ? "next-schedule" : undefined}
        className={`flex break-inside-avoid flex-col rounded-xl border-2 p-4 transition-colors duration-700 ${st.row} ${
          isNext
            ? "relative mb-5 border-slate-900 shadow-[4px_4px_0px_0px_#0f172a] dark:border-[#020617] dark:shadow-[4px_4px_0px_0px_#020617]"
            : "m-1 mb-4 border-slate-900 shadow-[4px_4px_0px_0px_#0f172a] dark:border-[#020617] dark:shadow-[4px_4px_0px_0px_#020617]"
        }`}
      >
        {isNext && <GlowBorder />}
        <div className="flex items-center gap-2">
          <span className="dark:text-muted-foreground text-[11px] font-black tracking-wide text-slate-400 uppercase">
            #{i + 1}
          </span>
          {isNext && (
            <span className="inline-block rounded-md border-2 border-slate-900 bg-sky-200 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-slate-900 uppercase shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#020617] dark:bg-sky-800 dark:text-sky-100 dark:shadow-[2px_2px_0px_0px_#020617]">
              Next
            </span>
          )}
          <span
            className={`ml-auto shrink-0 rounded-full border-2 px-2.5 py-1 text-[10px] font-black capitalize shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#020617] dark:shadow-[2px_2px_0px_0px_#020617] ${st.badge}`}
          >
            {schedule.status}
          </span>
          <ScheduleCheckbox scheduleId={schedule.id} />
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <p className="dark:text-foreground text-3xl font-black tracking-tight text-slate-900 tabular-nums">
            {formatMoney(Number(schedule.amount_due ?? 0))}
          </p>
          {schedule.status === "paid" ? <PaidCheck /> : null}
          {schedule.status === "partial" ? (
            <PartialPie
              progress={(() => {
                const paid = amountPaidOnInstallment(schedule);
                const due = Number(schedule.amount_due ?? 0);
                return due > 0
                  ? Math.min(100, Math.round((paid / due) * 100))
                  : 0;
              })()}
            />
          ) : null}
          {schedule.status === "overdue" ? <OverdueSad /> : null}
          {schedule.status === "paid" ? (
            schedule.paid_date && schedule.paid_date !== schedule.due_date ? (
              <span className="ml-auto text-sm font-semibold text-amber-600 dark:text-amber-400">
                {formatDate(schedule.paid_date)}
                {paidDiffDays !== null && (
                  <span className="ml-1.5 text-[11px] font-semibold opacity-70">
                    ·{" "}
                    {paidDiffDays > 0
                      ? `${paidDiffDays} day${paidDiffDays === 1 ? "" : "s"} late`
                      : `${Math.abs(paidDiffDays)} day${Math.abs(paidDiffDays) === 1 ? "" : "s"} early`}
                  </span>
                )}
              </span>
            ) : (
              <span className="dark:text-muted-foreground ml-auto flex items-center gap-1 text-sm font-semibold text-slate-600">
                {formatDate(schedule.due_date)}
                <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
              </span>
            )
          ) : (
            <span className="dark:text-muted-foreground ml-auto text-sm font-semibold text-slate-600">
              {formatDate(schedule.due_date)}
            </span>
          )}
        </div>

        {isRolling &&
          interestRate > 0 &&
          (() => {
            const due = Number(schedule.amount_due ?? 0);
            const base =
              Math.round((due / (1 + interestRate / 100)) * 100) / 100;
            const interest = Math.round((due - base) * 100) / 100;
            return (
              <p className="dark:text-muted-foreground text-[10px] text-slate-400 tabular-nums">
                {formatMoney(base)} + {interestRate}% (+{formatMoney(interest)})
              </p>
            );
          })()}

        {schedule.status === "partial" &&
          (() => {
            const paid = amountPaidOnInstallment(schedule);
            const due = Number(schedule.amount_due ?? 0);
            const pct =
              due > 0 ? Math.min(100, Math.round((paid / due) * 100)) : 0;
            return (
              <div className="mt-2">
                <div className="dark:text-muted-foreground flex justify-between text-[10px] font-black text-slate-500">
                  <span>Paid {formatMoney(paid)}</span>
                  <span>
                    Left {formatMoney(remainingOnInstallment(schedule))}
                  </span>
                </div>
                <div className="mt-1.5 h-3 overflow-hidden rounded-full border-2 border-slate-900 bg-white dark:border-[#020617] dark:bg-slate-900">
                  <div
                    className="h-full bg-amber-400 transition-all duration-500 dark:bg-amber-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()}

        {schedule.note ? (
          <p className="dark:text-muted-foreground mt-1 line-clamp-1 text-xs text-slate-400">
            {schedule.note}
          </p>
        ) : null}

        <div className="mt-3 border-t-2 border-dashed border-slate-200 pt-3 dark:border-slate-900">
          <ScheduleDesktopActions
            status={schedule.status}
            hasHistory={hasHistory}
            statusForm={
              <div className="flex flex-col items-center gap-3">
                <ScheduleStatusForm
                  scheduleId={schedule.id}
                  currentStatus={schedule.status}
                  dueDate={schedule.due_date}
                  updateScheduleStatus={updateScheduleStatus}
                  isRollingManual={isRolling}
                  applyPartialPayment={applyPartialPayment}
                />
                <ScheduleDeleteButton
                  scheduleId={schedule.id}
                  deleteSchedule={deleteSchedule}
                />
                {!isRolling && schedule.status === "partial" ? (
                  <PartialPaymentForm
                    scheduleId={schedule.id}
                    applyPartialPayment={applyPartialPayment}
                    autoFocus={focusScheduleId === schedule.id}
                    dueDate={schedule.due_date}
                  />
                ) : null}
              </div>
            }
            history={
              hasHistory ? (
                <PaymentHistoryPanel
                  payments={
                    (paymentsMap.get(schedule.id) ?? []) as SchedulePayment[]
                  }
                  updatePayment={updatePaymentEntry}
                  deletePayment={deletePaymentEntry}
                />
              ) : null
            }
          />
        </div>
      </li>
    );
  };

  return (
    <div className="max-w-8xl relative mx-auto overflow-visible pb-16">
      {/* <BackButton
        fallbackHref={`/borrowers/${accountRow.borrower_id}`}
        floating
      /> */}

      <NextScheduleScroller />

      <StickyAccountStrip
        borrowerName={borrowerName}
        releaseDate={
          accountRow.release_date ? formatDate(accountRow.release_date) : "—"
        }
        interest={accountRow.interest_rate ?? 0}
        termMonths={accountRow.term_months ?? 0}
        paymentFrequency={accountRow.payment_frequency ?? "—"}
        isManual={isManual}
        principal={principal}
        remaining={amountLeft}
        collected={amountPaid}
        profit={profit}
        profitPerPayroll={profitPerPayroll}
        progressPct={progressPct}
      />

      <div className="mt-4 space-y-6 sm:mt-10">
        <Link
          href={`/borrowers/${accountRow.borrower_id}`}
          className="dark:text-muted-foreground dark:hover:text-foreground inline-flex items-center gap-1 text-xs font-black tracking-wider text-slate-500 uppercase transition hover:text-slate-900"
        >
          <span>←</span>
          <span>{borrowerName}</span>
        </Link>

        <header className={`overflow-hidden`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="mt-1 font-black tracking-tight text-slate-900 uppercase sm:text-xl"></h1>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4 lg:flex-col lg:items-end print:items-end">
              <div className="flex gap-2 print:hidden">
                {/* <PrintButton /> */}
                {/* <ShareScheduleButton
                  borrowerName={borrowerName}
                  accountType={accountRow.type}
                  releaseDate={accountRow.release_date}
                  principal={principal}
                  collected={amountPaid}
                  remaining={amountLeft}
                  profit={profit}
                  totalPayment={totalPayment}
                  progressPct={progressPct}
                  schedules={schedules.map(
                    (s, i) =>
                      ({
                        index: i + 1,
                        due_date: s.due_date,
                        amount_due: Number(s.amount_due ?? 0),
                        amount_paid: amountPaidOnInstallment(s),
                        remaining: remainingOnInstallment(s),
                        status: s.status,
                        paid_date: s.paid_date,
                      }) as ShareSchedule,
                  )}
                /> */}
                <ShareScheduleButton
                  noDetails
                  borrowerName={borrowerName}
                  accountType={accountRow.type}
                  releaseDate={accountRow.release_date}
                  principal={principal}
                  collected={amountPaid}
                  remaining={amountLeft}
                  profit={profit}
                  totalPayment={totalPayment}
                  progressPct={progressPct}
                  schedules={schedules.map(
                    (s, i) =>
                      ({
                        index: i + 1,
                        due_date: s.due_date,
                        amount_due: Number(s.amount_due ?? 0),
                        amount_paid: amountPaidOnInstallment(s),
                        remaining: remainingOnInstallment(s),
                        status: s.status,
                        paid_date: s.paid_date,
                      }) as ShareSchedule,
                  )}
                />
                <CopyPublicLinkButton accountId={id} />
              </div>
              {/* <span
                className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${accountStatusClasses.badge}`}
              >
                {accountRow.status}
              </span> */}
              {/* <dl className="grid gap-2 text-sm sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-1">
                <div className={`${nb.cardSoft} px-3 py-2`}>
                  <dt className={nb.label}>Interest</dt>
                  <dd className="mt-0.5 text-lg font-black tabular-nums text-slate-900">
                    {accountRow.interest_rate ?? 0}%
                  </dd>
                </div>
                <div className={`${nb.cardSoft} px-3 py-2`}>
                  <dt className={nb.label}>Term / frequency</dt>
                  <dd className="mt-0.5 font-semibold leading-snug text-slate-900">
                    {accountRow.term_months ?? 0}{" "}
                    <span className="font-normal text-slate-500">{accountRow.payment_frequency === "custom" ? accountRow.term_months === 1 ? "give" : "gives" : accountRow.term_months === 1 ? "month" : "months"}</span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="capitalize">
                      {accountRow.payment_frequency ?? "—"}
                    </span>
                  </dd>
                </div>
              </dl> */}
            </div>
          </div>
        </header>

        {accountRow.status === "pending" ? (
          <PendingActivationBanner
            releaseDate={accountRow.release_date}
            principal={principal}
            accountId={id}
            initialValues={{
              principal_amount: principal,
              interest_rate: Number(accountRow.interest_rate ?? 0),
              release_date: accountRow.release_date ?? "",
              first_payment_date: accountRow.first_payment_date ?? "",
              payment_frequency:
                (accountRow.payment_frequency as ActivateAccountData["payment_frequency"]) ??
                "bimonthly",
              term_months: Number(accountRow.term_months ?? 1),
              schedule_mode:
                (accountRow.schedule_mode as ActivateAccountData["schedule_mode"]) ??
                "auto",
              interest_type:
                (accountRow.interest_type as ActivateAccountData["interest_type"]) ??
                "flat",
            }}
          />
        ) : null}

        {accountRow.status !== "pending" &&
          accountRow.calculate_skipped_schedules &&
          accountRow.release_date &&
          accountRow.first_payment_date &&
          accountRow.payment_frequency &&
          (() => {
            const skipped = countSkippedSchedules(
              accountRow.release_date,
              accountRow.first_payment_date,
              accountRow.payment_frequency as
                | "weekly"
                | "monthly"
                | "bimonthly"
                | "custom",
            );
            return skipped > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-xl border-2 border-amber-900/20 bg-amber-50/90 px-4 py-3 shadow-[2px_2px_0px_0px_rgb(15_23_42/0.1)] dark:border-amber-400/20 dark:bg-amber-400/12">
                  <Info className="size-4 shrink-0 text-amber-700 dark:text-amber-300" />
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    {skipped} payment schedule{skipped === 1 ? "" : "s"} skipped
                    between release date and first payment date. Extra interest
                    was added to each installment.
                  </p>
                </div>
                {(() => {
                  const p = Number(accountRow.principal_amount ?? 0);
                  const r = Number(accountRow.interest_rate ?? 0);
                  const t = Number(accountRow.term_months ?? 0);
                  const monthlyInterest = p * (r / 100);
                  const baseInterest = monthlyInterest * t;
                  const dailyInterest = monthlyInterest / 30;
                  const periodDays =
                    accountRow.payment_frequency === "bimonthly" ||
                    accountRow.payment_frequency === "custom"
                      ? 15
                      : accountRow.payment_frequency === "monthly"
                        ? 30
                        : 7;
                  const extraPerSkip = dailyInterest * periodDays;
                  const totalExtra = extraPerSkip * skipped;
                  const totalInterest = baseInterest + totalExtra;
                  const totalPayable = p + totalInterest;
                  const schedulesCount =
                    accountRow.payment_frequency === "bimonthly"
                      ? Math.round(t * 2)
                      : accountRow.payment_frequency === "weekly"
                        ? Math.round(t * 4)
                        : accountRow.payment_frequency === "custom"
                          ? Math.round(t)
                          : Math.round(t);
                  const perInstallment =
                    schedulesCount > 0
                      ? Number((totalPayable / schedulesCount).toFixed(2))
                      : 0;
                  const basePerInstallment =
                    schedulesCount > 0
                      ? Number(((p + baseInterest) / schedulesCount).toFixed(2))
                      : 0;
                  return (
                    <div
                      className={`${nb.inset} px-4 py-3 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300`}
                    >
                      <p className="dark:text-muted-foreground mb-1 text-[10px] font-black tracking-wide text-slate-500 uppercase">
                        Interest breakdown
                      </p>
                      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
                        <span>
                          Base interest ({t}mo × {r}%)
                        </span>
                        <span className="text-right font-bold tabular-nums">
                          {formatMoney(baseInterest)}
                        </span>
                        <span>
                          Extra per skipped schedule ({periodDays} days)
                        </span>
                        <span className="text-right font-bold tabular-nums">
                          {formatMoney(extraPerSkip)}
                        </span>
                        <span>Skipped schedules</span>
                        <span className="text-right font-bold tabular-nums">
                          × {skipped}
                        </span>
                        <span className="border-t border-slate-200 pt-0.5 font-bold dark:border-slate-700">
                          Total extra interest
                        </span>
                        <span className="border-t border-slate-200 pt-0.5 text-right font-bold tabular-nums dark:border-slate-700">
                          {formatMoney(totalExtra)}
                        </span>
                        <span className="border-t border-slate-200 pt-0.5 font-bold dark:border-slate-700">
                          Total interest
                        </span>
                        <span className="border-t border-slate-200 pt-0.5 text-right font-bold tabular-nums dark:border-slate-700">
                          {formatMoney(totalInterest)}
                        </span>
                        <span className="border-t border-slate-200 pt-0.5 font-bold dark:border-slate-700">
                          Total payable
                        </span>
                        <span className="border-t border-slate-200 pt-0.5 text-right font-bold tabular-nums dark:border-slate-700">
                          {formatMoney(totalPayable)}
                        </span>
                        {schedulesCount > 0 && (
                          <>
                            <span className="pt-0.5">
                              Per installment ({schedulesCount})
                            </span>
                            <span className="text-right font-bold tabular-nums">
                              {formatMoney(perInstallment)}
                            </span>
                            <span className="dark:text-muted-foreground text-[10px] text-slate-500">
                              Without skip
                            </span>
                            <span className="dark:text-muted-foreground text-right text-[10px] text-slate-500 tabular-nums">
                              {formatMoney(basePerInstallment)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : null;
          })()}

        <section aria-labelledby="balances-heading" className="hidden sm:block">
          <h2 id="balances-heading" className={`mb-3 ${nb.label}`}>
            Balances
          </h2>
          <div className="grid gap-3 text-4xl sm:grid-cols-2 lg:grid-cols-4">
            <div
              className={`${nb.card} dark:to-card border-sky-900/20 bg-linear-to-br from-sky-50/90 to-white p-4 dark:border-sky-400/20 dark:from-sky-400/10`}
            >
              <p className={nb.label}>Principal</p>
              <p className="dark:text-foreground mt-1.5 text-4xl font-black tracking-tight text-slate-900">
                <AnimatedNumber
                  value={Number(accountRow.principal_amount ?? 0)}
                  prefix="₱"
                />
              </p>
              <p className="dark:text-muted-foreground mt-1.5 text-xs text-slate-600">
                Loan amount
              </p>
            </div>
            <div
              className={`${nb.card} dark:to-card border-rose-900/20 bg-linear-to-br from-rose-50/90 to-white p-4 dark:border-rose-400/20 dark:from-rose-400/10`}
            >
              <p className={nb.label}>Remaining</p>
              <p className="dark:text-foreground mt-1.5 text-4xl font-black tracking-tight text-slate-900">
                <AnimatedNumber value={amountLeft} prefix="₱" />
              </p>
              <p className="dark:text-muted-foreground mt-1.5 text-xs text-slate-600">
                Still to collect
              </p>
            </div>
            <div
              className={`${nb.card} dark:to-card border-emerald-900/20 bg-linear-to-br from-emerald-50/90 to-white p-4 dark:border-emerald-400/20 dark:from-emerald-400/10`}
            >
              <p className={nb.label}>Collected</p>
              <p className="dark:text-foreground mt-1.5 text-4xl font-black tracking-tight text-slate-900">
                <AnimatedNumber value={amountPaid} prefix="₱" />
              </p>
              <p className="dark:text-muted-foreground mt-1.5 text-xs text-slate-600">
                Nabayran
              </p>
            </div>

            <div
              className={`${nb.card} dark:to-card border-amber-900/20 bg-linear-to-br from-amber-50/90 to-white p-4 dark:border-amber-400/20 dark:from-amber-400/10`}
            >
              <p className={nb.label}>Projected profit</p>
              <p className="dark:text-foreground mt-1.5 text-4xl font-black tracking-tight text-slate-900">
                <AnimatedNumber value={Math.max(0, profit)} prefix="₱" />
              </p>
              <p className="dark:text-muted-foreground mt-1.5 text-xs text-slate-600">
                {isRolling ? "Interest charged (all cycles)" : "Over principal"}
              </p>
            </div>
          </div>
          <div
            className={`mt-3 ${nb.inset} dark:text-muted-foreground px-4 py-3 text-sm text-slate-700`}
          >
            <span className="dark:text-foreground font-semibold text-slate-900">
              Total contract
            </span>{" "}
            <span className="tabular-nums">
              {formatMoney(isRolling ? rollingTotalContract : totalPayment)}
            </span>
            <span className="dark:text-border mx-2 text-slate-300">|</span>
            <span className="dark:text-muted-foreground text-slate-600">
              {isRolling
                ? `${schedules.filter((s) => isInstallmentFullyPaid(s)).length} cycle${schedules.filter((s) => isInstallmentFullyPaid(s)).length === 1 ? "" : "s"} paid · ${formatMoney(amountLeft)} outstanding`
                : isManual
                  ? `${formatMoney(amountPaid)} of ${formatMoney(principal)} recovered`
                  : `${schedules.filter((s) => isInstallmentFullyPaid(s)).length} of ${totalInstallments} installments paid`}
            </span>
          </div>
        </section>

        {accountRow.status !== "pending" ? (
          <ScheduleSelectionProvider>
            <section
              className={`${nb.scheduleShell} -mx-4 md:-mx-6`}
              aria-labelledby="schedule-heading"
            >
              <div className={nb.scheduleHead}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2
                      id="schedule-heading"
                      className="text-sm font-black tracking-wide text-slate-900 uppercase"
                    >
                      Payment schedules
                    </h2>
                    {nextDue ? (
                      <p className="dark:text-muted-foreground mt-1.5 text-sm font-semibold text-slate-800">
                        Next due{" "}
                        <span className="dark:text-foreground font-black text-slate-900">
                          {formatDate(nextDue.due_date)}
                        </span>
                        <span className="dark:text-muted-foreground text-slate-600">
                          {" "}
                          ·{" "}
                        </span>
                        <span className="dark:text-foreground font-black text-slate-900 tabular-nums">
                          {formatMoney(remainingOnInstallment(nextDue))}
                        </span>
                        {remainingOnInstallment(nextDue) <
                        Number(nextDue.amount_due ?? 0) ? (
                          <span className="dark:text-muted-foreground text-slate-600">
                            {" "}
                            left of{" "}
                            <span className="dark:text-foreground font-bold tabular-nums">
                              {formatMoney(Number(nextDue.amount_due ?? 0))}
                            </span>
                          </span>
                        ) : null}
                      </p>
                    ) : totalInstallments > 0 && isManual ? (
                      <p className="mt-1.5 text-sm font-bold text-emerald-900 dark:text-emerald-400"></p>
                    ) : (
                      <p className="mt-1.5 text-sm font-bold text-emerald-900 dark:text-emerald-400">
                        All installments settled.
                      </p>
                    )}
                  </div>
                  {(isManual ? principal > 0 : totalInstallments > 0) ? (
                    <div className="w-full max-w-xs sm:w-48">
                      <div className="dark:text-muted-foreground mb-1 flex justify-between text-[10px] font-black tracking-wide text-slate-800 uppercase">
                        <span>{isManual ? "Recovered" : "Progress"}</span>
                        <span className="dark:text-foreground text-slate-900 tabular-nums">
                          {progressPct}%
                        </span>
                      </div>
                      <div
                        className="dark:border-border dark:bg-card h-3 overflow-hidden rounded-md border-2 border-slate-900 bg-white shadow-[2px_2px_0px_0px_#0f172a]"
                        role="progressbar"
                        aria-valuenow={progressPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Installments marked paid"
                      >
                        <div
                          className="h-full bg-emerald-400"
                          style={{
                            width: `${progressPct}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <ScheduleEditBar allIds={schedules.map((s) => s.id)} />

              {isManual ? (
                <div className="print:hidden">
                  <AddSchedulesPanel
                    accountId={accountRow.id}
                    addSchedules={addSchedules}
                  />
                </div>
              ) : null}

              {schedules.length === 0 ? (
                <div className="dark:border-border/50 dark:bg-muted/50 border-t-2 border-dashed border-slate-300 bg-slate-50/80 px-5 py-12 text-center">
                  <p className="dark:text-muted-foreground text-sm font-black tracking-wide text-slate-600 uppercase">
                    No payment schedules yet
                  </p>
                </div>
              ) : (
                <>
                  {totalRemaining === 0 &&
                    schedules.length > 0 &&
                    !isManual && (
                      <ImpasNaBanner profit={amountPaid - principal} />
                    )}
                  {/* mobile view */}
                  <div className="lg:hidden print:hidden">
                    <ul className="space-y-3 px-3 py-3">
                      {indexedSchedules.map(({ s: schedule, i }) => {
                        const st = getScheduleStatusClasses(schedule.status);
                        const isNext = i === nextHighlightIndex;
                        const paidDiffDays =
                          schedule.paid_date &&
                          schedule.paid_date !== schedule.due_date
                            ? Math.round(
                                (new Date(schedule.paid_date).getTime() -
                                  new Date(schedule.due_date).getTime()) /
                                  86400000,
                              )
                            : null;
                        return (
                          <ScheduleMobileCard
                            key={schedule.id}
                            scheduleId={schedule.id}
                            id={isNext ? "next-schedule" : undefined}
                            className={cn(
                              "rounded-xl border-2 px-4 py-3",
                              st.row,
                              isNext
                                ? "relative my-5 border-slate-900 shadow-[3px_3px_0px_0px_#0f172a] dark:border-[#020617] dark:shadow-[3px_3px_0px_0px_#020617]"
                                : "border-slate-900 shadow-[3px_3px_0px_0px_#0f172a] dark:border-[#020617] dark:shadow-[3px_3px_0px_0px_#020617]",
                            )}
                            defaultOpen={
                              isNext || focusScheduleId === schedule.id
                            }
                            actions={
                              <div className="flex items-start gap-2 overflow-x-auto pb-1">
                                <ScheduleStatusForm
                                  scheduleId={schedule.id}
                                  currentStatus={schedule.status}
                                  dueDate={schedule.due_date}
                                  updateScheduleStatus={updateScheduleStatus}
                                  isRollingManual={isRolling}
                                  applyPartialPayment={applyPartialPayment}
                                />
                                <ScheduleDeleteButton
                                  scheduleId={schedule.id}
                                  deleteSchedule={deleteSchedule}
                                />
                              </div>
                            }
                            footer={
                              schedule.status === "partial" &&
                              (!isRolling ||
                                (paymentsMap.get(schedule.id) ?? []).length >
                                  0) ? (
                                <div className="space-y-3 pb-2">
                                  {!isRolling ? (
                                    <PartialPaymentForm
                                      scheduleId={schedule.id}
                                      applyPartialPayment={applyPartialPayment}
                                      autoFocus={
                                        focusScheduleId === schedule.id
                                      }
                                      dueDate={schedule.due_date}
                                    />
                                  ) : null}
                                  {(paymentsMap.get(schedule.id) ?? []).length >
                                  0 ? (
                                    <PaymentHistoryPanel
                                      payments={
                                        (paymentsMap.get(schedule.id) ??
                                          []) as SchedulePayment[]
                                      }
                                      updatePayment={updatePaymentEntry}
                                      deletePayment={deletePaymentEntry}
                                    />
                                  ) : null}
                                </div>
                              ) : undefined
                            }
                          >
                            {isNext && <GlowBorder />}
                            {/* always-visible card header */}
                            <div className="flex items-center gap-2">
                              <span className="dark:text-muted-foreground text-[11px] font-black tracking-wide text-slate-400 uppercase">
                                #{i + 1}
                              </span>
                              {isNext && (
                                <span className="inline-block rounded-md border-2 border-slate-900 bg-sky-200 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-slate-900 uppercase shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#020617] dark:bg-sky-800 dark:text-sky-100 dark:shadow-[2px_2px_0px_0px_#020617]">
                                  Next
                                </span>
                              )}
                              <span
                                className={`ml-auto shrink-0 rounded-full border-2 px-2 py-0.5 text-[10px] font-black capitalize shadow-[2px_2px_0px_0px_#0f172a] dark:border-[#020617] dark:shadow-[2px_2px_0px_0px_#020617] ${st.badge}`}
                              >
                                {schedule.status}
                              </span>
                              <ScheduleCheckbox scheduleId={schedule.id} />
                            </div>

                            <div className="mt-1 flex items-baseline gap-2">
                              <p className="dark:text-foreground text-2xl font-black tracking-tight text-slate-900 tabular-nums">
                                {formatMoney(Number(schedule.amount_due ?? 0))}
                              </p>
                              {schedule.status === "paid" ? (
                                <PaidCheck />
                              ) : null}
                              {schedule.status === "partial" ? (
                                <PartialPie
                                  progress={(() => {
                                    const paid =
                                      amountPaidOnInstallment(schedule);
                                    const due = Number(
                                      schedule.amount_due ?? 0,
                                    );
                                    return due > 0
                                      ? Math.min(
                                          100,
                                          Math.round((paid / due) * 100),
                                        )
                                      : 0;
                                  })()}
                                />
                              ) : null}
                              {schedule.status === "overdue" ? (
                                <OverdueSad />
                              ) : null}
                            </div>

                            {isRolling &&
                              interestRate > 0 &&
                              (() => {
                                const due = Number(schedule.amount_due ?? 0);
                                const base =
                                  Math.round(
                                    (due / (1 + interestRate / 100)) * 100,
                                  ) / 100;
                                const interest =
                                  Math.round((due - base) * 100) / 100;
                                return (
                                  <p className="dark:text-muted-foreground text-[10px] text-slate-400 tabular-nums">
                                    {formatMoney(base)} + {interestRate}% (+
                                    {formatMoney(interest)})
                                  </p>
                                );
                              })()}

                            {schedule.status === "paid" ? (
                              schedule.paid_date &&
                              schedule.paid_date !== schedule.due_date ? (
                                <p className="mt-0.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
                                  {formatDate(schedule.paid_date)}
                                  {paidDiffDays !== null && (
                                    <span className="ml-1.5 text-[11px] font-semibold opacity-70">
                                      ·{" "}
                                      {paidDiffDays > 0
                                        ? `${paidDiffDays} day${paidDiffDays === 1 ? "" : "s"} late`
                                        : `${Math.abs(paidDiffDays)} day${Math.abs(paidDiffDays) === 1 ? "" : "s"} early`}
                                    </span>
                                  )}
                                </p>
                              ) : (
                                <p className="dark:text-muted-foreground mt-0.5 flex items-center gap-1 text-sm font-semibold text-slate-600">
                                  {formatDate(schedule.due_date)}
                                  <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                                </p>
                              )
                            ) : (
                              <p className="dark:text-muted-foreground mt-0.5 text-sm font-semibold text-slate-600">
                                {formatDate(schedule.due_date)}
                              </p>
                            )}

                            {schedule.status === "partial" &&
                              (() => {
                                const paid = amountPaidOnInstallment(schedule);
                                const due = Number(schedule.amount_due ?? 0);
                                const pct =
                                  due > 0
                                    ? Math.min(
                                        100,
                                        Math.round((paid / due) * 100),
                                      )
                                    : 0;
                                return (
                                  <div className="mt-2">
                                    <div className="dark:text-muted-foreground flex justify-between text-[10px] font-black text-slate-500">
                                      <span>Paid {formatMoney(paid)}</span>
                                      <span>
                                        Left{" "}
                                        {formatMoney(
                                          remainingOnInstallment(schedule),
                                        )}
                                      </span>
                                    </div>
                                    <div className="mt-1.5 h-3 overflow-hidden rounded-full border-2 border-slate-900 bg-white dark:border-[#020617] dark:bg-slate-900">
                                      <div
                                        className="h-full bg-amber-400 transition-all duration-500 dark:bg-amber-500"
                                        style={{
                                          width: `${pct}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })()}

                            {schedule.note ? (
                              <p className="dark:text-muted-foreground mt-1 line-clamp-1 text-xs text-slate-400">
                                {schedule.note}
                              </p>
                            ) : null}
                          </ScheduleMobileCard>
                        );
                      })}
                    </ul>
                  </div>
                  {/* desktop view */}
                  <div className="mt-3 hidden lg:block print:hidden">
                    <ul className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2 xl:p-8">
                      {indexedSchedules.map(({ s, i }) =>
                        renderDesktopLi(s, i),
                      )}
                    </ul>
                  </div>
                </>
              )}
            </section>
            <BatchScheduleToolbar
              allIds={schedules.map((s) => s.id)}
              onBatchPaid={batchUpdateScheduleStatus}
            />
          </ScheduleSelectionProvider>
        ) : null}
      </div>
    </div>
  );
}
