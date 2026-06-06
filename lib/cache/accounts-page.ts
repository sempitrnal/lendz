import { createClient } from "@supabase/supabase-js";
import { isInstallmentFullyPaid } from "@/lib/payment-schedule/schedule-balances";

function createSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
}

const PAYMENT_SCHEDULE_PAGE_SIZE = 1000;
const ACCOUNT_ID_IN_CHUNK = 120;

type AccountListItem = {
  id: string;
  borrower_id: string;
  type: string;
  status: string;
  principal_amount: number | null;
  interest_rate: number | null;
  payment_frequency: string | null;
  release_date: string | null;
  borrower: {
    id: string;
    first_name: string;
    last_name: string;
    borrower_categories: {
      category: {
        id: string;
        name: string;
        color: string | null;
      };
    }[];
  } | null;
};

type PaymentProgress = {
  paid: number;
  total: number;
  pct: number;
};

export type AccountsPageData = {
  rows: (AccountListItem & { payment_progress: PaymentProgress })[];
};

export async function getAccountsPageData(): Promise<AccountsPageData> {
  const supabase = createSupabaseAdmin();

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
    `,
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
  }

  const baseRows = (data ?? []).map((row: any) => {
    const br = Array.isArray(row.borrower) ? row.borrower[0] : row.borrower;
    const rawCats = br?.borrower_categories;
    const catList = Array.isArray(rawCats) ? rawCats : rawCats ? [rawCats] : [];
    const borrower_categories = catList
      .map((bc: any) => {
        if (!bc || typeof bc !== "object") return null;
        let cat = bc.category;
        if (Array.isArray(cat)) cat = cat[0];
        if (!cat || typeof cat !== "object") return null;
        return {
          category: {
            id: String(cat.id ?? ""),
            name: String(cat.name ?? ""),
            color: (cat.color as string | null) ?? null,
          },
        };
      })
      .filter(Boolean) as NonNullable<
      AccountListItem["borrower"]
    >["borrower_categories"];

    return {
      ...row,
      borrower: br
        ? {
            id: String(br.id ?? ""),
            first_name: String(br.first_name ?? ""),
            last_name: String(br.last_name ?? ""),
            borrower_categories,
          }
        : null,
    };
  }) as Omit<AccountListItem, "payment_progress">[];

  const accountIds = baseRows.map((r) => r.id);
  let progressById: Record<string, PaymentProgress> = {};

  if (accountIds.length > 0) {
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
        const { data: schedData, error: schedError } = await supabase
          .from("payment_schedules")
          .select(
            "account_id, status, amount_due, amount_paid, remaining_amount",
          )
          .in("account_id", chunk)
          .range(from, from + PAYMENT_SCHEDULE_PAGE_SIZE - 1);

        if (schedError) {
          console.error(schedError);
          break;
        }
        const rows = (schedData ?? []) as {
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

    const byAccount = new Map<string, { total: number; paid: number }>();
    for (const s of all) {
      const cur = byAccount.get(s.account_id) ?? { total: 0, paid: 0 };
      cur.total += 1;
      if (isInstallmentFullyPaid(s)) cur.paid += 1;
      byAccount.set(s.account_id, cur);
    }
    for (const [accountId, { total, paid }] of byAccount) {
      progressById[accountId] = {
        paid,
        total,
        pct: total > 0 ? Math.round((paid / total) * 100) : 0,
      };
    }
  }

  const rows = baseRows.map((r) => ({
    ...r,
    payment_progress: progressById[r.id] ?? { paid: 0, total: 0, pct: 0 },
  }));

  return { rows };
}
