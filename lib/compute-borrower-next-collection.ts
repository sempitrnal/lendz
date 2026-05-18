import {
  isInstallmentFullyPaid,
  nextDueScheduleForCollection,
  remainingOnInstallment,
  type ScheduleBalanceInput,
} from "@/lib/payment-schedule/schedule-balances";

/**
 * Next collection per borrower: per account, earliest pending unpaid installment (else earliest unpaid),
 * then minimum due date across that borrower’s accounts.
 */
export type AccountScheduleEntry = {
  due_date: string;
  amount: number;
  status: string;
  total_schedules?: number;
  paid_schedules_count?: number;
  schedule_mode?: string | null;
  principal_amount?: number | null;
  amount_paid_total?: number;
};

export type BorrowerNextCollection = {
  next_collection_date: string | null;
  next_collection_amount: number;
  next_collection_amounts?: number[];
  next_collection_status: string | null;
  overdue_count: number;
  overdue_total: number;
  overdue_schedules: AccountScheduleEntry[];
  accounts_count: number;
  account_schedules: AccountScheduleEntry[];
  manual_total_principal: number;
  manual_total_paid: number;
  manual_total_remaining: number;
  manual_accounts_count: number;
};

type AccountRow = { id: string; borrower_id: string; principal_amount?: number | null; schedule_mode?: string | null };
type ScheduleRow = ScheduleBalanceInput & {
  account_id: string;
  due_date: string;
};

export function computeBorrowerNextCollectionById(
  borrowerIds: string[],
  accountRows: AccountRow[],
  scheduleRows: ScheduleRow[]
): Record<string, BorrowerNextCollection> {
  const out: Record<string, BorrowerNextCollection> = {};
  for (const id of borrowerIds) {
    out[id] = { next_collection_date: null, next_collection_amount: 0, next_collection_status: null, overdue_count: 0, overdue_total: 0, overdue_schedules: [], accounts_count: 0, account_schedules: [], manual_total_principal: 0, manual_total_paid: 0, manual_total_remaining: 0, manual_accounts_count: 0 };
  }
  if (borrowerIds.length === 0 || accountRows.length === 0) {
    return out;
  }

  const accountIdsByBorrower = new Map<string, string[]>();
  const accountById = new Map<string, AccountRow>();
  for (const row of accountRows) {
    const list = accountIdsByBorrower.get(row.borrower_id) ?? [];
    list.push(row.id);
    accountIdsByBorrower.set(row.borrower_id, list);
    accountById.set(row.id, row);
  }

  const byAccount = new Map<string, ScheduleRow[]>();
  for (const s of scheduleRows) {
    const list = byAccount.get(s.account_id) ?? [];
    list.push(s);
    byAccount.set(s.account_id, list);
  }
  const scheduleStatsByAccount = new Map<
  string,
  {
    total_schedules: number;
    paid_schedules_count: number;
  }
>();

for (const [accountId, rows] of byAccount) {
  scheduleStatsByAccount.set(accountId, {
    total_schedules: rows.length,
    paid_schedules_count: rows.filter((r) => r.status === "paid").length,
  });
}
  for (const list of byAccount.values()) {
    list.sort((a, b) => a.due_date.localeCompare(b.due_date));
  }

  const firstUnpaidByAccount = new Map<
    string,
    { due_date: string; remaining: number; status: string }
  >();
  for (const [accountId, list] of byAccount) {
    const u = nextDueScheduleForCollection(list);
    if (u) {
      firstUnpaidByAccount.set(accountId, {
        due_date: u.due_date,
        remaining: remainingOnInstallment(u),
        status: u.status,
      });
    }
  }

  for (const bid of borrowerIds) {
    const accIds = accountIdsByBorrower.get(bid) ?? [];
    let bestDate: string | null = null;
    for (const accId of accIds) {
      const nu = firstUnpaidByAccount.get(accId);
      if (!nu) continue;
      if (!bestDate || nu.due_date < bestDate) {
        bestDate = nu.due_date;
      }
    }

    const amounts: number[] = [];
    const statuses = new Set<string>();
    const accountSchedules: AccountScheduleEntry[] = [];
    for (const accId of accIds) {
      const nu = firstUnpaidByAccount.get(accId);
      if (!nu) continue;
      amounts.push(nu.remaining);
      statuses.add(nu.status);
      
      const stats = scheduleStatsByAccount.get(accId);
      const acc = accountById.get(accId);
      const accRows = byAccount.get(accId) ?? [];
      const accAmountPaid = accRows.reduce((sum, r) => sum + Number((r as any).amount_paid ?? 0), 0);

      accountSchedules.push({
        due_date: nu.due_date,
        amount: nu.remaining,
        status: nu.status,
        total_schedules: stats?.total_schedules ?? 0,
        paid_schedules_count: stats?.paid_schedules_count ?? 0,
        schedule_mode: acc?.schedule_mode ?? null,
        principal_amount: acc?.principal_amount ?? null,
        amount_paid_total: accAmountPaid,
      });
    }
    accountSchedules.sort((a, b) => a.due_date.localeCompare(b.due_date));

    let overdueCount = 0;
    let overdueTotal = 0;
    const overdueSchedules: AccountScheduleEntry[] = [];
    for (const accId of accIds) {
      const rows = byAccount.get(accId) ?? [];
      for (const row of rows) {
        if (row.status === "overdue" && !isInstallmentFullyPaid(row)) {
          overdueCount += 1;
          const remaining = remainingOnInstallment(row);
          overdueTotal += remaining;
          overdueSchedules.push({ due_date: row.due_date, amount: remaining, status: row.status });
        }
      }
    }
    overdueSchedules.sort((a, b) => a.due_date.localeCompare(b.due_date));

    let manualTotalPrincipal = 0;
    let manualTotalPaid = 0;
    let manualAccountsCount = 0;
    for (const accId of accIds) {
      const acc = accountById.get(accId);
      if (!acc || acc.schedule_mode !== "manual") continue;
      manualAccountsCount += 1;
      manualTotalPrincipal += Number(acc.principal_amount ?? 0);
      const rows = byAccount.get(accId) ?? [];
      for (const row of rows) {
        manualTotalPaid += Number((row as any).amount_paid ?? 0);
      }
    }

    out[bid] = {
      next_collection_date: bestDate,
      next_collection_amount: amounts.reduce((sum, value) => sum + value, 0),
      next_collection_amounts: amounts.length > 1 ? amounts : undefined,
      next_collection_status: statuses.has("overdue") ? "overdue" : (statuses.size > 0 ? [...statuses][0] : null),
      overdue_count: overdueCount,
      overdue_total: overdueTotal,
      overdue_schedules: overdueSchedules,
      accounts_count: accIds.length,
      account_schedules: accountSchedules,
      manual_total_principal: manualTotalPrincipal,
      manual_total_paid: manualTotalPaid,
      manual_total_remaining: Math.max(0, manualTotalPrincipal - manualTotalPaid),
      manual_accounts_count: manualAccountsCount,
    };
  }
  return out;
}
