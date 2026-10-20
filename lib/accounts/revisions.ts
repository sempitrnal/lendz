import { supabase } from "@/lib/supabase/client";

/**
 * Account revisions: a copy of an account, its schedules and their payment
 * records, saved right before an edit changes them (see the
 * account_revisions migration), so "revert last update" can put them back.
 */

type Row = Record<string, unknown> & { id: string };

export type AccountRevision = {
  id: string;
  account_id: string;
  created_at: string;
  reason: string;
  account: Row;
  schedules: Row[];
  payments: Row[];
  reverted_at: string | null;
};

/** Account columns an edit can change; only these are restored. */
const RESTORED_ACCOUNT_FIELDS = [
  "type",
  "principal_amount",
  "interest_rate",
  "term_months",
  "term_installments",
  "release_date",
  "first_payment_date",
  "payment_frequency",
  "schedule_mode",
  "interest_type",
  "status",
  "calculate_skipped_schedules",
] as const;

/** Snapshots beyond this many per account are dropped, oldest first. */
const KEEP_REVISIONS = 20;

type State = { account: Row; schedules: Row[]; payments: Row[] };

async function loadState(accountId: string): Promise<State> {
  // Schedules with their payments in one request; the account alongside.
  const [{ data: account, error: e1 }, embedded] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", accountId).single(),
    supabase
      .from("payment_schedules")
      .select("*, schedule_payments(*)")
      .eq("account_id", accountId),
  ]);
  if (e1 || !account) throw new Error(e1?.message ?? "Account not found");

  if (!embedded.error) {
    const schedules: Row[] = [];
    const payments: Row[] = [];
    for (const raw of (embedded.data ?? []) as (Row & {
      schedule_payments?: Row[] | null;
    })[]) {
      const { schedule_payments, ...schedule } = raw;
      schedules.push(schedule as Row);
      payments.push(...(schedule_payments ?? []));
    }
    return { account: account as Row, schedules, payments };
  }

  // The embed was rejected: read schedules, then their payments, as before.
  const { data: schedules, error: e2 } = await supabase
    .from("payment_schedules")
    .select("*")
    .eq("account_id", accountId);
  if (e2) throw new Error(e2.message);
  const ids = ((schedules ?? []) as Row[]).map((s) => s.id);
  const { data: payments, error: e3 } = ids.length
    ? await supabase
        .from("schedule_payments")
        .select("*")
        .in("schedule_id", ids)
    : { data: [], error: null };
  if (e3) throw new Error(e3.message);
  return {
    account: account as Row,
    schedules: (schedules ?? []) as Row[],
    payments: (payments ?? []) as Row[],
  };
}

/** Saves the account as it is now. Throws if it can't, so the edit stops. */
export async function snapshotAccount(accountId: string, reason: string) {
  const state = await loadState(accountId);
  const { error } = await supabase.from("account_revisions").insert({
    account_id: accountId,
    reason,
    ...state,
  });
  if (error) {
    throw new Error(
      error.code === "42P01" || /account_revisions/.test(error.message)
        ? "Can't save a backup of this account first: the account_revisions table is missing (apply the migration)."
        : `Can't save a backup of this account first: ${error.message}`,
    );
  }
  void pruneRevisions(accountId);
  return state;
}

/** Keeps the newest snapshots; a failure here must never fail the edit. */
async function pruneRevisions(accountId: string) {
  try {
    const { data } = await supabase
      .from("account_revisions")
      .select("id")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .range(KEEP_REVISIONS, KEEP_REVISIONS + 99);
    const old = (data ?? []).map((r: { id: string }) => r.id);
    if (old.length) {
      await supabase.from("account_revisions").delete().in("id", old);
    }
  } catch {
    // Old snapshots just stay a little longer.
  }
}

/** The newest snapshot not yet restored, or null. */
export async function latestRevision(
  accountId: string,
): Promise<AccountRevision | null> {
  const { data, error } = await supabase
    .from("account_revisions")
    .select("*")
    .eq("account_id", accountId)
    .is("reverted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as AccountRevision | null) ?? null;
}

/** Payments recorded on the account since the snapshot; a revert drops them. */
export async function paymentsSince(
  accountId: string,
  revision: AccountRevision,
): Promise<number> {
  const kept = new Set(revision.payments.map((p) => p.id));
  // Only the ids are needed to count what the snapshot doesn't have.
  const { data, error } = await supabase
    .from("schedule_payments")
    .select("id, payment_schedules!inner(account_id)")
    .eq("payment_schedules.account_id", accountId);
  if (!error) {
    return (data ?? []).filter((p: { id: string }) => !kept.has(p.id)).length;
  }
  const { payments } = await loadState(accountId);
  return payments.filter((p) => !kept.has(p.id)).length;
}

/**
 * Puts the account back exactly as the snapshot had it: terms, schedules
 * (original ids, so checklist links hold) and payment records. The current
 * state is snapshotted first, so a revert can itself be reverted.
 */
export async function revertToRevision(revision: AccountRevision) {
  const accountId = revision.account_id;
  const current = await snapshotAccount(accountId, "account.reverted");

  const terms = Object.fromEntries(
    RESTORED_ACCOUNT_FIELDS.filter((k) => k in revision.account).map((k) => [
      k,
      revision.account[k],
    ]),
  );
  const { error: accountError } = await supabase
    .from("accounts")
    .update(terms)
    .eq("id", accountId);
  if (accountError) throw new Error(accountError.message);

  // Schedules the snapshot doesn't have go (their payments cascade with them).
  const keepSchedules = new Set(revision.schedules.map((s) => s.id));
  const dropSchedules = current.schedules
    .map((s) => s.id)
    .filter((id) => !keepSchedules.has(id));
  if (dropSchedules.length) {
    const { error } = await supabase
      .from("payment_schedules")
      .delete()
      .in("id", dropSchedules);
    if (error) throw new Error(error.message);
  }
  if (revision.schedules.length) {
    const { error } = await supabase
      .from("payment_schedules")
      .upsert(revision.schedules, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  // Payments: back to exactly the snapshot's set.
  const keepPayments = new Set(revision.payments.map((p) => p.id));
  const dropPayments = current.payments
    .map((p) => p.id)
    .filter((id) => !keepPayments.has(id));
  if (dropPayments.length) {
    const { error } = await supabase
      .from("schedule_payments")
      .delete()
      .in("id", dropPayments);
    if (error) throw new Error(error.message);
  }
  if (revision.payments.length) {
    const { error } = await supabase
      .from("schedule_payments")
      .upsert(revision.payments, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  await supabase
    .from("account_revisions")
    .update({ reverted_at: new Date().toISOString() })
    .eq("id", revision.id);
}
