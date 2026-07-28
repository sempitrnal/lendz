import { formatPeso, type ProfitCategoryItem } from "@/lib/dashboard-data";

export function ProfitPerCategory({
  profitPerCategory,
}: {
  profitPerCategory: ProfitCategoryItem[];
}) {
  const maxProfit = Math.max(...profitPerCategory.map((c) => c.profit), 1);

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-card-foreground">
        profit per category
      </h2>
      <p className="text-sm text-muted-foreground">
        Ranked by profit this month
      </p>

      <ul className="mt-5 divide-y divide-border">
        {profitPerCategory.map((cat) => {
          const total = cat.collected + cat.remaining;
          const collectedPct =
            total > 0 ? Math.round((cat.collected / total) * 100) : 0;
          return (
            <li key={cat.name} className="py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium text-card-foreground">
                  {cat.name}
                </p>
                <p className="shrink-0 text-sm font-semibold text-primary">
                  {formatPeso(cat.profit)}
                </p>
              </div>

              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full
                  bg-secondary"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(cat.profit / maxProfit) * 100}%` }}
                  aria-hidden="true"
                />
              </div>

              <div
                className="mt-2 flex items-center justify-between text-xs
                  text-muted-foreground"
              >
                <span>
                  collected{" "}
                  <span className="font-medium text-foreground">
                    {formatPeso(cat.collected)}
                  </span>
                </span>
                <span>
                  remaining{" "}
                  <span className="font-medium text-accent-foreground">
                    {formatPeso(cat.remaining)}
                  </span>{" "}
                  · {collectedPct}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
