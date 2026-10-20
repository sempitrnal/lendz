"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { logAuditAfter } from "@/lib/audit";
import { revalidatePath, updateTag } from "next/cache";
import type { PaidDateStrategy } from "@/components/batch-schedule-toolbar";

const scheduleStatuses = ["pending", "paid", "overdue", "partial"] as const;
type ScheduleStatus = (typeof scheduleStatuses)[number];

/**
 * Expires the cached reads an installment change shows up in. `updateTag`, so
 * the next request waits for fresh data instead of showing the old numbers.
 * Only tags that something is cached under are listed. A batch passes every
 * account it touched, and the shared tags are expired once.
 */
function revalidateScheduleCaches(accountIds: string | string[]) {
  const ids = new Set(Array.isArray(accountIds) ? accountIds : [accountIds]);
  for (const id of ids) {
    updateTag(`account-${id}`);
    revalidatePath(`/accounts/${id}`);
  }
  updateTag("schedules");
  updateTag("borrower-accounts");
  updateTag("borrowers");
  updateTag("accounts-page");
  updateTag("next-collection");
}

/** The account a schedule belongs to, when embedded in a schedule select. */
type EmbeddedAccount = {
  schedule_mode: string | null;
  interest_type: string | null;
  interest_rate?: number | null;
};
function embeddedAccount(value: unknown): EmbeddedAccount | null {
  const acc = Array.isArray(value) ? value[0] : value;
  return acc && typeof acc === "object" ? (acc as EmbeddedAccount) : null;
}

type ScheduleWithAccount = {
  id: string;
  account_id: string;
  amount_due: number | null;
  amount_paid: number | null;
  status: string;
  due_date: string;
  note?: string | null;
  account: EmbeddedAccount | null;
};

/**
 * A schedule and its account in one request. If PostgREST rejects the embed
 * (a relationship it can't resolve), falls back to reading the two separately,
 * so a payment never silently does nothing over a query shape.
 */
async function loadScheduleWithAccount(
  sb: Awaited<ReturnType<typeof createSupabaseServer>>,
  scheduleId: string,
  scheduleColumns: string,
  accountColumns: string,
): Promise<ScheduleWithAccount | null> {
  const embedded = await sb
    .from("payment_schedules")
    .select(`${scheduleColumns}, accounts(${accountColumns})`)
    .eq("id", scheduleId)
    .single();
  if (embedded.data) {
    const { accounts, ...row } = embedded.data as unknown as Record<
      string,
      unknown
    >;
    return {
      ...(row as Omit<ScheduleWithAccount, "account">),
      account: embeddedAccount(accounts),
    };
  }
  // PGRST116 is "no such row"; anything else may be the embed itself.
  if (!embedded.error || embedded.error.code === "PGRST116") return null;

  const { data: row } = await sb
    .from("payment_schedules")
    .select(scheduleColumns)
    .eq("id", scheduleId)
    .single();
  if (!row) return null;
  const base = row as unknown as Omit<ScheduleWithAccount, "account">;
  const { data: account } = await sb
    .from("accounts")
    .select(accountColumns)
    .eq("id", base.account_id)
    .single();
  return { ...base, account: embeddedAccount(account) };
}

export async function updateScheduleStatusAction(
  accountId: string,
  formData: FormData,
) {
  const scheduleId = String(formData.get("scheduleId") ?? "");
  const status = String(formData.get("status") ?? "");
  const paidDateRaw = String(formData.get("paidDate") ?? "").trim();

  if (!scheduleId || !scheduleStatuses.includes(status as ScheduleStatus)) {
    return;
  }

  const updateSupabase = await createSupabaseServer();
  const { data: row } = await updateSupabase
    .from("payment_schedules")
    .select("id, amount_due, amount_paid, due_date, status")
    .eq("id", scheduleId)
    .single();

  if (!row) return;

  const due = Math.max(0, Number(row.amount_due ?? 0));
  const alreadyPaid = row.status === "paid";
  const previouslyPaid = Math.min(
    due,
    Math.max(0, Number(row.amount_paid ?? 0)),
  );
  const paidDate = paidDateRaw || null;
  const patch: Record<string, string | number | null> =
    status === "paid"
      ? {
          status,
          amount_paid: due,
          remaining_amount: 0,
          paid_date: paidDate,
        }
      : {
          status,
          amount_paid: 0,
          remaining_amount: due,
          paid_date: null,
        };

  const owed = alreadyPaid ? 0 : due - previouslyPaid;
  // The schedule and its payment rows are separate tables; neither write
  // needs the other's result.
  await Promise.all([
    updateSupabase.from("payment_schedules").update(patch).eq("id", scheduleId),
    status === "paid"
      ? owed > 0
        ? updateSupabase.from("schedule_payments").insert({
            schedule_id: scheduleId,
            amount: owed,
            payment_date: paidDate,
          })
        : null
      : updateSupabase
          .from("schedule_payments")
          .delete()
          .eq("schedule_id", scheduleId),
  ]);

  logAuditAfter({
    action: "schedule.status_changed",
    entity_type: "payment_schedule",
    entity_id: scheduleId,
    account_id: accountId,
    description: `Schedule status changed to "${status}"`,
    metadata: {
      scheduleId,
      status,
      amount_due: due,
      due_date: row?.due_date,
      remaining_amount: status === "paid" ? 0 : due,
      paid_date: paidDate,
    },
  });

  revalidateScheduleCaches(accountId);
}

