/**
 * Profit on an installment, as the dashboard counts it: what was paid beyond
 * the installment's share of the principal (principal split evenly over the
 * installments; weekly is 4 a month, bimonthly 2).
 */

export type AccountTerms = {
  principal_amount: number | null;
  term_months: number | null;
  payment_frequency: string | null;
  /** Installments of a custom or manual schedule. */
  term_installments?: number | null;
  schedule_mode?: string | null;
};

const cents = (n: number) => Math.round(n * 100) / 100;

/** One installment's share of the principal; 0 when the account is unknown. */
export function principalShare(account: AccountTerms | null): number {
  if (!account) return 0;
  const termMonths = Number(account.term_months) || 0;
  const termInstallments = Number(account.term_installments) || 0;
  const frequency = account.payment_frequency ?? "monthly";
  const installments =
    account.schedule_mode === "manual"
      ? termInstallments || termMonths || 1
      : frequency === "custom"
        ? termInstallments || 1
        : frequency === "weekly"
          ? termMonths * 4 || 1
          : frequency === "bimonthly"
            ? termMonths * 2 || 1
            : termMonths || 1;
  return Number(account.principal_amount ?? 0) / Math.max(1, installments);
}

/** Profit collected on one installment: paid beyond its principal share. */
export function profitOnInstallment(amountPaid: number, share: number): number {
  return cents(Math.max(0, amountPaid - share));
}

/** What an installment earns once paid: its amount beyond the principal share. */
export function installmentProfit(amountDue: number, share: number): number {
  return cents(Math.max(0, amountDue - share));
}

/**
 * The profit a set of payments adds: for each schedule, the profit collected
 * after the payment minus before it (nothing until its principal share is
 * covered). Schedules with no saved share, or not found, add nothing.
 */
export function profitGained(
  payments: { scheduleId: string; amount: number }[],
  rows: Map<string, { amount_paid: number; principal_share?: number }>,
): number {
  let total = 0;
  for (const { scheduleId, amount } of payments) {
    const row = rows.get(scheduleId);
    if (!row || row.principal_share === undefined) continue;
    const before = Number(row.amount_paid ?? 0);
    total +=
      profitOnInstallment(before + amount, row.principal_share) -
      profitOnInstallment(before, row.principal_share);
  }
  return cents(total);
}

/** The sum of several schedules' profit; null when none of them is known. */
export function totalProfit(
  amounts: (number | null | undefined)[],
): number | null {
  const known = amounts.filter((a): a is number => typeof a === "number");
  return known.length === 0 ? null : cents(known.reduce((a, b) => a + b, 0));
}

/**
 * The profit collected on a month's schedules: each one's paid amount beyond
 * its principal share, added up. A schedule whose account didn't come back is
 * skipped, since its share is unknown. (The account arrives as one object or a
 * one-item list, depending on the query.)
 */
export function monthProfit(
  rows: {
    amount_paid: number | null;
    accounts: AccountTerms | AccountTerms[] | null;
  }[],
): number {
  let total = 0;
  for (const row of rows) {
    const account = Array.isArray(row.accounts)
      ? row.accounts[0]
      : row.accounts;
    if (!account) continue;
    total += profitOnInstallment(
      Number(row.amount_paid ?? 0),
      principalShare(account),
    );
  }
  return cents(total);
}
