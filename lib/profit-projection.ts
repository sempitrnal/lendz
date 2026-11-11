/**
 * Projected profit for a month still being collected: what it is due to earn,
 * scaled by how much of the expected profit earlier months actually brought
 * in.
 */

export type MonthProfitTotals = {
  /** Interest collected on the month's installments. */
  profit: number;
  /** Interest those installments were due to earn. */
  expectedProfit: number;
};

/**
 * The share of expected profit that was collected across `history` (finished
 * months), pooled so a big month counts for more than a small one. Months
 * that expected nothing are left out; null when none are left.
 */
export function profitCollectionRate(
  history: MonthProfitTotals[],
): { rate: number; months: number } | null {
  const months = history.filter((m) => m.expectedProfit > 0);
  if (months.length === 0) return null;
  const expected = months.reduce((sum, m) => sum + m.expectedProfit, 0);
  const collected = months.reduce((sum, m) => sum + m.profit, 0);
  return { rate: Math.min(1, collected / expected), months: months.length };
}

/** Never below what the month has already collected. */
export function projectProfit(month: MonthProfitTotals, rate: number): number {
  return Math.max(month.profit, month.expectedProfit * rate);
}
