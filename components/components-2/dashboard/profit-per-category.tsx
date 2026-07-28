import { formatPeso, type ProfitCategoryItem } from "@/lib/dashboard-data";

export function ProfitPerCategory({
  profitPerCategory,
}: {
  profitPerCategory: ProfitCategoryItem[];
}) {
  return (
    <section
      className="rounded-xl border border-border bg-card p-6 shadow-sm
        text-slate-600"
    >
      <h2 className="text-lg font-semibold text-card-foreground">
        profit per category
      </h2>
      <p className="text-sm text-muted-foreground">
        Ranked by profit this month
      </p>

      <ul className="mt-5 divide-y divide-border">
        {profitPerCategory.map((cat) => {
          const collectedPct =
            cat.profit > 0
              ? Math.round((cat.collectedProfit / cat.profit) * 100)
              : 0;
          return (
            <li key={cat.name} className="py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-block size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color ?? "#cbd5e1" }}
                  />
                  <p
                    className="truncate text-sm font-medium
                      text-card-foreground"
                  >
                    {cat.name}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-primary">
                  {formatPeso(cat.profit)}
                </p>
              </div>

              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full
                  bg-secondary"
              >
                <div
                  className="h-full rounded-full bg-[#82cead] dark:bg-[#ade5c5]"
                  style={{ width: `${collectedPct}%` }}
                  aria-hidden="true"
                />
              </div>

              <div
                className="mt-2 flex items-center justify-between text-xs
                  text-muted-foreground"
              >
                <span>
                  collected profit{" "}
                  <span className="font-medium text-foreground">
                    {formatPeso(cat.collectedProfit)}
                  </span>
                </span>
                <span>
                  remaining profit{" "}
                  <span className="font-medium text-accent-foreground">
                    {formatPeso(cat.remainingProfit)}
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
