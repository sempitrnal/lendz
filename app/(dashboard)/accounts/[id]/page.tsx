import { createSupabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import BackButton from "@/components/back-button";
import PartialPaymentForm from "@/components/partial-payment-form";
import ScheduleStatusSubmitButton from "@/components/schedule-status-submit-button";
import AddSchedulesPanel from "@/components/add-schedules-panel";
import {
  amountPaidOnInstallment,
  isInstallmentFullyPaid,
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
  status: string;
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
    "border-b-2 border-slate-900 bg-green-300 px-4 py-3 sm:px-5 sm:py-4",
  scheduleTh:
    "border-r-2 border-slate-900 bg-slate-100 px-3 py-2.5 text-left text-[11px] font-black uppercase tracking-wide text-slate-900 last:border-r-0",
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
    };
  }
  if (status === "partial") {
    return {
      badge: "border-violet-600/80 bg-violet-50 text-violet-950",
      row: "bg-violet-50/60",
      dot: "bg-violet-500",
    };
  }
  if (status === "overdue") {
    return {
      badge: "border-rose-600/80 bg-rose-50 text-rose-900",
      row: "bg-rose-50",
      dot: "bg-rose-500",
    };
  }
  return {
    badge: "border-amber-600/80 bg-amber-50 text-amber-950",
    row: "bg-amber-50/50",
    dot: "bg-amber-500",
  };
}

function ScheduleStatusForm({
  scheduleId,
  currentStatus,
  updateScheduleStatus,
}: {
  scheduleId: string;
  currentStatus: string;
  updateScheduleStatus: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={updateScheduleStatus}
      className="inline-flex overflow-hidden rounded-lg border-2 border-slate-900 bg-white shadow-[2px_2px_0px_0px_#0f172a]"
    >
      <input type="hidden" name="scheduleId" value={scheduleId} />
      {scheduleStatuses.map((status, i) => {
        const isActive = currentStatus === status;
        const isFirst = i === 0;
        const isLast = i === scheduleStatuses.length - 1;
        return (
          <ScheduleStatusSubmitButton
            key={status}
            status={status}
            isActive={isActive}
            className={`border-slate-900 ${!isFirst ? "border-l-2" : ""} ${isFirst ? "rounded-l-[5px]" : ""} ${isLast ? "rounded-r-[5px]" : ""}`}
          />
        );
      })}
    </form>
  );
}

