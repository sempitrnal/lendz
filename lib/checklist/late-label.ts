/**
 * How late a payment is, short for the overdue pill: days under a month
 * ("15d"), months under a year ("8mo"), then years ("1y"), rounded down.
 * `spoken` is the same for screen readers ("8 months late").
 */
export function lateLabel(days: number): { short: string; spoken: string } {
  const unit = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? "" : "s"} late`;
  if (days >= 365) {
    const years = Math.floor(days / 365);
    return { short: `${years}y`, spoken: unit(years, "year") };
  }
  if (days >= 30) {
    const months = Math.floor(days / 30);
    return { short: `${months}mo`, spoken: unit(months, "month") };
  }
  return { short: `${days}d`, spoken: unit(days, "day") };
}

/**
 * How a payment compares with its due date, for the payment history:
 * "1d early", "2d late", or "on time". Long gaps use the same short units as
 * the overdue pill ("2mo late"). Both dates are `YYYY-MM-DD`.
 */
export function paymentTiming(
  dueDate: string,
  paidDate: string,
): { text: string; tone: "early" | "late" | "on-time" } {
  const utcDay = (date: string) => {
    const [y, m, d] = date.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const days = Math.round((utcDay(paidDate) - utcDay(dueDate)) / 86_400_000);
  if (days === 0) return { text: "on time", tone: "on-time" };
  const short = lateLabel(Math.abs(days)).short;
  return days > 0
    ? { text: `${short} late`, tone: "late" }
    : { text: `${short} early`, tone: "early" };
}
