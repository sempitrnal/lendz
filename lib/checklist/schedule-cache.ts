import { supabase } from "@/lib/supabase/client";
import {
  accountBalances,
  remainingOnInstallment,
  type AccountBalanceInput,
  type ScheduleBalanceInput,
} from "@/lib/payment-schedule/schedule-balances";
import { extractScheduleRefs } from "@/lib/checklist/labels";
import { readStored, writeStored } from "@/lib/offline/storage";
import { getPendingOutboxCount } from "@/lib/offline/outbox";

/**
 * Data behind the checklist's payment dialogs ("Update payment status" and
 * "Mark all paid"): the linked schedule rows and each owning account's
 * paid/left summary. Kept in localStorage so the dialogs open offline, and
 * patched locally when a payment is saved offline so they reflect it until
 * the outbox replays.
 */

export type ScheduleDialogRow = {
  id: string;
  account_id: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  remaining_amount: number;
  status: string;
};

export type AccountSummary = {
  typeLabel: string;
  isCashAdvance: boolean;
  paid: number;
  left: number;
  pct: number;
  paidInstallments: number;
  installmentCount: number;
};

const SCHEDULES_KEY = "lendz-checklist-schedules";
const SUMMARIES_KEY = "lendz-checklist-account-summaries";
/** Cached entries not refreshed for this long are pruned. */
const KEEP_MS = 45 * 24 * 60 * 60 * 1000;

type Stamped<T> = T & { cachedAt: number };

const SCHEDULE_COLUMNS =
  "id, account_id, due_date, amount_due, amount_paid, remaining_amount, status";

type SummaryAccountRow = AccountBalanceInput & {
  id: string;
  type: string | null;
};

const SUMMARY_ACCOUNT_COLUMNS =
  "id, type, schedule_mode, interest_type, principal_amount, interest_rate";
const SUMMARY_SCHEDULE_COLUMNS =
  "amount_due, amount_paid, remaining_amount, status";

type AccountWithSchedules = SummaryAccountRow & {
  payment_schedules: ScheduleBalanceInput[] | null;
};

// --- Local store ---

function readMap<T>(key: string): Record<string, Stamped<T>> {
  return readStored<Record<string, Stamped<T>>>(key) ?? {};
}

function mergeMap<T>(key: string, entries: Record<string, T>) {
  const now = Date.now();
  const map = readMap<T>(key);
  for (const [id, value] of Object.entries(entries)) {
    map[id] = { ...value, cachedAt: now };
  }
  for (const [id, value] of Object.entries(map)) {
    if (now - value.cachedAt > KEEP_MS) delete map[id];
  }
  writeStored(key, map);
}

function strip<T>(stamped: Stamped<T>): T {
  const value: Partial<Stamped<T>> = { ...stamped };
  delete value.cachedAt;
  return value as T;
}

export function readCachedSchedules(ids: string[]): ScheduleDialogRow[] {
  const map = readMap<ScheduleDialogRow>(SCHEDULES_KEY);
  return ids.flatMap((id) => (map[id] ? [strip(map[id])] : []));
}

function cacheSchedules(rows: ScheduleDialogRow[]) {
  mergeMap(SCHEDULES_KEY, Object.fromEntries(rows.map((r) => [r.id, r])));
}

/** Summaries for the accounts owning `scheduleIds`, via the cached rows. */
export function readCachedSummaries(
  scheduleIds: string[],
): Record<string, AccountSummary> | null {
  const rows = readCachedSchedules(scheduleIds);
  if (rows.length === 0) return null;
  const map = readMap<AccountSummary>(SUMMARIES_KEY);
  const out: Record<string, AccountSummary> = {};
  for (const row of rows) {
    if (map[row.account_id]) out[row.account_id] = strip(map[row.account_id]);
  }
  return Object.keys(out).length > 0 ? out : null;
}

// --- Network ---

/** Schedule rows by id (chunked), cached on success. */
export async function fetchSchedules(
  ids: string[],
): Promise<ScheduleDialogRow[]> {
  const all: ScheduleDialogRow[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const { data, error } = await supabase
      .from("payment_schedules")
      .select(SCHEDULE_COLUMNS)
      .in("id", ids.slice(i, i + 50));
    if (error) throw new Error(error.message);
    all.push(...((data ?? []) as ScheduleDialogRow[]));
  }
  cacheSchedules(all);
  return all;
}

/**
 * Accounts owning any of `scheduleIds`, each with all its schedules, in one
 * round trip: `linked` is an empty inner embed that only filters the accounts.
 * Needs nothing but the schedule ids, so it runs alongside the row fetch.
 */
async function fetchAccountsForSchedules(
  scheduleIds: string[],
): Promise<AccountWithSchedules[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select(
      `${SUMMARY_ACCOUNT_COLUMNS}, payment_schedules(${SUMMARY_SCHEDULE_COLUMNS}), linked:payment_schedules!inner()`,
    )
    .in("linked.id", scheduleIds);
  if (!error) return (data ?? []) as AccountWithSchedules[];

  // Fallback if the embed form is rejected: resolve accounts first.
  console.warn("account summary embed failed, falling back:", error.message);
  const linked = await supabase
    .from("payment_schedules")
    .select("account_id")
    .in("id", scheduleIds);
  if (linked.error) throw new Error(linked.error.message);
  const accountIds = [
    ...new Set(
      ((linked.data ?? []) as { account_id: string }[]).map(
        (r) => r.account_id,
      ),
    ),
  ];
  if (accountIds.length === 0) return [];
  const [accountsRes, schedulesRes] = await Promise.all([
    supabase
      .from("accounts")
      .select(SUMMARY_ACCOUNT_COLUMNS)
      .in("id", accountIds),
    supabase
      .from("payment_schedules")
      .select(`account_id, ${SUMMARY_SCHEDULE_COLUMNS}`)
      .in("account_id", accountIds),
  ]);
  if (accountsRes.error) throw new Error(accountsRes.error.message);
  if (schedulesRes.error) throw new Error(schedulesRes.error.message);
  const byAccount = new Map<string, ScheduleBalanceInput[]>();
  for (const row of (schedulesRes.data ?? []) as (ScheduleBalanceInput & {
    account_id: string;
  })[]) {
    const list = byAccount.get(row.account_id) ?? [];
    list.push(row);
    byAccount.set(row.account_id, list);
  }
  return ((accountsRes.data ?? []) as SummaryAccountRow[]).map((a) => ({
    ...a,
    payment_schedules: byAccount.get(a.id) ?? [],
  }));
}

