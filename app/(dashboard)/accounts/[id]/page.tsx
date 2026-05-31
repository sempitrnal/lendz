import { createSupabaseServer } from "@/lib/supabase/server";
import { connection } from "next/server";
import { getAccountDetailPageData } from "@/lib/cache/accounts";
import { logAudit } from "@/lib/audit";
import { revalidatePath, updateTag } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { ScheduleSelectAll } from "@/components/schedule-select-all";
import { ScheduleSelectAllHeader } from "@/components/schedule-select-all-header";
import { ScheduleEditBar } from "@/components/schedule-edit-bar";
import { ScheduleDeleteButton } from "@/components/schedule-delete-button";
import BatchScheduleToolbar from "@/components/batch-schedule-toolbar";
import type { PaidDateStrategy } from "@/components/batch-schedule-toolbar";
import ShareScheduleButton from "@/components/share-schedule-button";
import type { ShareSchedule } from "@/components/share-schedule-button";
import AnimatedNumber from "@/components/animated-number";
import NextScheduleScroller from "@/components/next-schedule-scroller";
import PaidCheck from "@/components/paid-check";
import OverdueSad from "@/components/overdue-sad";
import PendingActivationBanner from "@/components/accounts/pending-activation-banner";
import type { ActivateAccountData } from "@/app/actions/accounts";
import {
  amountPaidOnInstallment,
  isInstallmentFullyPaid,
  isInstallmentNextHighlight,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";

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

const scheduleStatuses = ["pending", "paid", "overdue", "partial"] as const;
type ScheduleStatus = (typeof scheduleStatuses)[number];

const nb = {
  card: "rounded-xl border-2 border-slate-900/90 bg-white shadow-[2px_2px_0px_0px_rgb(15_23_42/0.88)]",
  cardSoft:
    "rounded-xl border border-slate-900/25 bg-white shadow-[1px_1px_0px_0px_rgb(15_23_42/0.2)]",
  inset: "rounded-lg border border-slate-200/80 bg-slate-50/80",
  label:
    "text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500",
  /** Payment schedule block — full neobrut */
  scheduleShell:
    "overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[5px_5px_0px_0px_#0f172a] dark:border-border dark:bg-card",
  scheduleHead:
    "border-b-2  border-slate-900 bg-green-300 px-4 py-3 sm:px-5 sm:py-4 dark:border-border dark:bg-[#0e331e]",
  scheduleTh:
    "border-r-2  border-b-2 border-slate-900 bg-slate-100 px-3 py-2.5 text-left text-[11px] font-black uppercase tracking-wide text-slate-900 last:border-r-0 dark:border-border dark:bg-muted dark:text-foreground",
  scheduleTd:
    "border-r-2 border-slate-900 px-3 py-2.5 align-middle text-slate-900 last:border-r-0 dark:border-border dark:text-foreground",
};

function formatMoney(value: number) {
  return `₱${value.toLocaleString()}`;
}

function formatScheduleDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
      badge: "border-emerald-600/80 bg-emerald-50 text-emerald-900 dark:border-[#2ea043] dark:bg-[#2ea043]/20 dark:text-[#56d364]",
      row: "bg-emerald-100 dark:bg-[#0f2417]",
      dot: "bg-emerald-500 dark:bg-[#2ea043]",
      text: "text-green-500 dark:text-[#56d364]"
    };
  }
  if (status === "partial") {
    return {
      badge: "border-violet-600/80 bg-violet-50 text-violet-950 dark:border-[#8b5cf6] dark:bg-[#8b5cf6]/20 dark:text-[#c4b5fd]",
      row: "bg-violet-100 dark:bg-[#1a1033]",
      dot: "bg-violet-500 dark:bg-[#8b5cf6]",
      text: "text-violet-500 dark:text-[#c4b5fd]"
    };
  }
  if (status === "overdue") {
    return {
      badge: "border-rose-600/80 bg-rose-50 text-rose-900 dark:border-[#f85149] dark:bg-[#f85149]/20 dark:text-[#ff7b72]",
      row: "bg-rose-50 dark:bg-[#2a0a0a]",
      dot: "bg-rose-500 dark:bg-[#f85149]",
      text: "text-rose-800 dark:text-[#ff7b72]"
    };
  }
  return {
    badge: "border-amber-600/80 bg-amber-50 text-amber-950 dark:border-[#d29922] dark:bg-[#d29922]/20 dark:text-[#e3b341]",
    row: "bg-amber-50/50 dark:bg-[#241a00]",
    dot: "bg-amber-500 dark:bg-[#d29922]",
    text: "text-amber-800 dark:text-[#e3b341]",
  };
}

