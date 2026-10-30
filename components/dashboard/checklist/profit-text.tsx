import { cn } from "@/lib/utils";

/**
 * "+₱500": a schedule's profit (its amount beyond its share of the
 * principal). Green once earned, muted grey while only `expected` (not paid
 * yet).
 * Nothing when unknown or zero (a cash advance with no interest), so rows
 * don't fill up with "+₱0".
 */
export function ProfitText({
  amount,
  expected = false,
  className,
}: {
  amount: number | null | undefined;
  /** Not paid yet: what it will earn, in muted grey. */
  expected?: boolean;
  className?: string;
}) {
  if (!amount || amount <= 0) return null;
  const text = amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return (
    <span
      title={`₱${text} profit${expected ? " once paid" : ""}`}
      aria-label={`₱${text} profit${expected ? " once paid" : ""}`}
      className={cn(
        "font-semibold tabular-nums",
        expected
          ? "text-muted-foreground/70"
          : "text-emerald-700 dark:text-emerald-400",
        className,
      )}
    >
      +₱{text}
    </span>
  );
}