/** Type + paid/left for every account behind the linked schedules. */
async function fetchAccountSummaries(
  scheduleIds: string[],
): Promise<Record<string, AccountSummary>> {
  const accounts = await fetchAccountsForSchedules(scheduleIds);
  const summaries: Record<string, AccountSummary> = {};
  for (const account of accounts) {
    const b = accountBalances(account, account.payment_schedules ?? []);
    const isCashAdvance = account.type === "cash_advance";
    const base = isCashAdvance ? "cash advance" : "loan";
    const paid = b.amountPaid;
    const left = b.amountLeftToPay;
    const total = paid + left;
    summaries[account.id] = {
      typeLabel: b.isManual
        ? `${base} · manual ${b.isRolling ? "rolling" : "flat"}`
        : base,
      isCashAdvance,
      paid,
      left,
      pct: total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0,
      paidInstallments: b.paidInstallments,
      installmentCount: b.installmentCount,
    };
  }
  mergeMap(SUMMARIES_KEY, summaries);
  return summaries;
}

// --- What the dialogs call ---

/** Live rows when online (falling back to the cache), cached rows offline. */
export async function loadSchedules(
  ids: string[],
): Promise<ScheduleDialogRow[]> {
  if (navigator.onLine) {
    try {
      return await fetchSchedules(ids);
    } catch (err) {
      const cached = readCachedSchedules(ids);
      if (cached.length > 0) return cached;
      throw err;
    }
  }
  return readCachedSchedules(ids);
}

/** Same as `loadSchedules`, for the account summaries. */
export async function loadAccountSummaries(
  scheduleIds: string[],
): Promise<Record<string, AccountSummary>> {
  if (navigator.onLine) {
    try {
      return await fetchAccountSummaries(scheduleIds);
    } catch (err) {
      const cached = readCachedSummaries(scheduleIds);
      if (cached) return cached;
      throw err;
    }
  }
  return readCachedSummaries(scheduleIds) ?? {};
}

/**
 * Prefetches rows + summaries for every schedule linked from `labels`, so the
 * payment dialogs open offline for those checklist items.
 */
export async function warmScheduleCache(labels: string[]) {
  const ids = [
    ...new Set(labels.flatMap((l) => extractScheduleRefs(l).map((r) => r.id))),
  ];
  if (ids.length === 0) return;
  await Promise.all([
    fetchSchedules(ids),
    // The summary embed filters with `in`, so keep its URL bounded too.
    ...Array.from({ length: Math.ceil(ids.length / 50) }, (_, i) =>
      fetchAccountSummaries(ids.slice(i * 50, i * 50 + 50)),
    ),
  ]);
}

/**
 * Applies payments saved offline to the cached rows and summaries, mirroring
 * what the server actions will do once replayed. `amount` is what was paid
 * toward each schedule (its full remaining balance when marked paid).
 */
export function applyOfflinePayments(
  payments: { scheduleId: string; amount: number }[],
) {
  const rows = new Map(
    readCachedSchedules(payments.map((p) => p.scheduleId)).map((r) => [
      r.id,
      r,
    ]),
  );
  const summaries = readMap<AccountSummary>(SUMMARIES_KEY);
  const changedRows: ScheduleDialogRow[] = [];
  const changedSummaries: Record<string, AccountSummary> = {};

  for (const { scheduleId, amount } of payments) {
    const row = rows.get(scheduleId);
    if (!row || row.status === "paid") continue;
    const remaining = remainingOnInstallment(row);
    const applied = Math.min(Math.max(0, amount), remaining);
    if (applied <= 0) continue;
    const left = Math.max(0, remaining - applied);
    const next: ScheduleDialogRow = {
      ...row,
      amount_paid: Number(row.amount_paid ?? 0) + applied,
      remaining_amount: left,
      status: left <= 0 ? "paid" : "partial",
    };
    rows.set(scheduleId, next);
    changedRows.push(next);

    const base =
      changedSummaries[row.account_id] ??
      (summaries[row.account_id] ? strip(summaries[row.account_id]) : null);
    if (!base) continue;
    const paid = base.paid + applied;
    const accountLeft = Math.max(0, base.left - applied);
    const total = paid + accountLeft;
    changedSummaries[row.account_id] = {
      ...base,
      paid,
      left: accountLeft,
      pct: total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0,
      paidInstallments: Math.min(
        base.installmentCount,
        base.paidInstallments + (left <= 0 ? 1 : 0),
      ),
    };
  }

  cacheSchedules(changedRows);
  mergeMap(SUMMARIES_KEY, changedSummaries);
}

/**
 * Whether a failed server action call was captured by the service worker's
 * outbox (it queues same-origin POSTs whose fetch fails) and will replay —
 * so the caller should treat it as saved, not offer a retry that would apply
 * the payment twice. `before` is `getPendingOutboxCount()` taken before the call.
 */
export async function actionWasQueued(before: number): Promise<boolean> {
  if (!navigator.onLine) return true;
  return (await getPendingOutboxCount()) > before;
}
