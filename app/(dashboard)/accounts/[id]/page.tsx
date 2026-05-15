import { createSupabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import BackButton from "@/components/back-button";
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
import BatchScheduleToolbar from "@/components/batch-schedule-toolbar";
import type { PaidDateStrategy } from "@/components/batch-schedule-toolbar";
import ShareScheduleButton from "@/components/share-schedule-button";
import type { ShareSchedule } from "@/components/share-schedule-button";
import AnimatedNumber from "@/components/animated-number";
import PaidCheck from "@/components/paid-check";
import OverdueSad from "@/components/overdue-sad";
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
    "overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-[5px_5px_0px_0px_#0f172a]",
  scheduleHead:
    "border-b-2  border-slate-900 bg-green-300 px-4 py-3 sm:px-5 sm:py-4",
  scheduleTh:
    "border-r-2  border-b-2 border-slate-900 bg-slate-100 px-3 py-2.5 text-left text-[11px] font-black uppercase tracking-wide text-slate-900 last:border-r-0",
  scheduleTd:
    "border-r-2 border-slate-900 px-3 py-2.5 align-middle text-slate-900 last:border-r-0",
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
      badge: "border-emerald-600/80 bg-emerald-50 text-emerald-900",
      row: "bg-emerald-100",
      dot: "bg-emerald-500",
      text: "text-green-500"
    };
  }
  if (status === "partial") {
    return {
      badge: "border-violet-600/80 bg-violet-50 text-violet-950",
      row: "bg-violet-100",
      dot: "bg-violet-500",
      text: "text-violet-500"
    };
  }
  if (status === "overdue") {
    return {
      badge: "border-rose-600/80 bg-rose-50 text-rose-900",
      row: "bg-rose-50",
      dot: "bg-rose-500",
      text: "text-rose-     800"
    };
  }
  return {
    badge: "border-amber-600/80 bg-amber-50 text-amber-950",
    row: "bg-amber-50/50",
    dot: "bg-amber-500",
    text: "text-amber-800",

  };
}

