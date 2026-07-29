"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import type { PaidDateStrategy } from "@/components/batch-schedule-toolbar";

const scheduleStatuses = ["pending", "paid", "overdue", "partial"] as const;
type ScheduleStatus = (typeof scheduleStatuses)[number];

function revalidateScheduleCaches(accountId: string) {
  revalidatePath(`/accounts/${accountId}`);
  revalidateTag("account-detail", "max");
  revalidateTag("borrower-accounts", "max");
  updateTag("account-detail");
  updateTag("account");
  updateTag(`account-${accountId}`);
  updateTag("borrower-accounts");
  updateTag("accounts-page");
  updateTag("borrowers");
  updateTag("calendar");
  updateTag("dashboard");
  updateTag("next-collection");
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
    .select("id, amount_due, due_date")
    .eq("id", scheduleId)
    .single();

  if (!row) return;

  const due = Math.max(0, Number(row.amount_due ?? 0));
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

  await updateSupabase
    .from("payment_schedules")
    .update(patch)
    .eq("id", scheduleId);

  await logAudit({
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

  if (status === "paid" && due > 0) {
    await updateSupabase.from("schedule_payments").insert({
      schedule_id: scheduleId,
      amount: due,
      payment_date: paidDate,
    });
  }

  if (status === "pending" || status === "overdue" || status === "partial") {
    await updateSupabase
      .from("schedule_payments")
      .delete()
      .eq("schedule_id", scheduleId);
  }

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

  await Promise.all(
    rows.map(async (row) => {
      const due = Math.max(0, Number(row.amount_due ?? 0));
      const paidDate =
        paidDateStrategy === "custom"
          ? customDate || null
          : row.due_date || null;

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
    }),
  );

  await logAudit({
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
  const { data: row } = await sb
    .from("payment_schedules")
    .select("id, account_id, amount_due, amount_paid, status, note, due_date")
    .eq("id", scheduleId)
    .single();

  if (!row) return;

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

  await sb.from("schedule_payments").insert({
    schedule_id: scheduleId,
    amount: add,
    payment_date: paymentDate,
    note: noteRaw || null,
  });

  if (isRollingManualPayment && balanceForNextCycle > 0) {
    const rate = Number(acc!.interest_rate ?? 0);
    const nextDue =
      Math.round(balanceForNextCycle * (1 + rate / 100) * 100) / 100;
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
  await sb.from("schedule_payments").update(patch).eq("id", paymentId);

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

  await sb.from("schedule_payments").delete().eq("id", paymentId);

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
    const nextStatus =
      newPaid >= due ? "paid" : newPaid > 0 ? "partial" : "pending";
    await sb
      .from("payment_schedules")
      .update({
        amount_paid: newPaid,
        remaining_amount: remaining,
        status: nextStatus,
        paid_date: null,
      })
      .eq("id", sid);

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
