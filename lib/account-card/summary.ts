import type { InstallmentDot } from "@/lib/payment-schedule/installment-dots";

/** Amounts to at most 2 decimals (profit is divided, so it can be 379.997). */
export function formatAmount(n: number): string {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Share of what's due that has been paid, 0 to 100. */
export function payoffPercent(totalPaid: number, totalDue: number): number {
  if (!Number.isFinite(totalPaid) || !Number.isFinite(totalDue)) return 0;
  if (totalDue <= 0) return 0;
  return Math.min(100, Math.max(0, (totalPaid / totalDue) * 100));
}

/** The label at the right of the payoff bar. */
export function barRightLabel(opts: {
  isManual: boolean;
  installments: InstallmentDot[];
  totalPaid: number;
}): string {
  if (opts.isManual) return `₱${formatAmount(opts.totalPaid)} collected`;
  if (opts.installments.length === 0) return "";
  const paid = opts.installments.filter((i) => i.state === "paid").length;
  return `${paid} of ${opts.installments.length} paid`;
}

/** "released 3w ago", for the card's band. */
export function releasedLabel(days: number): string {
  if (days <= 0) return "released today";
  if (days < 7) return `released ${days}d ago`;
  if (days < 30) return `released ${Math.round(days / 7)}w ago`;
  if (days < 365) return `released ${Math.round(days / 30)}mo ago`;
  return `released ${Math.round(days / 365)}y ago`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "Nov 3" from a `YYYY-MM-DD` date, without going through `Date` (no timezone shifts). */
export function shortDate(iso: string): string {
  const [, month, day] = iso.slice(0, 10).split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}
