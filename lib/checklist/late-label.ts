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