export default async function AccountDetailPage({
  params,
  searchParams,
}: AccountDetailPageProps & { searchParams: Promise<{ focus?: string }> }) {
  await connection();
  const { id } = await params;
  const { focus: focusScheduleId } = await searchParams;

  let accountDetail;
  try {
    accountDetail = await getAccountDetailPageData(id);
  } catch {
    notFound();
  }

  const { account: accountRow, borrower, schedules, paymentsMap } = accountDetail;
  const accountStatusClasses = getAccountStatusClasses(accountRow.status);
  const totalPayment = schedules.reduce(
    (sum, s) => sum + (s.amount_due ?? 0),
    0
  );

  const amountPaid = schedules.reduce(
    (sum, s) => sum + amountPaidOnInstallment(s),
    0
  );

  const amountLeftRaw = schedules.reduce(
    (sum, s) => sum + remainingOnInstallment(s),
    0
  );
  const amountLeftRolling = schedules
    .filter((s) => s.status !== "partial")
    .reduce((sum, s) => sum + remainingOnInstallment(s), 0);

  const principal = Number(accountRow.principal_amount ?? 0);
  const interestRate = Number(accountRow.interest_rate ?? 0);
  const isManual = accountRow.schedule_mode === "manual";
  const isRolling = isManual && accountRow.interest_type === "rolling";
  const isFlatManual = isManual && !isRolling;
  const manualFlatTotal = isFlatManual ? principal * (1 + interestRate / 100) : 0;

  const totalScheduledDue = schedules.reduce((s, r) => s + Math.max(0, Number(r.amount_due ?? 0)), 0);
  const totalScheduledPaid = schedules.reduce((s, r) => s + Math.max(0, Number(r.amount_paid ?? 0)), 0);

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
  const profitPerPayroll = totalInstallments > 0 ? Math.round(Math.max(0, profit) / totalInstallments) : 0;
  const progressPct = isFlatManual
    ? manualFlatTotal > 0
      ? Math.min(100, Math.round((amountPaid / manualFlatTotal) * 100))
      : 0
    : totalScheduledDue > 0
      ? Math.min(100, Math.round((totalScheduledPaid / totalScheduledDue) * 100))
      : 0;

  const nextHighlightIndex = schedules.findIndex(
    (s) => isInstallmentNextHighlight(s)
  );
  const nextDue =
    nextHighlightIndex >= 0 ? schedules[nextHighlightIndex] : null;

  async function updateScheduleStatus(formData: FormData) {
    "use server";
    const scheduleId = String(formData.get("scheduleId") ?? "");
    const status = String(formData.get("status") ?? "");
    const paidDateRaw = String(formData.get("paidDate") ?? "").trim();

    if (!scheduleId || !scheduleStatuses.includes(status as ScheduleStatus)) {
      return;
    }

    const updateSupabase = await createSupabaseServer();
    const { data: row } = await updateSupabase
      .from("payment_schedules")
      .select("id, amount_due")
      .eq("id", scheduleId)
      .single();

    if (!row) return;

    const due = Math.max(0, Number(row.amount_due ?? 0));
    const paidDate = paidDateRaw || null;
    const patch: Record<string, string | number | null> =
      status === "paid"
        ? { status, amount_paid: due, remaining_amount: 0, paid_date: paidDate }
        : { status, amount_paid: 0, remaining_amount: due, paid_date: null };

    await updateSupabase
      .from("payment_schedules")
      .update(patch)
      .eq("id", scheduleId);

    await logAudit({
      action: "schedule.status_changed",
      entity_type: "payment_schedule",
      entity_id: scheduleId,
      account_id: accountRow.id,
      description: `Schedule status changed to "${status}"`,
      metadata: { scheduleId, status, amount_due: due },
    });

    // When marking as paid, also insert a schedule_payment record
    if (status === "paid" && due > 0) {
      await updateSupabase.from("schedule_payments").insert({
        schedule_id: scheduleId,
        amount: due,
        payment_date: paidDate,
      });
    }

    // When reverting to pending or overdue, delete all payment history
    if (status === "pending" || status === "overdue") {
      await updateSupabase
        .from("schedule_payments")
        .delete()
        .eq("schedule_id", scheduleId);
    }

    if (status === "partial") {
      redirect(`/accounts/${accountRow.id}?focus=${scheduleId}`);
    }

    revalidatePath(`/accounts/${accountRow.id}`);
    updateTag("account");
    updateTag(`account-${accountRow.id}`);
    updateTag("accounts-page");
    updateTag("borrowers");
    updateTag("calendar");
    updateTag("dashboard");
    updateTag("next-collection");
  }

  async function batchUpdateScheduleStatus(
    ids: string[],
    paidDateStrategy: PaidDateStrategy,
    customDate?: string
  ) {
    "use server";
    if (!ids.length) return;

    const updateSupabase = await createSupabaseServer();

    const { data: rows } = await updateSupabase
      .from("payment_schedules")
      .select("id, amount_due, due_date")
      .in("id", ids);

    if (!rows?.length) return;

    await Promise.all(
      rows.map(async (row) => {
        const due = Math.max(0, Number(row.amount_due ?? 0));
        const paidDate =
          paidDateStrategy === "custom"
            ? (customDate || null)
            : (row.due_date || null);

        await updateSupabase
          .from("payment_schedules")
          .update({
            status: "paid",
            amount_paid: due,
            remaining_amount: 0,
            paid_date: paidDate,
          })
          .eq("id", row.id);

        if (due > 0) {
          await updateSupabase.from("schedule_payments").insert({
            schedule_id: row.id,
            amount: due,
            payment_date: paidDate,
          });
        }
      })
    );

    await logAudit({
      action: "schedule.batch_paid",
      entity_type: "payment_schedule",
      account_id: accountRow.id,
      description: `Batch marked ${ids.length} schedule${ids.length === 1 ? "" : "s"} as paid`,
      metadata: { ids, paidDateStrategy, customDate },
    });

    revalidatePath(`/accounts/${accountRow.id}`);
    updateTag("account");
    updateTag(`account-${accountRow.id}`);
    updateTag("accounts-page");
    updateTag("borrowers");
    updateTag("calendar");
    updateTag("dashboard");
    updateTag("next-collection");
  }

  async function applyPartialPayment(formData: FormData) {
    "use server";
    const scheduleId = String(formData.get("scheduleId") ?? "");
    const rawAmt = String(formData.get("paymentAmount") ?? "").trim();
    const noteRaw = String(formData.get("note") ?? "").trim();
    const paymentDateRaw = String(formData.get("paymentDate") ?? "").trim();
    const add = Number.parseFloat(rawAmt);
    if (!scheduleId || !Number.isFinite(add) || add <= 0) {
      return;
    }

    const sb = await createSupabaseServer();
    const { data: row } = await sb
      .from("payment_schedules")
      .select("id, account_id, amount_due, amount_paid, status, note")
      .eq("id", scheduleId)
      .single();

    if (!row) return;

    // Fetch account to determine if rolling manual
    const { data: acc } = await sb
      .from("accounts")
      .select("schedule_mode, interest_type, interest_rate")
      .eq("id", row.account_id as string)
      .single();
    const isRollingManualPayment =
      acc?.schedule_mode === "manual" && acc?.interest_type === "rolling";

    const due = Math.max(0, Number(row.amount_due ?? 0));
    const prevPaid = Math.max(0, Number(row.amount_paid ?? 0));
    const newPaid = Math.min(due, prevPaid + add);
    const balanceForNextCycle = Math.max(0, due - newPaid);
    const paymentDate = paymentDateRaw || null;

    let nextStatus: string;
    let remaining: number;

    if (isRollingManualPayment) {
      // Rolling: current schedule always closes as "paid"; remaining goes to next cycle
      nextStatus = "paid";
      remaining = 0;
    } else {
      remaining = balanceForNextCycle;
      nextStatus = newPaid >= due ? "paid" : "partial";
    }

    const updatePayload: Record<string, string | number | null> = {
      amount_paid: newPaid,
      remaining_amount: remaining,
      status: nextStatus,
      paid_date: paymentDate,
    };
    if (noteRaw.length > 0) {
      updatePayload.note = noteRaw;
    }

    await sb.from("payment_schedules").update(updatePayload).eq("id", scheduleId);

    // Insert into schedule_payments history
    await sb.from("schedule_payments").insert({
      schedule_id: scheduleId,
      amount: add,
      payment_date: paymentDate,
      note: noteRaw || null,
    });

    // For rolling: generate next schedule from unpaid balance + interest
    if (isRollingManualPayment && balanceForNextCycle > 0) {
      const rate = Number(acc!.interest_rate ?? 0);
      const nextDue = Math.round(balanceForNextCycle * (1 + rate / 100) * 100) / 100;
      const nextDueDate = paymentDate ?? new Date().toISOString().split("T")[0];
      await sb.from("payment_schedules").insert({
        account_id: row.account_id,
        due_date: nextDueDate,
        amount_due: nextDue,
        amount_paid: 0,
        remaining_amount: nextDue,
        status: "pending",
      });
    }

    await logAudit({
      action: "schedule.payment_applied",
      entity_type: "payment_schedule",
      entity_id: scheduleId,
      account_id: row.account_id as string,
      description: `Payment of ₱${add.toLocaleString()} applied`,
      metadata: { scheduleId, amount: add, paymentDate, isRolling: isRollingManualPayment, newStatus: nextStatus },
    });

    revalidatePath(`/accounts/${row.account_id as string}`);
    updateTag("account");
    updateTag(`account-${row.account_id as string}`);
    updateTag("accounts-page");
    updateTag("borrowers");
    updateTag("calendar");
    updateTag("dashboard");
    updateTag("next-collection");
  }

  async function updatePaymentEntry(formData: FormData) {
    "use server";
    const paymentId = String(formData.get("paymentId") ?? "");
    const amountRaw = String(formData.get("amount") ?? "").trim();
    const dateRaw = String(formData.get("paymentDate") ?? "").trim();
    const noteRaw = String(formData.get("note") ?? "").trim();
    if (!paymentId) return;

    const sb = await createSupabaseServer();
    const patch: Record<string, string | number | null> = {};
    const amt = Number.parseFloat(amountRaw);
    if (Number.isFinite(amt) && amt > 0) patch.amount = amt;
    patch.payment_date = dateRaw || null;
    patch.note = noteRaw || null;

    const { data: payment } = await sb
      .from("schedule_payments")
      .select("id, schedule_id, amount")
      .eq("id", paymentId)
      .single();
    if (!payment) return;

    const oldAmount = Number(payment.amount ?? 0);
    await sb.from("schedule_payments").update(patch).eq("id", paymentId);

    // Recalculate schedule totals from all payments
    const newAmount = Number(patch.amount ?? oldAmount);
    const diff = newAmount - oldAmount;
    if (diff !== 0) {
      const { data: sched } = await sb
        .from("payment_schedules")
        .select("id, amount_due, amount_paid")
        .eq("id", payment.schedule_id)
        .single();
      if (sched) {
        const due = Math.max(0, Number(sched.amount_due ?? 0));
        const prevPaid = Math.max(0, Number(sched.amount_paid ?? 0));
        const newPaid = Math.min(due, Math.max(0, prevPaid + diff));
        const remaining = Math.max(0, due - newPaid);
        const nextStatus = newPaid >= due ? "paid" : newPaid > 0 ? "partial" : "pending";
        await sb.from("payment_schedules").update({
          amount_paid: newPaid,
          remaining_amount: remaining,
          status: nextStatus,
        }).eq("id", payment.schedule_id);
      }
    }

    revalidatePath(`/accounts/${id}`);
    updateTag("account");
    updateTag(`account-${id}`);
    updateTag("accounts-page");
    updateTag("borrowers");
    updateTag("calendar");
    updateTag("dashboard");
    updateTag("next-collection");
  }

  async function deletePaymentEntry(formData: FormData) {
    "use server";
    const paymentId = String(formData.get("paymentId") ?? "");
    const scheduleId = String(formData.get("scheduleId") ?? "");
    if (!paymentId) return;

    const sb = await createSupabaseServer();
    const { data: payment } = await sb
      .from("schedule_payments")
      .select("id, schedule_id, amount")
      .eq("id", paymentId)
      .single();
    if (!payment) return;

    await sb.from("schedule_payments").delete().eq("id", paymentId);

    // Recalculate schedule totals
    const sid = scheduleId || payment.schedule_id;
    const { data: sched } = await sb
      .from("payment_schedules")
      .select("id, account_id, amount_due, amount_paid")
      .eq("id", sid)
      .single();
    if (sched) {
      const due = Math.max(0, Number(sched.amount_due ?? 0));
      const prevPaid = Math.max(0, Number(sched.amount_paid ?? 0));
      const removedAmt = Math.max(0, Number(payment.amount ?? 0));
      const newPaid = Math.max(0, prevPaid - removedAmt);
      const remaining = Math.max(0, due - newPaid);
      const nextStatus = newPaid >= due ? "paid" : newPaid > 0 ? "partial" : "pending";
      await sb.from("payment_schedules").update({
        amount_paid: newPaid,
        remaining_amount: remaining,
        status: nextStatus,
        paid_date: null,
      }).eq("id", sid);

      // For rolling manual: delete all pending schedules generated downstream
      const { data: acc } = await sb
        .from("accounts")
        .select("schedule_mode, interest_type")
        .eq("id", sched.account_id as string)
        .single();
      if (acc?.schedule_mode === "manual" && acc?.interest_type === "rolling") {
        await sb
          .from("payment_schedules")
          .delete()
          .eq("account_id", sched.account_id)
          .eq("status", "pending")
          .neq("id", sid);
      }

      await logAudit({
        action: "schedule.payment_deleted",
        entity_type: "payment_schedule",
        entity_id: sid,
        account_id: sched.account_id as string,
        description: `Payment of ₱${Number(payment.amount ?? 0).toLocaleString()} deleted`,
        metadata: { paymentId, scheduleId: sid, amount: payment.amount },
      });
    }

    revalidatePath(`/accounts/${id}`);
    updateTag("account");
    updateTag(`account-${id}`);
    updateTag("accounts-page");
    updateTag("borrowers");
    updateTag("calendar");
    updateTag("dashboard");
    updateTag("next-collection");
  }

  async function deleteSchedule(scheduleId: string) {
    "use server";
    if (!scheduleId) return;
    const sb = await createSupabaseServer();
    const { data: sched } = await sb
      .from("payment_schedules")
      .select("id, amount_due, due_date, status")
      .eq("id", scheduleId)
      .single();
    await sb.from("schedule_payments").delete().eq("schedule_id", scheduleId);
    await sb.from("payment_schedules").delete().eq("id", scheduleId);
    await logAudit({
      action: "schedule.deleted",
      entity_type: "payment_schedule",
      entity_id: scheduleId,
      account_id: id,
      description: `Schedule deleted (due ${sched?.due_date ?? "?"}, ₱${Number(sched?.amount_due ?? 0).toLocaleString()})`,
      metadata: { scheduleId, amount_due: sched?.amount_due, due_date: sched?.due_date, status: sched?.status },
    });
    revalidatePath(`/accounts/${id}`);
    updateTag("account");
    updateTag(`account-${id}`);
    updateTag("accounts-page");
    updateTag("borrowers");
    updateTag("calendar");
    updateTag("dashboard");
    updateTag("next-collection");
  }

  async function addSchedules(
    rows: { due_date: string; amount_due: number; note?: string }[]
  ): Promise<{ error?: string }> {
    "use server";
    if (!rows.length) return { error: "No rows provided" };
    const sb = await createSupabaseServer();
    const { error } = await sb.from("payment_schedules").insert(
      rows.map((r) => ({
        account_id: id,
        due_date: r.due_date,
        amount_due: r.amount_due,
        amount_paid: r.amount_due,
        remaining_amount: 0,
        status: "paid",
        note: r.note ?? null,
      }))
    );
    if (error) return { error: error.message };
    revalidatePath(`/accounts/${id}`);
    updateTag("account");
    updateTag(`account-${id}`);
    updateTag("accounts-page");
    updateTag("borrowers");
    updateTag("calendar");
    updateTag("dashboard");
    updateTag("next-collection");
    return {};
  }

  const borrowerName = borrower
    ? `${borrower.first_name} ${borrower.last_name}`
    : "Unknown borrower";

  return (
    <div className="mx-auto max-w-8xl pb-16 relative">
      {/* <BackButton
        fallbackHref={`/borrowers/${accountRow.borrower_id}`}
        floating
      /> */}

      <NextScheduleScroller />

      <StickyAccountStrip
        borrowerName={borrowerName}
        releaseDate={accountRow.release_date ? formatScheduleDate(accountRow.release_date) : "—"}
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

      <div className="space-y-6 mt-4 sm:mt-10">
        <Link
          href={`/borrowers/${accountRow.borrower_id}`}
          className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-slate-500 transition hover:text-slate-900"
        >
          <span>←</span>
          <span>{borrowerName}</span>
        </Link>

        <header
          className={`overflow-hidden `}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="mt-1 font-black uppercase tracking-tight text-slate-900 sm:text-xl">
                {/* {accountRow.type.replace("_", " ")} */}
              </h1>
              {/* {borrower ? (
                <p className="mt-3  text-4xl font-black uppercase leading-tight text-slate-900 sm:text-3xl">
                  <Link
                    href={`/borrowers/${borrower.id}`}
                    className="transition hover:text-violet-800 hover:underline"
                  >
                    {borrowerName}
                  </Link>
                </p>
              ) : (
                <p className="mt-3 text-2xl font-black uppercase text-slate-900 sm:text-3xl">
                  {borrowerName}
                </p>
              )} */}
              {/* <p className="mt-3 text-sm text-slate-600">
                Released{" "}
                <span className="font-semibold text-slate-900">
                  {accountRow.release_date
                    ? formatScheduleDate(accountRow.release_date)
                    : "—"}
                </span>
              </p> */}
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4 lg:flex-col lg:items-end print:items-end">
              <div className="flex gap-2 print:hidden">
                {/* <PrintButton /> */}
                <ShareScheduleButton
                  borrowerName={borrowerName}
                  accountType={accountRow.type}
                  releaseDate={accountRow.release_date}
                  principal={principal}
                  collected={amountPaid}
                  remaining={amountLeft}
                  profit={profit}
                  totalPayment={totalPayment}
                  progressPct={progressPct}
                  schedules={schedules.map((s, i) => ({
                    index: i + 1,
                    due_date: s.due_date,
                    amount_due: Number(s.amount_due ?? 0),
                    amount_paid: amountPaidOnInstallment(s),
                    remaining: remainingOnInstallment(s),
                    status: s.status,
                    paid_date: s.paid_date,
                  } as ShareSchedule))}
                />
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
                  schedules={schedules.map((s, i) => ({
                    index: i + 1,
                    due_date: s.due_date,
                    amount_due: Number(s.amount_due ?? 0),
                    amount_paid: amountPaidOnInstallment(s),
                    remaining: remainingOnInstallment(s),
                    status: s.status,
                    paid_date: s.paid_date,
                  } as ShareSchedule))}
                />
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
              payment_frequency: (accountRow.payment_frequency as ActivateAccountData["payment_frequency"]) ?? "bimonthly",
              term_months: Number(accountRow.term_months ?? 1),
              schedule_mode: (accountRow.schedule_mode as ActivateAccountData["schedule_mode"]) ?? "auto",
              interest_type: (accountRow.interest_type as ActivateAccountData["interest_type"]) ?? "flat",
            }}
          />
        ) : null}

        <section aria-labelledby="balances-heading" className="hidden sm:block">
          <h2 id="balances-heading" className={`mb-3 ${nb.label}`}>
            Balances
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-4xl">
          <div
              className={`${nb.card} border-sky-900/20 bg-linear-to-br from-sky-50/90 to-white p-4`}
            >
              <p className={nb.label}>Principal</p>
              <p className="mt-1.5 text-4xl font-black tracking-tight text-slate-900">
                <AnimatedNumber value={Number(accountRow.principal_amount ?? 0)} prefix="₱" />
              </p>
              <p className="mt-1.5 text-xs text-slate-600">Loan amount</p>
            </div>
            <div
              className={`${nb.card} border-rose-900/20 bg-linear-to-br from-rose-50/90 to-white p-4`}
            >
              <p className={nb.label}>Remaining</p>
              <p className="mt-1.5 text-4xl font-black tracking-tight text-slate-900">
                <AnimatedNumber value={amountLeft} prefix="₱" />
              </p>
              <p className="mt-1.5 text-xs text-slate-600">Still to collect</p>
            </div>
            <div
              className={`${nb.card} border-emerald-900/20 bg-linear-to-br from-emerald-50/90 to-white p-4`}
            >
              <p className={nb.label}>Collected</p>
              <p className="mt-1.5 text-4xl font-black tracking-tight text-slate-900">
                <AnimatedNumber value={amountPaid} prefix="₱" />
              </p>
              <p className="mt-1.5 text-xs text-slate-600">Nabayran</p>
            </div>
   
            <div
              className={`${nb.card} border-amber-900/20 bg-linear-to-br from-amber-50/90 to-white p-4`}
            >
              <p className={nb.label}>Projected profit</p>
              <p className="mt-1.5 text-4xl font-black tracking-tight text-slate-900">
                <AnimatedNumber value={Math.max(0, profit)} prefix="₱" />
              </p>
              <p className="mt-1.5 text-xs text-slate-600">{isRolling ? "Interest charged (all cycles)" : "Over principal"}</p>
            </div>
          </div>
          <div className={`mt-3 ${nb.inset} px-4 py-3 text-sm text-slate-700`}>
            <span className="font-semibold text-slate-900">Total contract</span>{" "}
            <span className="tabular-nums">{formatMoney(isRolling ? rollingTotalContract : totalPayment)}</span>
            <span className="mx-2 text-slate-300">|</span>
            <span className="text-slate-600">
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
            className={nb.scheduleShell}
            aria-labelledby="schedule-heading"
          >
          <div className={nb.scheduleHead}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id="schedule-heading"
                  className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-foreground"
                >
                  Payment schedules
                </h2>
                {nextDue ? (
                  <p className="mt-1.5 text-sm font-semibold text-slate-800 dark:text-muted-foreground">
                    Next due{" "}
                    <span className="font-black text-slate-900 dark:text-foreground">
                      {formatScheduleDate(nextDue.due_date)}
                    </span>
                    <span className="text-slate-600 dark:text-muted-foreground"> · </span>
                    <span className="font-black tabular-nums text-slate-900 dark:text-foreground">
                      {formatMoney(remainingOnInstallment(nextDue))}
                    </span>
                    {remainingOnInstallment(nextDue) <
                    Number(nextDue.amount_due ?? 0) ? (
                      <span className="text-slate-600 dark:text-muted-foreground">
                        {" "}
                        left of{" "}
                        <span className="font-bold tabular-nums dark:text-foreground">
                          {formatMoney(Number(nextDue.amount_due ?? 0))}
                        </span>
                      </span>
                    ) : null}
                  </p>
                ) : totalInstallments > 0 && isManual ? (
                  <p className="mt-1.5 text-sm font-bold text-emerald-900 dark:text-emerald-400">

                  </p>
                ) :   <p className="mt-1.5 text-sm font-bold text-emerald-900 dark:text-emerald-400">
                    All installments settled.
                  </p>}
              </div>
              {(isManual ? principal > 0 : totalInstallments > 0) ? (
                <div className="w-full max-w-xs sm:w-48">
                  <div className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-wide text-slate-800 dark:text-muted-foreground">
                    <span>{isManual ? "Recovered" : "Progress"}</span>
                    <span className="tabular-nums text-slate-900 dark:text-foreground">
                      {progressPct}%
                    </span>
                  </div>
                  <div
                    className="h-3 overflow-hidden rounded-md border-2 border-slate-900 bg-white shadow-[2px_2px_0px_0px_#0f172a] dark:border-border dark:bg-card"
                    role="progressbar"
                    aria-valuenow={progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Installments marked paid"
                  >
                    <div
                      className="h-full bg-emerald-400"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <ScheduleEditBar allIds={schedules.map((s) => s.id)} />

          {isManual ? <div className="print:hidden "><AddSchedulesPanel accountId={accountRow.id} addSchedules={addSchedules} /></div> : null}

          {schedules.length === 0 ? (
            <div className="border-t-2 border-dashed border-slate-300 bg-slate-50/80 px-5 py-12 text-center dark:border-border/50 dark:bg-muted/50">
              <p className="text-sm font-black uppercase tracking-wide text-slate-600 dark:text-muted-foreground">
                No payment schedules yet
              </p>
            </div>
          ) : (
            <>
              <ul className="md:hidden print:hidden">
                {schedules.map((schedule, i) => {
                  const st = getScheduleStatusClasses(schedule.status);
                  const isNext = i === nextHighlightIndex;
                  return (
                    <ScheduleMobileCard
                      key={schedule.id}
                      scheduleId={schedule.id}
                      id={isNext ? "next-schedule" : undefined}
                      className={`border-b-2 border-slate-900 px-4 py-3 last:border-b-0 ${st.row}`}
                      defaultOpen={isNext || focusScheduleId === schedule.id}
                      actions={
                        <div className="space-y-3 pb-2">
                          <div className="overflow-x-auto pb-1 flex items-start gap-2">
                            <ScheduleStatusForm
                              scheduleId={schedule.id}
                              currentStatus={schedule.status}
                              dueDate={schedule.due_date}
                              updateScheduleStatus={updateScheduleStatus}
                              isRollingManual={isRolling}
                              applyPartialPayment={applyPartialPayment}
                            />
                            <ScheduleDeleteButton scheduleId={schedule.id} deleteSchedule={deleteSchedule} />
                          </div>
                          {!isRolling && schedule.status === "partial" ? (
                            <PartialPaymentForm
                              scheduleId={schedule.id}
                              applyPartialPayment={applyPartialPayment}
                              autoFocus={focusScheduleId === schedule.id}
                              dueDate={schedule.due_date}
                            />
                          ) : null}
                          {(schedule.status === "partial" || schedule.status === "paid") && (paymentsMap.get(schedule.id) ?? []).length > 0 ? (
                            <PaymentHistoryPanel
                              payments={(paymentsMap.get(schedule.id) ?? []) as SchedulePayment[]}
                              updatePayment={updatePaymentEntry}
                              deletePayment={deletePaymentEntry}
                            />
                          ) : null}
                        </div>
                      }
                    >
                      {/* always-visible card header */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black uppercase tracking-wide text-slate-400 dark:text-muted-foreground">#{i + 1}</span>
                        {isNext && (
                          <span className="inline-block rounded border-2 border-slate-900 bg-sky-200 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] dark:border-border dark:bg-sky-900/30 dark:text-sky-200">
                            Next
                          </span>
                        )}
                        <span className={`ml-auto shrink-0 rounded-full border-2 px-2 py-0.5 text-[10px] font-black capitalize shadow-[2px_2px_0px_0px_#0f172a] dark:shadow-none ${st.badge}`}>
                          {schedule.status}
                        </span>
                        <ScheduleCheckbox scheduleId={schedule.id} />
                      </div>

                      <div className="mt-1 flex items-baseline gap-2">
                        <p className="text-2xl font-black tabular-nums tracking-tight text-slate-900 dark:text-foreground">
                          {formatMoney(Number(schedule.amount_due ?? 0))}
                        </p>
                        {schedule.status === "paid" ? <PaidCheck /> : null}
                        {schedule.status === "overdue" ? <OverdueSad /> : null}
                      </div>

                      {isRolling && interestRate > 0 && (() => {
                        const due = Number(schedule.amount_due ?? 0);
                        const base = Math.round(due / (1 + interestRate / 100) * 100) / 100;
                        const interest = Math.round((due - base) * 100) / 100;
                        return (
                          <p className="text-[10px] tabular-nums text-slate-400 dark:text-muted-foreground">
                            {formatMoney(base)} + {interestRate}% (+{formatMoney(interest)})
                          </p>
                        );
                      })()}

                      <p className="mt-0.5 text-sm font-semibold text-slate-600 dark:text-muted-foreground">
                        {formatScheduleDate(schedule.due_date)}
                      </p>

                      {schedule.status === "partial" && (() => {
                        const paid = amountPaidOnInstallment(schedule);
                        const due = Number(schedule.amount_due ?? 0);
                        const pct = due > 0 ? Math.min(100, Math.round((paid / due) * 100)) : 0;
                        return (
                          <div className="mt-2">
                            <div className="flex justify-between text-[10px] font-black text-slate-500 dark:text-muted-foreground">
                              <span>Paid {formatMoney(paid)}</span>
                              <span>Left {formatMoney(remainingOnInstallment(schedule))}</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full border border-slate-300 bg-slate-100 dark:border-border dark:bg-muted">
                              <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })()}

                      {schedule.note ? (
                        <p className="mt-1 line-clamp-1 text-xs text-slate-400 dark:text-muted-foreground">{schedule.note}</p>
                      ) : null}
                    </ScheduleMobileCard>
                  );
                })}
              </ul>

              <div className="hidden md:block print:block">
                <div className="max-h-[600px] overflow-auto print:max-h-none print:overflow-visible print:overflow-x-visible">
                  <table className="w-full min-w-[900px] print:min-w-0 border-collapse text-left text-sm [print-color-adjust:exact]">
                    <thead className="sticky top-0 z-10 print:static border-t-2 border-slate-900 border-">
                      <tr className="border-b-2 border-slate-900">
                        <ScheduleSelectAllHeader
                          allIds={schedules.map((s) => s.id)}
                          className={`${nb.scheduleTh} w-10 text-center`}
                        />
                        <th scope="col" className={nb.scheduleTh}>
                          #
                        </th>
                        <th scope="col" className={nb.scheduleTh}>
                          Due date
                        </th>
                        <th
                          scope="col"
                          className={`${nb.scheduleTh} text-`}
                        >
                          Due
                        </th>
                        <th
                          scope="col"
                          className={`${nb.scheduleTh} text-center hidden `}
                        >
                          Paid
                        </th>
                        <th
                          scope="col"
                          className={`${nb.scheduleTh} text-center hidden `}
                        >
                          Left
                        </th>
                        <th scope="col" className={nb.scheduleTh}>
                          Status
                        </th>
                        <th scope="col" className={`${nb.scheduleTh} hidden print:table-cell`}>
                          Paid date
                        </th>
                        <th
                          scope="col"
                          className={`min-w-[280px] ${nb.scheduleTh} print:hidden`}
                        >
                          Update
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map((schedule, i) => {
                        const st = getScheduleStatusClasses(schedule.status);
                        const isNext = i === nextHighlightIndex;
                        return (
                          <tr
                            key={schedule.id}
                            id={isNext ? "next-schedule" : undefined}
                            className={`border-b-2 border-slate-900 last:border-b-0 transition-colors duration-700 dark:border-border ${st.row} ${isNext ? "bg-sky-100 dark:bg-sky-900/20" : ""}`}
                          >
                            <ScheduleCheckboxCell
                              scheduleId={schedule.id}
                              className={`${nb.scheduleTd} text-center whitespace-nowrap`}
                            />
                            <td className={`${nb.scheduleTd} whitespace-nowrap`}>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-block size-2 shrink-0 rounded-full border border-slate-900 ${st.dot}`}
                                  aria-hidden
                                />
                                <span className="font-black tabular-nums text-slate-900">
                                  {i + 1}
                                </span>
                                {isNext ? (
                                  <span className="rounded border-2 border-slate-900 bg-sky-200 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-900 shadow-[1px_1px_0px_0px_#0f172a]">
                                    Next
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td
                              className={`${nb.scheduleTd} whitespace-nowrap font-black text-xl text-slate-900`}
                            >
                              {formatScheduleDate(schedule.due_date)}
                            </td>
                            <td
                              className={`${nb.scheduleTd}  whitespace-nowrap text-center font-black text-xl tabular-nums text-slate-900`}
                            >
                              {formatMoney(Number(schedule.amount_due ?? 0))}
                              {isRolling && interestRate > 0 && (() => {
                                const due = Number(schedule.amount_due ?? 0);
                                const base = Math.round(due / (1 + interestRate / 100) * 100) / 100;
                                const interest = Math.round((due - base) * 100) / 100;
                                return (
                                  <p className="text-[10px] font-semibold tabular-nums text-slate-400">
                                    {formatMoney(base)} + {interestRate}%
                                    <span className="ml-1 text-slate-500">(+{formatMoney(interest)})</span>
                                  </p>
                                );
                              })()}
                            </td>
                            <td
                              className={`${nb.scheduleTd} whitespace-nowrap text-center font-black text-xl tabular-nums text-slate-800 hidden `}
                            >
                              {formatMoney(amountPaidOnInstallment(schedule))}
                            </td>
                            <td
                              className={`${nb.scheduleTd} whitespace-nowrap text-right font-black text-xl tabular-nums text-slate-900 hidden `}
                            >
                              {formatMoney(remainingOnInstallment(schedule))}
                            </td>
                            <td className={`${nb.scheduleTd} whitespace-nowrap`}>
                              <span
                                className={`inline-flex rounded-full border-2 px-2.5 py-1 text-xs font-black capitalize shadow-[2px_2px_0px_0px_#0f172a] ${st.badge}`}
                              >
                                {schedule.status}
                              </span>
                            </td>
                            <td className={`${nb.scheduleTd} whitespace-nowrap hidden print:table-cell`}>
                              {schedule.paid_date ? formatScheduleDate(schedule.paid_date) : "—"}
                            </td>
                            <td className={`${nb.scheduleTd} text-center print:hidden`}>
                              <div className="flex flex-col items-center gap-3">
                                <ScheduleStatusForm
                                  scheduleId={schedule.id}
                                  currentStatus={schedule.status}
                                  dueDate={schedule.due_date}
                                  updateScheduleStatus={updateScheduleStatus}
                                  isRollingManual={isRolling}
                                  applyPartialPayment={applyPartialPayment}
                                />
                                <ScheduleDeleteButton scheduleId={schedule.id} deleteSchedule={deleteSchedule} />
                                {!isRolling && schedule.status === "partial" ? (
                                  <PartialPaymentForm
                                    scheduleId={schedule.id}
                                    applyPartialPayment={applyPartialPayment}
                                    autoFocus={focusScheduleId === schedule.id}
                                    dueDate={schedule.due_date}
                                  />
                                ) : null}
                                {(schedule.status === "partial" ) && (paymentsMap.get(schedule.id) ?? []).length > 0 ? (
                                  <PaymentHistoryPanel
                                    payments={(paymentsMap.get(schedule.id) ?? []) as SchedulePayment[]}
                                    updatePayment={updatePaymentEntry}
                                    deletePayment={deletePaymentEntry}
                                  />
                                ) : null}
                                {schedule.note ? (
                                  <p className="text-xs text-slate-500">
                                    {schedule.note}
                                  </p>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
