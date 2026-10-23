import { cn } from "@/lib/utils";

/**
 * "₱450 profit": what a schedule earns once paid (its amount beyond its share
 * of the principal). Nothing when unknown or zero (a cash advance with no
 * interest), so rows don't fill up with "₱0 profit".
 */
export function ProfitText({
  amount,
  className,
}: {
  amount: number | null | undefined;
  className?: string;
}) {
  if (!amount || amount <= 0) return null;
  return (
    <span
      className={cn(
        "font-semibold tabular-nums text-emerald-700 dark:text-emerald-400",
        className,
      )}
    >
      ₱{amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} profit
    </span>
  );
}