export default async function AccountDetailPage({
  params,
  searchParams,
}: AccountDetailPageProps & { searchParams: Promise<{ focus?: string }> }) {
  const { id } = await params;
  const { focus: focusScheduleId } = await searchParams;
  const supabase = await createSupabaseServer();

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select(
      "id, borrower_id, type, status, release_date, principal_amount, interest_rate, term_months, payment_frequency, schedule_mode, created_at"
    )
    .eq("id", id)
    .single();

  if (accountError || !account) {
    notFound();
  }

  const { data: borrower } = await supabase
    .from("borrowers")
    .select("id, first_name, last_name")
    .eq("id", account.borrower_id)
    .single<BorrowerRow>();

  let schedulesData: unknown[] | null = null;
  {
    const res = await supabase
      .from("payment_schedules")
      .select(
        "id, account_id, due_date, amount_due, amount_paid, remaining_amount, note, paid_date, status"
      )
      .eq("account_id", account.id)
      .order("due_date", { ascending: true });
    if (res.error) {
      const fb1 = await supabase
        .from("payment_schedules")
        .select(
          "id, account_id, due_date, amount_due, amount_paid, remaining_amount, note, status"
        )
        .eq("account_id", account.id)
        .order("due_date", { ascending: true });
      if (fb1.error) {
        const fb2 = await supabase
          .from("payment_schedules")
          .select("id, account_id, due_date, amount_due, status")
          .eq("account_id", account.id)
          .order("due_date", { ascending: true });
        schedulesData = (fb2.data ?? []) as unknown[];
      } else {
        schedulesData = fb1.data ?? [];
      }
    } else {
      schedulesData = res.data ?? [];
    }
  }

  // Fetch schedule_payments for all schedules in this account
  const scheduleIds = ((schedulesData ?? []) as { id: string }[]).map((s) => s.id);
  let paymentsMap = new Map<string, SchedulePaymentRow[]>();
  if (scheduleIds.length > 0) {
    const { data: paymentsData } = await supabase
      .from("schedule_payments")
      .select("id, schedule_id, amount, payment_date, note, created_at")
      .in("schedule_id", scheduleIds)
      .order("created_at", { ascending: true });
    for (const p of (paymentsData ?? []) as SchedulePaymentRow[]) {
      const list = paymentsMap.get(p.schedule_id) ?? [];
      list.push(p);
      paymentsMap.set(p.schedule_id, list);
    }
  }

  const schedules = (schedulesData ?? []) as PaymentScheduleRow[];
  const accountRow = account as AccountRow;
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

  const principal = Number(accountRow.principal_amount ?? 0);
  const isManual = accountRow.schedule_mode === "manual";

  const amountLeft = isManual ? Math.max(0, principal - amountPaid) : amountLeftRaw;

  const profit = totalPayment - principal;
  const totalInstallments = schedules.length;
  const totalScheduledDue = schedules.reduce((s, r) => s + Math.max(0, Number(r.amount_due ?? 0)), 0);
  const totalScheduledPaid = schedules.reduce((s, r) => s + Math.max(0, Number(r.amount_paid ?? 0)), 0);
  const progressPct = isManual
    ? principal > 0
      ? Math.min(100, Math.round((amountPaid / principal) * 100))
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

    for (const row of rows) {
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
    }

    revalidatePath(`/accounts/${accountRow.id}`);
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

    const due = Math.max(0, Number(row.amount_due ?? 0));
    const prevPaid = Math.max(0, Number(row.amount_paid ?? 0));
    const newPaid = Math.min(due, prevPaid + add);
    const remaining = Math.max(0, due - newPaid);
    /** Any successful partial submit marks the row partial until fully paid. */
    const nextStatus = newPaid >= due ? "paid" : "partial";
    const paymentDate = paymentDateRaw || null;

    const updatePayload: Record<string, string | number | null> = {
      amount_paid: newPaid,
      remaining_amount: remaining,
      status: nextStatus,
    };
    if (noteRaw.length > 0) {
      updatePayload.note = noteRaw;
    }
    if (nextStatus === "paid") {
      updatePayload.paid_date = paymentDate;
    }

    await sb.from("payment_schedules").update(updatePayload).eq("id", scheduleId);

    // Insert into schedule_payments history
    await sb.from("schedule_payments").insert({
      schedule_id: scheduleId,
      amount: add,
      payment_date: paymentDate,
      note: noteRaw || null,
    });

    revalidatePath(`/accounts/${row.account_id as string}`);
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
      .select("id, amount_due, amount_paid")
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
      }).eq("id", sid);
    }

    revalidatePath(`/accounts/${id}`);
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
    return {};
  }

  const borrowerName = borrower
    ? `${borrower.first_name} ${borrower.last_name}`
    : "Unknown borrower";

  return (
    <div className="mx-auto max-w-8xl pb-16">
      <div className="mb-8 print:hidden">
        <BackButton
          fallbackHref={`/borrowers/${accountRow.borrower_id}`}
          className="mb-6"
        />
      </div>

      <div className="space-y-6">
        <header
          className={`overflow-hidden `}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="mt-1 font-black uppercase tracking-tight text-slate-900 sm:text-xl">
                {accountRow.type.replace("_", " ")}
              </h1>
              {borrower ? (
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
              )}
              <p className="mt-3 text-sm text-slate-600">
                Released{" "}
                <span className="font-semibold text-slate-900">
                  {accountRow.release_date
                    ? formatScheduleDate(accountRow.release_date)
                    : "—"}
                </span>
              </p>
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
              <span
                className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${accountStatusClasses.badge}`}
              >
                {accountRow.status}
              </span>
              <dl className="grid gap-2 text-sm sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-1">
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
              </dl>
            </div>
          </div>
        </header>

        <section aria-labelledby="balances-heading">
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
              <p className="mt-1.5 text-xs text-slate-600">Over principal</p>
            </div>
          </div>
          <div className={`mt-3 ${nb.inset} px-4 py-3 text-sm text-slate-700`}>
            <span className="font-semibold text-slate-900">Total contract</span>{" "}
            <span className="tabular-nums">{formatMoney(totalPayment)}</span>
            <span className="mx-2 text-slate-300">|</span>
            <span className="text-slate-600">
              {isManual
                ? `${formatMoney(amountPaid)} of ${formatMoney(principal)} recovered`
                : `${schedules.filter((s) => isInstallmentFullyPaid(s)).length} of ${totalInstallments} installments paid`}
            </span>
          </div>
        </section>

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
                  className="text-sm font-black uppercase tracking-wide text-slate-900"
                >
                  Payment schedules
                </h2>
                {nextDue ? (
                  <p className="mt-1.5 text-sm font-semibold text-slate-800">
                    Next due{" "}
                    <span className="font-black text-slate-900">
                      {formatScheduleDate(nextDue.due_date)}
                    </span>
                    <span className="text-slate-600"> · </span>
                    <span className="font-black tabular-nums text-slate-900">
                      {formatMoney(remainingOnInstallment(nextDue))}
                    </span>
                    {remainingOnInstallment(nextDue) <
                    Number(nextDue.amount_due ?? 0) ? (
                      <span className="text-slate-600">
                        {" "}
                        left of{" "}
                        <span className="font-bold tabular-nums">
                          {formatMoney(Number(nextDue.amount_due ?? 0))}
                        </span>
                      </span>
                    ) : null}
                  </p>
                ) : totalInstallments > 0 && isManual ? (
                  <p className="mt-1.5 text-sm font-bold text-emerald-900">
                    
                  </p>
                ) :   <p className="mt-1.5 text-sm font-bold text-emerald-900">
                    All installments settled.
                  </p>}
              </div>
              {(isManual ? principal > 0 : totalInstallments > 0) ? (
                <div className="w-full max-w-xs sm:w-48">
                  <div className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-wide text-slate-800">
                    <span>{isManual ? "Recovered" : "Progress"}</span>
                    <span className="tabular-nums text-slate-900">
                      {progressPct}%
                    </span>
                  </div>
                  <div
                    className="h-3 overflow-hidden rounded-md border-2 border-slate-900 bg-white shadow-[2px_2px_0px_0px_#0f172a]"
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

          {isManual ? <div className="print:hidden "><AddSchedulesPanel accountId={account.id} addSchedules={addSchedules} /></div> : null}

          {schedules.length === 0 ? (
            <div className="border-t-2 border-dashed border-slate-300 bg-slate-50/80 px-5 py-12 text-center">
              <p className="text-sm font-black uppercase tracking-wide text-slate-600">
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
                      className={`border-b-2 border-slate-900 p-4 transition duration-500 last:border-b-0 ${st.row} ${isNext ? "" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-wide text-slate-600">
                            #{i + 1}
                            {isNext ? (
                              <span className="ml-2 inline-block rounded border-2 border-slate-900 bg-sky-200 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]">
                                Next
                              </span>
                            ) : null}
                          </p>
                          <p className={`mt-1  flex items-center text-3xl md:text-5xl font-black tabular-nums tracking-tight text-slate-900 `}>
                            {formatMoney(Number(schedule.amount_due ?? 0))}
                            {schedule.status === "paid" ? <PaidCheck /> : null}
                            {schedule.status === "overdue" ? <OverdueSad /> : null}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold tabular-nums text-slate-600">
                            Paid {formatMoney(amountPaidOnInstallment(schedule))}{" "}
                            {remainingOnInstallment(schedule) != 0 ? schedule.amount_due  ==remainingOnInstallment(schedule) ? <span>

· Left{" "}
<span className="">{formatMoney(remainingOnInstallment(schedule))}</span>
</span>  : <span>

· Left{" "}
<span className="text-red-400 font-black text-sm">-{formatMoney(remainingOnInstallment(schedule))}</span>
</span>  : ""}

                          </p>
                          {schedule.note ? (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                              {schedule.note}
                            </p>
                          ) : null}
                          <p className="mt-0.5 text-xl font-semibold text-slate-700">
                            {formatScheduleDate(schedule.due_date)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-start gap-2">
                          <ScheduleCheckbox scheduleId={schedule.id} />
                          <span
                            className={`shrink-0 rounded-full border-2 px-2.5 py-1 text-xs font-black capitalize shadow-[2px_2px_0px_0px_#0f172a] ${st.badge}`}
                          >
                            {schedule.status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-600">
                          Update status
                        </p>
                        <div className="overflow-x-auto pb-1">
                          <ScheduleStatusForm
                            scheduleId={schedule.id}
                            currentStatus={schedule.status}
                            dueDate={schedule.due_date}
                            updateScheduleStatus={updateScheduleStatus}
                          />
                        </div>
                        {schedule.status === "partial" ? (
                          <PartialPaymentForm
                            scheduleId={schedule.id}
                            applyPartialPayment={applyPartialPayment}
                            autoFocus={focusScheduleId === schedule.id}
                            dueDate={schedule.due_date}
                          />
                        ) : null}
                        {(schedule.status === "partial" || schedule.status === "paid" && (paymentsMap.get(schedule.id)?.length ?? 0) > 1) && (paymentsMap.get(schedule.id) ?? []).length > 0 ? (
                          <PaymentHistoryPanel
                            payments={(paymentsMap.get(schedule.id) ?? []) as SchedulePayment[]}
                            updatePayment={updatePaymentEntry}
                            deletePayment={deletePaymentEntry}
                          />
                        ) : null}
                      </div>
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
                          className={`${nb.scheduleTh} text-center`}
                        >
                          Paid
                        </th>
                        <th
                          scope="col"
                          className={`${nb.scheduleTh} text-center`}
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
                            className={`border-b-2 border-slate-900 last:border-b-0 transition-colors duration-700  ${st.row} ${isNext ? "bg-sky-1000" : ""}`}
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
                            </td>
                            <td
                              className={`${nb.scheduleTd} whitespace-nowrap text-center font-black text-xl tabular-nums text-slate-800`}
                            >
                              {formatMoney(amountPaidOnInstallment(schedule))}
                            </td>
                            <td
                              className={`${nb.scheduleTd} whitespace-nowrap text-right font-black text-xl tabular-nums text-slate-900`}
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
                                />
                                {schedule.status === "partial" ? (
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
      </div>
    </div>
  );
}
