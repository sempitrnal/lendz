/**
 * Bimonthly schedule generator.
 * Derives two anchor days from the first payment date and alternates between them.
 * Supports all 15-day-gap patterns (e.g. 4th/19th, 5th/20th, 7th/22nd, 8th/23rd,
 * 10th/25th, 15th/30th).
 */

/** Derive the two fixed monthly anchor days from a first-payment day. */
export function deriveBimonthlyAnchors(
  firstPaymentDay: number,
): [number, number] {
  if (firstPaymentDay <= 15) {
    return [firstPaymentDay, firstPaymentDay + 15];
  }
  return [firstPaymentDay - 15, firstPaymentDay];
}

/**
 * Per-installment amount: (principal + linear interest over term) / (2 payments per month × months).
 * `interestRatePercent` is the annual-style percent from the form (e.g. 5 for 5%).
 */
export function bimonthlyLegacyInstallmentAmount(
  principal: number,
  interestRatePercent: number,
  termMonths: number,
): number {
  const interest = interestRatePercent / 100;
  const total =
    (principal * interest * termMonths + principal) / (termMonths * 2);
  return Number(total.toFixed(2));
}

/**
 * Produces exactly `2 * termMonths` due dates.
 * First date is the startDate; subsequent dates alternate between the two
 * anchor days derived from the startDate's day-of-month.
 */
export function generateLegacyBimonthlyDueDates(
  startDate: Date,
  termMonths: number,
): Date[] {
  const dates: Date[] = [new Date(startDate)];
  const day = startDate.getDate();
  const [anchor1, anchor2] = deriveBimonthlyAnchors(day);

  let current = new Date(startDate);
  let nextIsAnchor2 = day === anchor1;

  for (let i = 0; i < termMonths * 2 - 1; i++) {
    if (nextIsAnchor2) {
      const dim = new Date(
        current.getFullYear(),
        current.getMonth() + 1,
        0,
      ).getDate();
      current = new Date(
        current.getFullYear(),
        current.getMonth(),
        Math.min(anchor2, dim),
      );
      nextIsAnchor2 = false;
    } else {
      const nextM = current.getMonth() + 1;
      const nextY = current.getFullYear() + (nextM > 11 ? 1 : 0);
      current = new Date(nextY, nextM % 12, anchor1);
      nextIsAnchor2 = true;
    }
    dates.push(new Date(current));
  }

  return dates;
}

/** Count how many bimonthly schedules would fall between release and first payment. */
export function countSkippedBimonthlySchedules(
  release: Date,
  firstPayment: Date,
): number {
  const day = firstPayment.getDate();
  const [anchor1, anchor2] = deriveBimonthlyAnchors(day);

  // Find first schedule date on or after release
  let current = new Date(release.getFullYear(), release.getMonth(), anchor1);
  if (release > current) {
    const dim = new Date(
      release.getFullYear(),
      release.getMonth() + 1,
      0,
    ).getDate();
    const a2 = Math.min(anchor2, dim);
    const anchor2Date = new Date(release.getFullYear(), release.getMonth(), a2);
    if (release <= anchor2Date) {
      current = anchor2Date;
    } else {
      const nm = release.getMonth() + 1;
      const ny = release.getFullYear() + (nm > 11 ? 1 : 0);
      current = new Date(ny, nm % 12, anchor1);
    }
  }

  if (firstPayment <= current) return 0;

  let count = 0;
  let isAnchor1 = current.getDate() === anchor1;

  while (current < firstPayment) {
    count++;
    if (isAnchor1) {
      const dim = new Date(
        current.getFullYear(),
        current.getMonth() + 1,
        0,
      ).getDate();
      current = new Date(
        current.getFullYear(),
        current.getMonth(),
        Math.min(anchor2, dim),
      );
      isAnchor1 = false;
    } else {
      const nm = current.getMonth() + 1;
      const ny = current.getFullYear() + (nm > 11 ? 1 : 0);
      current = new Date(ny, nm % 12, anchor1);
      isAnchor1 = true;
    }
  }

  return count;
}
