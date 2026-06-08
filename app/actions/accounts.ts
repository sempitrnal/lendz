"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { buildSchedulesPayload } from "@/lib/payment-schedule/build-payload";
import { logAudit } from "@/lib/audit";
import { revalidateTag, updateTag } from "next/cache";

export type ActivateAccountData = {
  principal_amount: number;
  interest_rate: number;
  release_date: string;
  first_payment_date: string;
  payment_frequency: "weekly" | "monthly" | "bimonthly" | "custom";
  term_months: number;
  schedule_mode: "auto" | "manual";
  interest_type: "flat" | "rolling";
  calculate_skipped_schedules?: boolean;
};

export async function activateAccountAction(
  accountId: string,
  data: ActivateAccountData,
): Promise<{ error?: string }> {
  const sb = await createSupabaseServer();

  const { data: account, error: fetchError } = await sb
    .from("accounts")
    .select("id, borrower_id, status")
    .eq("id", accountId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !account) {
    return { error: fetchError?.message ?? "Account not found" };
  }

  if (account.status !== "pending") {
    return { error: "Account is not pending" };
  }

  // Update account with all activation details
  const { error: updateError } = await sb
    .from("accounts")
    .update({
      status: "active",
      principal_amount: data.principal_amount,
      interest_rate: data.interest_rate,
      release_date: data.release_date || null,
      first_payment_date: data.first_payment_date,
      payment_frequency: data.payment_frequency,
      term_months: data.term_months,
      schedule_mode: data.schedule_mode,
      interest_type: data.interest_type,
    })
    .eq("id", accountId);

  if (updateError) {
    return { error: updateError.message };
  }

  // Create payment schedules for auto mode
  if (data.schedule_mode === "auto") {
    const schedules = buildSchedulesPayload(accountId, {
      principal_amount: data.principal_amount,
      interest_rate: data.interest_rate,
      term_months: data.term_months,
      first_payment_date: data.first_payment_date,
      payment_frequency: data.payment_frequency,
      release_date: data.release_date,
      calculate_skipped_schedules: data.calculate_skipped_schedules,
    });

    const { error: scheduleError } = await sb
      .from("payment_schedules")
      .insert(schedules);

    if (scheduleError) {
      return { error: scheduleError.message };
    }
  }

  // Manual rolling: create first schedule
  if (
    data.schedule_mode === "manual" &&
    data.interest_type === "rolling" &&
    data.interest_rate > 0
  ) {
    const principal = data.principal_amount;
    const firstDue =
      Math.round(principal * (1 + data.interest_rate / 100) * 100) / 100;
    const dueDate = data.release_date || new Date().toISOString().split("T")[0];
    const { error: scheduleError } = await sb.from("payment_schedules").insert({
      account_id: accountId,
      due_date: dueDate,
      amount_due: firstDue,
      amount_paid: 0,
      remaining_amount: firstDue,
      status: "pending",
    });
    if (scheduleError) {
      return { error: scheduleError.message };
    }
  }

  // Mark related calendar event as completed
  await sb
    .from("calendar_events")
    .update({ status: "completed" })
    .eq("account_id", accountId)
    .eq("status", "scheduled");

  await logAudit({
    action: "account.activated",
    entity_type: "account",
    entity_id: accountId,
    account_id: accountId,
    description: "Pending account activated and payment schedules created",
    metadata: {
      schedule_mode: data.schedule_mode,
      interest_type: data.interest_type,
      payment_frequency: data.payment_frequency,
      term_months: data.term_months,
      principal_amount: data.principal_amount,
      interest_rate: data.interest_rate,
    },
  });

  revalidateTag("account-detail", "default");
  revalidateTag("borrowers", "default");
  revalidateTag("borrower-accounts", "default");
  revalidateTag("next-collection", "default");
  revalidateTag("calendar", "default");
  revalidateTag("dashboard", "default");
  updateTag("account");
  updateTag(`account-${accountId}`);
  updateTag("accounts-page");
  updateTag("borrowers");
  updateTag(`borrower-accounts-${account.borrower_id}`);
  updateTag("calendar");
  updateTag("dashboard");
  updateTag("next-collection");
  return {};
}
