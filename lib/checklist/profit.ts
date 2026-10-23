/**
 * Profit on an installment, as the dashboard counts it: what was paid beyond
 * the installment's share of the principal (principal split evenly over the
 * installments; weekly is 4 a month, bimonthly 2).
 */

export type AccountTerms = {
  principal_amount: number | null;
  term_months: number | null;
  payment_frequency: string | null;
};

const cents = (n: number) => Math.round(n * 100) / 100;

/** One installment's share of the principal; 0 when the account is unknown. */
export function principalShare(account: AccountTerms | null): number {
  if (!account) return 0;
  const term = Number(account.term_months ?? 1);
  const frequency = account.payment_frequency ?? "monthly";
  const installments =
    frequency === "weekly"
      ? term * 4
      : frequency === "bimonthly"
        ? term * 2
        : term;
  return Number(account.principal_amount ?? 0) / Math.max(1, installments);
}

/** Profit collected on one installment: paid beyond its principal share. */
export function profitOnInstallment(amountPaid: number, share: number): number {
  return cents(Math.max(0, amountPaid - share));
}
