import { relativeDayLabel, todayDateValue } from "@/lib/checklist/dates";

/**
 * How a payment's date reads next to "paid": "today" or "yesterday" when it
 * is, and otherwise the date, worded by `format`. `capital` starts the word
 * with a capital for places that don't lowercase their text.
 */
export function paidDay(
  iso: string,
  format: (iso: string) => string,
  options: { capital?: boolean; today?: string } = {},
): string {
  const rel = relativeDayLabel(
    iso.slice(0, 10),
    options.today ?? todayDateValue(),
  );
  if (rel === "today" || rel === "yesterday") {
    return options.capital ? rel[0].toUpperCase() + rel.slice(1) : rel;
  }
  return format(iso);
}
