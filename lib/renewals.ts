import {
  amountPaidOnInstallment,
  isInstallmentFullyPaid,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";

/**
 * Potential renewals: borrowers with an account close to its end, so they can
 * be offered a new loan. An account qualifies with RENEWAL_MONTHS or less of
 * unpaid installments left (bimonthly: 6, monthly: 3, weekly: 12).
 */

/** How close to the end an account has to be, in months. */
export const RENEWAL_MONTHS = 3;

/** The payment frequencies the renewals page looks at, for now. */
export const RENEWAL_FREQUENCIES = ["bimonthly"];

export type RenewalAccountTerms = {
  payment_frequency: string | null;
  term_months: number | null;
  term_installments?: number | null;
};

/** How many months one installment covers. */
export function monthsPerInstallment(account: RenewalAccountTerms): number {
  switch (account.payment_frequency) {
    case "weekly":
      return 0.25;
    case "bimonthly":
      return 0.5;
    case "custom": {
      const months = Number(account.term_months) || 0;
      const count = Number(account.term_installments) || 0;
      return months > 0 && count > 0 ? months / count : 1;
    }
    default:
      return 1;
  }
}

/** The most installments an account can have left and still qualify. */
export function renewalWindow(
  account: RenewalAccountTerms,
  months = RENEWAL_MONTHS,
  /** How many installments the account has in all, when known. */
  total?: number,
): number {
  // A short account has its own window, so it doesn't qualify from day one:
  // bimonthly, 1 month (2 installments) at 1 left, 2 or 3 months (4 or 6)
  // at 2 or fewer.
  const short = total !== undefined ? SHORT_ACCOUNT_WINDOW[total] : undefined;
  if (short !== undefined) return short;
  // The small nudge keeps 3 / 0.5 = 5.999… from rounding down to 5.
  return Math.max(1, Math.floor(months / monthsPerInstallment(account) + 1e-9));
}

/** Installments in all → most left to qualify, for accounts this short. */
export const SHORT_ACCOUNT_WINDOW: Record<number, number> = {
  2: 1,
  4: 2,
  6: 2,
};

export type RenewalSchedule = {
  id: string;
  account_id: string;
  due_date: string;
  amount_due: number | null;
  amount_paid: number | null;
  remaining_amount: number | null;
  status: string;
};

export type RenewalPayment = {
  schedule_id: string;
  payment_date: string | null;
};

export type RenewalAccountInput = RenewalAccountTerms & {
  id: string;
  borrower_id: string;
  principal_amount: number | null;
  type: string | null;
};

export type RenewalBorrowerInput = {
  id: string;
  name: string;
  category: { name: string; color: string | null; order: number } | null;
};

export type RenewalPartial = {
  scheduleId: string;
  dueDate: string;
  paid: number;
  due: number;
  /** The latest day a payment was made to it. */
  lastPaid: string | null;
};

export type RenewalAccount = {
  id: string;
  type: string | null;
  principal: number;
  frequency: string | null;
  total: number;
  left: number;
  /** Months of installments left, rounded up to a whole month. */
  monthsLeft: number;
  balance: number;
  nextDue: string | null;
  lastPaid: string | null;
  overdue: number;
  partials: RenewalPartial[];
};

export type RenewalBorrower = {
  id: string;
  name: string;
  accounts: RenewalAccount[];
  /** The fewest months any of their accounts has left. */
  monthsLeft: number;
  balance: number;
  overdue: number;
};

export type RenewalGroup = {
  name: string;
  color: string | null;
  borrowers: RenewalBorrower[];
  balance: number;
};

const cents = (n: number) => Math.round(n * 100) / 100;
const maxDate = (a: string | null, b: string | null) =>
  !a ? b : !b ? a : a > b ? a : b;

/** One account's renewal summary, or null when it doesn't qualify. */
export function renewalAccount(
  account: RenewalAccountInput,
  schedules: RenewalSchedule[],
  payments: RenewalPayment[],
  today: string,
  months = RENEWAL_MONTHS,
): RenewalAccount | null {
  if (schedules.length === 0) return null;
  const open = schedules
    .filter((s) => !isInstallmentFullyPaid(s))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  if (
    open.length === 0 ||
    open.length > renewalWindow(account, months, schedules.length)
  ) {
    return null;
  }

  const lastPaidBySchedule = new Map<string, string>();
  let lastPaid: string | null = null;
  for (const p of payments) {
    if (!p.payment_date) continue;
    const day = p.payment_date.slice(0, 10);
    lastPaid = maxDate(lastPaid, day);
    lastPaidBySchedule.set(
      p.schedule_id,
      maxDate(lastPaidBySchedule.get(p.schedule_id) ?? null, day)!,
    );
  }

  const partials: RenewalPartial[] = open
    .filter((s) => amountPaidOnInstallment(s) > 0)
    .map((s) => ({
      scheduleId: s.id,
      dueDate: s.due_date.slice(0, 10),
      paid: cents(amountPaidOnInstallment(s)),
      due: cents(Math.max(0, Number(s.amount_due ?? 0))),
      lastPaid: lastPaidBySchedule.get(s.id) ?? null,
    }));

  return {
    id: account.id,
    type: account.type,
    principal: Number(account.principal_amount ?? 0),
    frequency: account.payment_frequency,
    total: schedules.length,
    left: open.length,
    monthsLeft: Math.max(
      1,
      Math.ceil(open.length * monthsPerInstallment(account) - 1e-9),
    ),
    balance: cents(open.reduce((sum, s) => sum + remainingOnInstallment(s), 0)),
    nextDue: open[0].due_date.slice(0, 10),
    lastPaid,
    overdue: open.filter((s) => s.due_date.slice(0, 10) < today).length,
    partials,
  };
}

/**
 * Every borrower with a qualifying account, grouped by their category (A to
 * Z by the category's own order, uncategorized last), the closest to the end
 * first within a group.
 */
export function buildRenewals({
  borrowers,
  accounts,
  schedules,
  payments,
  today,
  months = RENEWAL_MONTHS,
}: {
  borrowers: RenewalBorrowerInput[];
  accounts: RenewalAccountInput[];
  schedules: RenewalSchedule[];
  payments: RenewalPayment[];
  today: string;
  months?: number;
}): RenewalGroup[] {
  const schedulesByAccount = new Map<string, RenewalSchedule[]>();
  const accountOfSchedule = new Map<string, string>();
  for (const s of schedules) {
    const list = schedulesByAccount.get(s.account_id) ?? [];
    list.push(s);
    schedulesByAccount.set(s.account_id, list);
    accountOfSchedule.set(s.id, s.account_id);
  }
  const paymentsByAccount = new Map<string, RenewalPayment[]>();
  for (const p of payments) {
    const accountId = accountOfSchedule.get(p.schedule_id);
    if (!accountId) continue;
    const list = paymentsByAccount.get(accountId) ?? [];
    list.push(p);
    paymentsByAccount.set(accountId, list);
  }

  const byBorrower = new Map<string, RenewalAccount[]>();
  for (const account of accounts) {
    const summary = renewalAccount(
      account,
      schedulesByAccount.get(account.id) ?? [],
      paymentsByAccount.get(account.id) ?? [],
      today,
      months,
    );
    if (!summary) continue;
    const list = byBorrower.get(account.borrower_id) ?? [];
    list.push(summary);
    byBorrower.set(account.borrower_id, list);
  }

  const groups = new Map<string, RenewalGroup & { order: number }>();
  for (const borrower of borrowers) {
    const found = byBorrower.get(borrower.id);
    if (!found) continue;
    found.sort((a, b) => a.monthsLeft - b.monthsLeft || a.left - b.left);
    const entry: RenewalBorrower = {
      id: borrower.id,
      name: borrower.name,
      accounts: found,
      monthsLeft: Math.min(...found.map((a) => a.monthsLeft)),
      balance: cents(found.reduce((sum, a) => sum + a.balance, 0)),
      overdue: found.reduce((sum, a) => sum + a.overdue, 0),
    };
    const name = borrower.category?.name ?? "uncategorized";
    const group = groups.get(name) ?? {
      name,
      color: borrower.category?.color ?? null,
      order: borrower.category ? borrower.category.order : Infinity,
      borrowers: [],
      balance: 0,
    };
    group.borrowers.push(entry);
    group.balance = cents(group.balance + entry.balance);
    groups.set(name, group);
  }

  const fewestLeft = (b: RenewalBorrower) =>
    Math.min(...b.accounts.map((a) => a.left));
  return [...groups.values()]
    .sort(
      (a, b) =>
        (a.order === b.order ? 0 : a.order - b.order) ||
        a.name.localeCompare(b.name),
    )
    .map(({ name, color, balance, borrowers }) => ({
      name,
      color,
      balance,
      borrowers: borrowers.sort(
        (a, b) =>
          a.monthsLeft - b.monthsLeft ||
          fewestLeft(a) - fewestLeft(b) ||
          a.name.localeCompare(b.name),
      ),
    }));
}