export async function batchUpdateScheduleStatusAction(
  accountId: string,
  ids: string[],
  paidDateStrategy: PaidDateStrategy,
  customDate?: string,
) {
  if (!ids.length) return;

  const updateSupabase = await createSupabaseServer();

  const { data: rows } = await updateSupabase
    .from("payment_schedules")
    .select("id, amount_due, due_date")
    .in("id", ids);

  if (!rows?.length) return;

  const paid = rows.map((row) => ({
    id: row.id as string,
    due: Math.max(0, Number(row.amount_due ?? 0)),
    paidDate:
      paidDateStrategy === "custom" ? customDate || null : row.due_date || null,
  }));

  await Promise.all(
    paid.map(({ id, due, paidDate }) =>
      updateSupabase
        .from("payment_schedules")
        .update({
          status: "paid",
          amount_paid: due,
          remaining_amount: 0,
          paid_date: paidDate,
        })
        .eq("id", id),
    ),
  );

  // One insert for all the payment rows instead of one per schedule.
  const payments = paid
    .filter(({ due }) => due > 0)
    .map(({ id, due, paidDate }) => ({
      schedule_id: id,
      amount: due,
      payment_date: paidDate,
    }));
  if (payments.length > 0) {
    await updateSupabase.from("schedule_payments").insert(payments);
  }

  logAuditAfter({
    action: "schedule.batch_paid",
    entity_type: "payment_schedule",
    account_id: accountId,
    description: `Batch marked ${ids.length} schedule${ids.length === 1 ? "" : "s"} as paid`,
    metadata: {
      ids,
      paidDateStrategy,
      customDate,
    },
  });

  revalidateScheduleCaches(accountId);
}

