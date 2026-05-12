import AccountsList, {
  type AccountListItem,
  type PaymentProgress,
} from "@/components/accounts/accounts-list";
import { isInstallmentFullyPaid } from "@/lib/payment-schedule/schedule-balances";
import { createSupabaseServer } from "@/lib/supabase/server";

function normalizeBorrower(raw: unknown): AccountListItem["borrower"] {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const id = String(b.id ?? "");
  const first_name = String(b.first_name ?? "");
  const last_name = String(b.last_name ?? "");
  const rawCats = b.borrower_categories;
  const catList = Array.isArray(rawCats)
    ? rawCats
    : rawCats
      ? [rawCats]
      : [];
  const borrower_categories = catList
    .map((bc: unknown) => {
      if (!bc || typeof bc !== "object") return null;
      const row = bc as Record<string, unknown>;
      let cat = row.category;
      if (Array.isArray(cat)) cat = cat[0];
      if (!cat || typeof cat !== "object") return null;
      const c = cat as Record<string, unknown>;
      return {
        category: {
          id: String(c.id ?? ""),
          name: String(c.name ?? ""),
          color: (c.color as string | null) ?? null,
        },
      };
    })
    .filter(Boolean) as NonNullable<AccountListItem["borrower"]>["borrower_categories"];

  return {
    id,
    first_name,
    last_name,
    borrower_categories,
  };
}

/** PostgREST default max rows per response; paginate to match detail-page totals. */
const PAYMENT_SCHEDULE_PAGE_SIZE = 1000;
/** Avoid oversized `.in(...)` query strings when many accounts exist. */
const ACCOUNT_ID_IN_CHUNK = 120;

async function fetchAllPaymentScheduleRowsForAccounts(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  accountIds: string[]
): Promise<
  {
    account_id: string;
    status: string;
    amount_due: number | null;
    amount_paid: number | null;
    remaining_amount: number | null;
  }[]
> {
  if (accountIds.length === 0) return [];
  const all: {
    account_id: string;
    status: string;
    amount_due: number | null;
    amount_paid: number | null;
    remaining_amount: number | null;
  }[] = [];

  for (let c = 0; c < accountIds.length; c += ACCOUNT_ID_IN_CHUNK) {
    const chunk = accountIds.slice(c, c + ACCOUNT_ID_IN_CHUNK);
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("payment_schedules")
        .select(
          "account_id, status, amount_due, amount_paid, remaining_amount"
        )
        .in("account_id", chunk)
        .range(from, from + PAYMENT_SCHEDULE_PAGE_SIZE - 1);

      if (error) {
        console.error(error);
        break;
      }
      const rows = (data ?? []) as {
        account_id: string;
        status: string;
        amount_due: number | null;
        amount_paid: number | null;
        remaining_amount: number | null;
      }[];
      all.push(...rows);
      if (rows.length < PAYMENT_SCHEDULE_PAGE_SIZE) break;
      from += PAYMENT_SCHEDULE_PAGE_SIZE;
    }
  }

  return all;
}

function buildProgressByAccount(
  schedules: {
    account_id: string;
    status: string;
    amount_due: number | null;
    amount_paid: number | null;
    remaining_amount: number | null;
  }[]
): Record<string, PaymentProgress> {
  const byAccount = new Map<string, { total: number; paid: number }>();
  for (const s of schedules) {
    const cur = byAccount.get(s.account_id) ?? { total: 0, paid: 0 };
    cur.total += 1;
    if (isInstallmentFullyPaid(s)) cur.paid += 1;
    byAccount.set(s.account_id, cur);
  }
  const out: Record<string, PaymentProgress> = {};
  for (const [accountId, { total, paid }] of byAccount) {
    out[accountId] = {
      paid,
      total,
      pct: total > 0 ? Math.round((paid / total) * 100) : 0,
    };
  }
  return out;
}

export default async function AccountsIndexPage() {
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("accounts")
    .select(
      `
      id,
      borrower_id,
      type,
      status,
      principal_amount,
      interest_rate,
      payment_frequency,
      release_date,
      borrower:borrowers (
        id,
        first_name,
        last_name,
        borrower_categories (
          category:categories (
            id,
            name,
            color
          )
        )
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
  }

  const baseRows = (data ?? []).map((row: any) => {
    const br = Array.isArray(row.borrower) ? row.borrower[0] : row.borrower;
    return {
      ...row,
      borrower: normalizeBorrower(br),
    };
  }) as Omit<AccountListItem, "payment_progress">[];

  const accountIds = baseRows.map((r) => r.id);
  let progressById: Record<string, PaymentProgress> = {};

  if (accountIds.length > 0) {
    const schedRows = await fetchAllPaymentScheduleRowsForAccounts(
      supabase,
      accountIds
    );
    progressById = buildProgressByAccount(schedRows);
  }

  const rows: AccountListItem[] = baseRows.map((r) => ({
    ...r,
    payment_progress:
      progressById[r.id] ?? { paid: 0, total: 0, pct: 0 },
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <AccountsList accounts={rows} />
    </div>
  );
}
