import { cn } from "@/lib/utils";

/**
 * "+₱500": what a schedule earns once paid (its amount beyond its share of the
 * principal). Nothing when unknown or zero (a cash advance with no interest),
 * so rows don't fill up with "+₱0".
 */
export function ProfitText({
  amount,
  className,
}: {
  amount: number | null | undefined;
  className?: string;
}) {
  if (!amount || amount <= 0) return null;
  const text = amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return (
    <span
      title={`₱${text} profit`}
      aria-label={`₱${text} profit`}
      className={cn(
        "font-semibold tabular-nums text-emerald-700 dark:text-emerald-400",
        className,
      )}
    >
      +₱{text}
    </span>
  );
}