/** Marks schedules (possibly across accounts) fully paid in one pass. */
export async function markSchedulesPaidAction(
  ids: string[],
  paidDate: string,
): Promise<{ updated: number; skipped: number }> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return { updated: 0, skipped: 0 };

  const sb = await createSupabaseServer();
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 100) {
    chunks.push(unique.slice(i, i + 100));
  }
  const fetched = await Promise.all(
    chunks.map((chunk) =>
      sb
        .from("payment_schedules")
        .select("id, account_id, amount_due, amount_paid, status")
        .in("id", chunk),
    ),
  );
  const rows: {
    id: string;
    account_id: string;
    amount_due: number | null;
    amount_paid: number | null;
    status: string;
  }[] = [];
  for (const { data, error } of fetched) {
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
  }

  const open = rows.filter((r) => r.status !== "paid");
  const owedByRow = new Map<string, number>();
  await Promise.all(
    open.map(async (row) => {
      const due = Math.max(0, Number(row.amount_due ?? 0));
      const previouslyPaid = Math.min(
        due,
        Math.max(0, Number(row.amount_paid ?? 0)),
      );
      const { error } = await sb
        .from("payment_schedules")
        .update({
          status: "paid",
          amount_paid: due,
          remaining_amount: 0,
          paid_date: paidDate,
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      owedByRow.set(row.id, due - previouslyPaid);
    }),
  );

  // One insert for every payment row, once all the schedules are updated.
  const payments = open
    .filter((row) => (owedByRow.get(row.id) ?? 0) > 0)
    .map((row) => ({
      schedule_id: row.id,
      amount: owedByRow.get(row.id),
      payment_date: paidDate,
    }));
  if (payments.length > 0) {
    await sb.from("schedule_payments").insert(payments);
  }

  const byAccount = new Map<string, string[]>();
  for (const row of open) {
    byAccount.set(row.account_id, [
      ...(byAccount.get(row.account_id) ?? []),
      row.id,
    ]);
  }
  for (const [accountId, accountIds] of byAccount) {
    logAuditAfter({
      action: "schedule.batch_paid",
      entity_type: "payment_schedule",
      account_id: accountId,
      description: `Checklist marked ${accountIds.length} schedule${accountIds.length === 1 ? "" : "s"} as paid`,
      metadata: { ids: accountIds, paidDate, source: "checklist" },
    });
  }
  if (byAccount.size > 0) revalidateScheduleCaches([...byAccount.keys()]);

  return { updated: open.length, skipped: rows.length - open.length };
}

export async function applyPartialPaymentAction(formData: FormData) {
  const scheduleId = String(formData.get("scheduleId") ?? "");
  const rawAmt = String(formData.get("paymentAmount") ?? "").trim();
  const noteRaw = String(formData.get("note") ?? "").trim();
  const paymentDateRaw = String(formData.get("paymentDate") ?? "").trim();
  const add = Number.parseFloat(rawAmt);
  if (!scheduleId || !Number.isFinite(add) || add <= 0) {
    return;
  }

  const sb = await createSupabaseServer();
  const row = await loadScheduleWithAccount(
    sb,
    scheduleId,
    "id, account_id, amount_due, amount_paid, status, note, due_date",
    "schedule_mode, interest_type, interest_rate",
  );

  if (!row) return;

  const acc = row.account;
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

  let rolledSchedule: Record<string, string | number> | null = null;
  if (isRollingManualPayment && balanceForNextCycle > 0) {
    const rate = Number(acc?.interest_rate ?? 0);
    const nextDue =
      Math.round(balanceForNextCycle * (1 + rate / 100) * 100) / 100;
    rolledSchedule = {
      account_id: row.account_id,
      due_date: paymentDate ?? new Date().toISOString().split("T")[0],
      amount_due: nextDue,
      amount_paid: 0,
      remaining_amount: nextDue,
      status: "pending",
    };
  }

  await Promise.all([
    sb.from("payment_schedules").update(updatePayload).eq("id", scheduleId),
    sb.from("schedule_payments").insert({
      schedule_id: scheduleId,
      amount: add,
      payment_date: paymentDate,
      note: noteRaw || null,
    }),
    rolledSchedule ? sb.from("payment_schedules").insert(rolledSchedule) : null,
  ]);

  logAuditAfter({
    action: "schedule.payment_applied",
    entity_type: "payment_schedule",
    entity_id: scheduleId,
    account_id: row.account_id as string,
    description: `Payment of \u20b1${add.toLocaleString()} applied`,
    metadata: {
      scheduleId,
      amount: add,
      paymentDate,
      isRolling: isRollingManualPayment,
      newStatus: nextStatus,
      due_date: row?.due_date,
      remaining_amount: remaining,
    },
  });

  revalidateScheduleCaches(row.account_id as string);
}

export async function updatePaymentEntryAction(
  accountId: string,
  formData: FormData,
) {
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
  const newAmount = Number(patch.amount ?? oldAmount);
  const diff = newAmount - oldAmount;

  // The schedule's stored totals don't depend on the payment row, so it can be
  // read while the payment is being updated.
  const [, schedRes] = await Promise.all([
    sb.from("schedule_payments").update(patch).eq("id", paymentId),
    diff !== 0
      ? sb
          .from("payment_schedules")
          .select("id, amount_due, amount_paid")
          .eq("id", payment.schedule_id)
          .single()
      : null,
  ]);

  const sched = schedRes?.data;
  if (sched) {
    const due = Math.max(0, Number(sched.amount_due ?? 0));
    const prevPaid = Math.max(0, Number(sched.amount_paid ?? 0));
    const newPaid = Math.min(due, Math.max(0, prevPaid + diff));
    const remaining = Math.max(0, due - newPaid);
    const nextStatus =
      newPaid >= due ? "paid" : newPaid > 0 ? "partial" : "pending";
    await sb
      .from("payment_schedules")
      .update({
        amount_paid: newPaid,
        remaining_amount: remaining,
        status: nextStatus,
      })
      .eq("id", payment.schedule_id);
  }

  revalidateScheduleCaches(accountId);
}

export async function deletePaymentEntryAction(
  accountId: string,
  formData: FormData,
) {
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

  const sid = scheduleId || payment.schedule_id;
  const [, sched] = await Promise.all([
    sb.from("schedule_payments").delete().eq("id", paymentId),
    loadScheduleWithAccount(
      sb,
      sid,
      "id, account_id, amount_due, amount_paid, status, due_date",
      "schedule_mode, interest_type",
    ),
  ]);
  if (sched) {
    const due = Math.max(0, Number(sched.amount_due ?? 0));
    const prevPaid = Math.max(0, Number(sched.amount_paid ?? 0));
    const removedAmt = Math.max(0, Number(payment.amount ?? 0));
    const newPaid = Math.max(0, prevPaid - removedAmt);
    const remaining = Math.max(0, due - newPaid);
    const nextStatus =
      newPaid >= due ? "paid" : newPaid > 0 ? "partial" : "pending";
    const isRolling =
      sched.account?.schedule_mode === "manual" &&
      sched.account?.interest_type === "rolling";

    await Promise.all([
      sb
        .from("payment_schedules")
        .update({
          amount_paid: newPaid,
          remaining_amount: remaining,
          status: nextStatus,
          paid_date: null,
        })
        .eq("id", sid),
      isRolling
        ? sb
            .from("payment_schedules")
            .delete()
            .eq("account_id", sched.account_id)
            .eq("status", "pending")
            .neq("id", sid)
        : null,
    ]);

    logAuditAfter({
      action: "schedule.payment_deleted",
      entity_type: "payment_schedule",
      entity_id: sid,
      account_id: sched.account_id as string,
      description: `Payment of \u20b1${Number(payment.amount ?? 0).toLocaleString()} deleted`,
      metadata: {
        paymentId,
        scheduleId: sid,
        amount: payment.amount,
      },
    });
  }

  revalidateScheduleCaches(accountId);
}

export async function deleteScheduleAction(
  accountId: string,
  scheduleId: string,
) {
  if (!scheduleId) return;
  const sb = await createSupabaseServer();
  const [{ data: sched }] = await Promise.all([
    sb
      .from("payment_schedules")
      .select("id, amount_due, due_date, status")
      .eq("id", scheduleId)
      .single(),
    sb.from("schedule_payments").delete().eq("schedule_id", scheduleId),
  ]);
  await sb.from("payment_schedules").delete().eq("id", scheduleId);
  logAuditAfter({
    action: "schedule.deleted",
    entity_type: "payment_schedule",
    entity_id: scheduleId,
    account_id: accountId,
    description: `Schedule deleted (due ${sched?.due_date ?? "?"}, \u20b1${Number(sched?.amount_due ?? 0).toLocaleString()})`,
    metadata: {
      scheduleId,
      amount_due: sched?.amount_due,
      due_date: sched?.due_date,
      status: sched?.status,
    },
  });

  revalidateScheduleCaches(accountId);
}

export async function addSchedulesAction(
  accountId: string,
  rows: {
    due_date: string;
    amount_due: number;
    note?: string;
  }[],
): Promise<{ error?: string }> {
  if (!rows.length) return { error: "No rows provided" };
  const sb = await createSupabaseServer();
  const { error } = await sb.from("payment_schedules").insert(
    rows.map((r) => ({
      account_id: accountId,
      due_date: r.due_date,
      amount_due: r.amount_due,
      amount_paid: r.amount_due,
      remaining_amount: 0,
      status: "paid",
      note: r.note ?? null,
    })),
  );
  if (error) return { error: error.message };

  revalidateScheduleCaches(accountId);
  return {};
}

/**
 * Adds one schedule to a manual account, optionally with money already on it
 * (paid or partial), from the daily notes `/next` flow.
 */
export async function addManualScheduleAction(
  accountId: string,
  input: {
    due_date: string;
    amount_due: number;
    status: ScheduleStatus;
    amount_paid?: number;
    paid_date?: string | null;
  },
): Promise<{ id?: string; error?: string }> {
  const due = Math.round(Number(input.amount_due) * 100) / 100;
  if (!accountId || !input.due_date || !(due > 0)) {
    return { error: "Amount and due date are required" };
  }
  if (!scheduleStatuses.includes(input.status)) {
    return { error: "Invalid status" };
  }
  const paid =
    input.status === "paid"
      ? due
      : input.status === "partial"
        ? Math.min(due, Math.max(0, Number(input.amount_paid ?? 0)))
        : 0;
  if (input.status === "partial" && !(paid > 0 && paid < due)) {
    return { error: "Partial amount must be between 0 and the amount due" };
  }
  const paidDate = paid > 0 ? input.paid_date || null : null;

  const sb = await createSupabaseServer();
  const { data: account } = await sb
    .from("accounts")
    .select("id, schedule_mode")
    .eq("id", accountId)
    .single();
  if (!account) return { error: "Account not found" };
  if (account.schedule_mode !== "manual") {
    return { error: "Only manual accounts take hand-added schedules" };
  }

  const { data: row, error } = await sb
    .from("payment_schedules")
    .insert({
      account_id: accountId,
      due_date: input.due_date,
      amount_due: due,
      amount_paid: paid,
      remaining_amount: due - paid,
      status: input.status,
      paid_date: paidDate,
    })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message ?? "Insert failed" };

  if (paid > 0) {
    await sb.from("schedule_payments").insert({
      schedule_id: row.id,
      amount: paid,
      payment_date: paidDate,
    });
  }

  logAuditAfter({
    action: "schedule.added",
    entity_type: "payment_schedule",
    entity_id: row.id,
    account_id: accountId,
    description: `Schedule added (due ${input.due_date}, ₱${due.toLocaleString()}, ${input.status})`,
    metadata: {
      scheduleId: row.id,
      due_date: input.due_date,
      amount_due: due,
      amount_paid: paid,
      status: input.status,
      paid_date: paidDate,
    },
  });

  revalidateScheduleCaches(accountId);
  return { id: row.id as string };
}
