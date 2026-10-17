import { Tags } from "lucide-react";
import { formatPeso, type ProfitCategoryItem } from "@/lib/dashboard-data";
import { SectionHeading } from "./section-heading";

export function ProfitPerCategory({
  profitPerCategory,
}: {
  profitPerCategory: ProfitCategoryItem[];
}) {
  return (
    <section
      className="rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <SectionHeading
        icon={Tags}
        tint="emerald"
        title="profit per category"
        subtitle="Ranked by profit this month"
      />

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
                    className="truncate text-sm font-bold text-slate-700
                      dark:text-foreground"
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
                  className="dash-grow h-full rounded-full opacity-85"
                  style={{
                    width: `${collectedPct}%`,
                    backgroundColor: cat.color ?? "var(--chart-2)",
                  }}
                  aria-hidden="true"
                />
              </div>

              <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                <span>
                  collected{" "}
                  <span className="font-medium text-foreground">
                    {formatPeso(cat.collectedProfit)}
                  </span>
                </span>
                <span>
                  remaining{" "}
                  <span className="font-medium text-foreground">
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
