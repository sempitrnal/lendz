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
};

type AccountRow = { id: string; borrower_id: string };
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
    out[id] = { next_collection_date: null, next_collection_amount: 0, next_collection_status: null, overdue_count: 0, overdue_total: 0, overdue_schedules: [], accounts_count: 0, account_schedules: [] };
  }
  if (borrowerIds.length === 0 || accountRows.length === 0) {
    return out;
  }

  const accountIdsByBorrower = new Map<string, string[]>();
  for (const row of accountRows) {
    const list = accountIdsByBorrower.get(row.borrower_id) ?? [];
    list.push(row.id);
    accountIdsByBorrower.set(row.borrower_id, list);
  }

  const byAccount = new Map<string, ScheduleRow[]>();
  for (const s of scheduleRows) {
    const list = byAccount.get(s.account_id) ?? [];
    list.push(s);
    byAccount.set(s.account_id, list);
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
      accountSchedules.push({ due_date: nu.due_date, amount: nu.remaining, status: nu.status });
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
    };
  }
  return out;
}
