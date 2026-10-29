type AccountLike = { id: string; status: string };

type MetricsLike = {
  amountLeftToPay: number;
  totalPaid: number;
  totalDue: number;
  overdueCount: number;
  nextCollectionDate: string | null;
  nextCollectionAmount: number;
};

export type BandFigures = {
  remaining: number;
  collected: number;
  /** Everything the borrower owes across their accounts, interest included. */
  totalDue: number;
  /** 0 to 100: the share of `totalDue` already collected. */
  pct: number;
  overdueCount: number;
  /** The soonest collection coming up across active accounts. */
  next: { date: string; amount: number } | null;
};

/**
 * What the borrower page's green band shows: the balance, how much of it is
 * collected, the soonest collection and how many are overdue. Pending
 * accounts haven't been released, so they count towards the balance but never
 * towards "next" or "overdue".
 */
export function bandFigures(
  accounts: readonly AccountLike[],
  metricsById: Readonly<Record<string, MetricsLike | undefined>>,
): BandFigures {
  let remaining = 0;
  let collected = 0;
  let totalDue = 0;
  let overdueCount = 0;
  let next: BandFigures["next"] = null;

  for (const account of accounts) {
    const m = metricsById[account.id];
    if (!m) continue;
    remaining += m.amountLeftToPay;
    collected += m.totalPaid;
    totalDue += m.totalDue;
    if (account.status === "pending") continue;
    overdueCount += m.overdueCount;
    const date = m.nextCollectionDate?.slice(0, 10);
    if (date && m.nextCollectionAmount > 0 && (!next || date < next.date)) {
      next = { date, amount: m.nextCollectionAmount };
    }
  }

  const pct =
    totalDue > 0 ? Math.min(100, Math.max(0, (collected / totalDue) * 100)) : 0;
  return { remaining, collected, totalDue, pct, overdueCount, next };
}
