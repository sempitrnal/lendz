import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildRenewals,
  RENEWAL_FREQUENCIES,
  renewalAccount,
  type RenewalAccountInput,
  type RenewalBorrowerInput,
  type RenewalGroup,
  type RenewalPayment,
  type RenewalSchedule,
} from "@/lib/renewals";

type Db = Pick<SupabaseClient, "from">;
type Embedded<T> = T | T[] | null;
const one = <T>(value: Embedded<T>): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

const PAGE = 1000;
const ID_CHUNK = 150;

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

type AccountRow = RenewalAccountInput & {
  borrowers: Embedded<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    deleted_at: string | null;
    borrower_categories: Array<{
      category: Embedded<{
        name: string;
        color: string | null;
        sort_order: number | null;
      }>;
    }> | null;
  }>;
};

/** Every row of a query, a page at a time. */
async function allRows<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/**
 * The renewals page's data: active auto-schedule accounts near their end,
 * with their borrowers' categories, unpaid installments and payment dates.
 */
export async function loadRenewals(
  supabase: Db,
  today: string,
): Promise<RenewalGroup[]> {
  const accountRows = await allRows<AccountRow>((from, to) =>
    supabase
      .from("accounts")
      .select(
        "id, borrower_id, principal_amount, type, payment_frequency, term_months, term_installments, borrowers!inner(id, first_name, last_name, deleted_at, borrower_categories(category:categories(name, color, sort_order)))",
      )
      .eq("status", "active")
      .in("payment_frequency", RENEWAL_FREQUENCIES)
      .is("deleted_at", null)
      .or("schedule_mode.is.null,schedule_mode.neq.manual")
      .order("id")
      .range(from, to),
  );
  const accounts = accountRows.filter((a) => !one(a.borrowers)?.deleted_at);
  if (accounts.length === 0) return [];

  const schedules: RenewalSchedule[] = [];
  for (const ids of chunks(
    accounts.map((a) => a.id),
    ID_CHUNK,
  )) {
    schedules.push(
      ...(await allRows<RenewalSchedule>((from, to) =>
        supabase
          .from("payment_schedules")
          .select(
            "id, account_id, due_date, amount_due, amount_paid, remaining_amount, status",
          )
          .in("account_id", ids)
          .order("id")
          .range(from, to),
      )),
    );
  }

  // Payment dates only matter for the accounts that qualify.
  const byAccount = new Map<string, RenewalSchedule[]>();
  for (const s of schedules) {
    const list = byAccount.get(s.account_id) ?? [];
    list.push(s);
    byAccount.set(s.account_id, list);
  }
  const qualifying = accounts.filter(
    (a) => renewalAccount(a, byAccount.get(a.id) ?? [], [], today) !== null,
  );
  const scheduleIds = qualifying.flatMap((a) =>
    (byAccount.get(a.id) ?? []).map((s) => s.id),
  );
  const payments: RenewalPayment[] = [];
  for (const ids of chunks(scheduleIds, ID_CHUNK)) {
    payments.push(
      ...(await allRows<RenewalPayment>((from, to) =>
        supabase
          .from("schedule_payments")
          .select("schedule_id, payment_date")
          .in("schedule_id", ids)
          .order("id")
          .range(from, to),
      )),
    );
  }

  const borrowers = new Map<string, RenewalBorrowerInput>();
  for (const a of qualifying) {
    const b = one(a.borrowers);
    if (!b || borrowers.has(b.id)) continue;
    const categories = (b.borrower_categories ?? [])
      .map((row) => one(row.category))
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort(
        (x, y) =>
          (x.sort_order ?? Infinity) - (y.sort_order ?? Infinity) ||
          x.name.localeCompare(y.name),
      );
    const first = categories[0];
    borrowers.set(b.id, {
      id: b.id,
      name: `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim() || "unnamed",
      category: first
        ? {
            name: first.name,
            color: first.color,
            order: first.sort_order ?? Infinity,
          }
        : null,
    });
  }

  return buildRenewals({
    borrowers: [...borrowers.values()],
    accounts: qualifying,
    schedules: qualifying.flatMap((a) => byAccount.get(a.id) ?? []),
    payments,
    today,
  });
}