export default async function AccountDetailPage({
  params,
}: AccountDetailPageProps) {
  const { id } = await params;
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
        "id, account_id, due_date, amount_due, amount_paid, remaining_amount, note, status"
      )
      .eq("account_id", account.id)
      .order("due_date", { ascending: true });
      console.log(res.data);
    if (res.error) {
      const fb1 = await supabase
        .from("payment_schedules")
        .select(
          "id, account_id, due_date, amount_due, amount_paid, remaining_amount, status"
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
  const paidInstallments = schedules.filter((s) =>
    isInstallmentFullyPaid(s)
  ).length;
  const totalInstallments = schedules.length;
  const progressPct = isManual
    ? principal > 0
      ? Math.min(100, Math.round((amountPaid / principal) * 100))
      : 0
    : totalInstallments > 0
      ? Math.round((paidInstallments / totalInstallments) * 100)
      : 0;

  const nextHighlightIndex = schedules.findIndex(
    (s) => !isInstallmentFullyPaid(s)
  );
  const nextDue =
    nextHighlightIndex >= 0 ? schedules[nextHighlightIndex] : null;

  async function updateScheduleStatus(formData: FormData) {
    "use server";
    const scheduleId = String(formData.get("scheduleId") ?? "");
    const status = String(formData.get("status") ?? "");

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
    const patch =
      status === "paid"
        ? { status, amount_paid: due, remaining_amount: 0 }
        : { status, amount_paid: 0, remaining_amount: due };

    await updateSupabase
      .from("payment_schedules")
      .update(patch)
      .eq("id", scheduleId);

    revalidatePath(`/accounts/${accountRow.id}`);
  }

  async function applyPartialPayment(formData: FormData) {
    "use server";
    const scheduleId = String(formData.get("scheduleId") ?? "");
    const rawAmt = String(formData.get("paymentAmount") ?? "").trim();
    const noteRaw = String(formData.get("note") ?? "").trim();
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

    const updatePayload: Record<string, string | number | null> = {
      amount_paid: newPaid,
      remaining_amount: remaining,
      status: nextStatus,
    };
    if (noteRaw.length > 0) {
      updatePayload.note = noteRaw;
    }

    await sb.from("payment_schedules").update(updatePayload).eq("id", scheduleId);

    revalidatePath(`/accounts/${row.account_id as string}`);
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
        amount_paid: 0,
        remaining_amount: r.amount_due,
        status: "pending",
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
    <div className="mx-auto max-w-5xl pb-16">
      <div className="mb-8">
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
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4 lg:flex-col lg:items-end">
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
              <p className="mt-1.5 text-4xl font-black tabular-nums tracking-tight text-slate-900">
                {formatMoney(Number(accountRow.principal_amount ?? 0))}
              </p>
              <p className="mt-1.5 text-xs text-slate-600">Loan amount</p>
            </div>
            <div
              className={`${nb.card} border-rose-900/20 bg-linear-to-br from-rose-50/90 to-white p-4`}
            >
              <p className={nb.label}>Remaining</p>
              <p className="mt-1.5 text-4xl font-black tabular-nums tracking-tight text-slate-900">
                {formatMoney(amountLeft)}
              </p>
              <p className="mt-1.5 text-xs text-slate-600">Still to collect</p>
            </div>
            <div
              className={`${nb.card} border-emerald-900/20 bg-linear-to-br from-emerald-50/90 to-white p-4`}
            >
              <p className={nb.label}>Collected</p>
              <p className="mt-1.5 text-4xl font-black tabular-nums tracking-tight text-slate-900">
                {formatMoney(amountPaid)}
              </p>
              <p className="mt-1.5 text-xs text-slate-600">Nabayran</p>
            </div>
   
            <div
              className={`${nb.card} border-amber-900/20 bg-linear-to-br from-amber-50/90 to-white p-4`}
            >
              <p className={nb.label}>Projected profit</p>
              <p className="mt-1.5 text-4xl font-black tabular-nums tracking-tight text-slate-900">
                {formatMoney(Math.max(0, profit))}
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
                : `${paidInstallments} of ${totalInstallments} installments paid`}
            </span>
          </div>
        </section>

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

          {isManual ? <AddSchedulesPanel accountId={account.id} addSchedules={addSchedules} /> : null}

          {schedules.length === 0 ? (
            <div className="border-t-2 border-dashed border-slate-300 bg-slate-50/80 px-5 py-12 text-center">
              <p className="text-sm font-black uppercase tracking-wide text-slate-600">
                No payment schedules yet
              </p>
            </div>
          ) : (
            <>
              <ul className="md:hidden">
                {schedules.map((schedule, i) => {
                  const st = getScheduleStatusClasses(schedule.status);
                  const isNext = i === nextHighlightIndex;
                  return (
                    <li
                      key={schedule.id}
                      className={`border-b-2 border-slate-900 p-4 last:border-b-0 ${st.row} ${isNext ? "" : ""}`}
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
                          <p className="mt-1 text-lg font-black tabular-nums text-slate-900">
                            Due {formatMoney(Number(schedule.amount_due ?? 0))}
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
                          <p className="mt-0.5 text-sm font-semibold text-slate-700">
                            {formatScheduleDate(schedule.due_date)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border-2 px-2.5 py-1 text-xs font-black capitalize shadow-[2px_2px_0px_0px_#0f172a] ${st.badge}`}
                        >
                          {schedule.status}
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-600">
                          Update status
                        </p>
                        <ScheduleStatusForm
                          scheduleId={schedule.id}
                          currentStatus={schedule.status}
                          updateScheduleStatus={updateScheduleStatus}
                        />
                        {!isInstallmentFullyPaid(schedule) ? (
                          <div>
                            <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-600">
                              Partial payment
                            </p>
                            <PartialPaymentForm
                              scheduleId={schedule.id}
                              applyPartialPayment={applyPartialPayment}
                            />
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse border-t-2 border-slate-900 text-left text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-900">
                        <th scope="col" className={nb.scheduleTh}>
                          #
                        </th>
                        <th scope="col" className={nb.scheduleTh}>
                          Due date
                        </th>
                        <th
                          scope="col"
                          className={`${nb.scheduleTh} text-right`}
                        >
                          Due
                        </th>
                        <th
                          scope="col"
                          className={`${nb.scheduleTh} text-right`}
                        >
                          Paid
                        </th>
                        <th
                          scope="col"
                          className={`${nb.scheduleTh} text-right`}
                        >
                          Left
                        </th>
                        <th scope="col" className={nb.scheduleTh}>
                          Status
                        </th>
                        <th
                          scope="col"
                          className={`min-w-[280px] ${nb.scheduleTh}`}
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
                            className={`border-b-2 border-slate-900 last:border-b-0 transition-colors hover:bg-slate-50/90 ${st.row} ${isNext ? "bg-sky-100/70" : ""}`}
                          >
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
                              className={`${nb.scheduleTd} whitespace-nowrap font-bold text-slate-900`}
                            >
                              {formatScheduleDate(schedule.due_date)}
                            </td>
                            <td
                              className={`${nb.scheduleTd} whitespace-nowrap text-right font-black tabular-nums text-slate-900`}
                            >
                              {formatMoney(Number(schedule.amount_due ?? 0))}
                            </td>
                            <td
                              className={`${nb.scheduleTd} whitespace-nowrap text-right font-bold tabular-nums text-slate-800`}
                            >
                              {formatMoney(amountPaidOnInstallment(schedule))}
                            </td>
                            <td
                              className={`${nb.scheduleTd} whitespace-nowrap text-right font-black tabular-nums text-slate-900`}
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
                            <td className={`${nb.scheduleTd} align-top`}>
                              <div className="flex flex-col gap-3">
                                <ScheduleStatusForm
                                  scheduleId={schedule.id}
                                  currentStatus={schedule.status}
                                  updateScheduleStatus={updateScheduleStatus}
                                />
                                {!isInstallmentFullyPaid(schedule) ? (
                                  <div>
                                    <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-slate-600">
                                      Partial payment
                                    </p>
                                    <PartialPaymentForm
                                      scheduleId={schedule.id}
                                      applyPartialPayment={applyPartialPayment}
                                    />
                                  </div>
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
      </div>
    </div>
  );
}
