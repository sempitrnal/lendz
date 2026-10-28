import Link from "next/link";
import { AlertTriangle, ChevronRight, PartyPopper } from "lucide-react";
import {
  formatPeso,
  type OverdueBorrower,
  type OverdueBucket,
} from "@/lib/dashboard-data";
import { SectionHeading } from "./section-heading";
import { DashCard } from "./dash-card";

// Older debt is riskier, so the bars darken from amber to deep rose.
const BUCKET_BAR = [
  "bg-amber-400 dark:bg-amber-300",
  "bg-orange-500 dark:bg-orange-400",
  "bg-rose-500 dark:bg-rose-400",
  "bg-rose-700 dark:bg-rose-500",
  "bg-rose-900 dark:bg-rose-700",
];

export function OverdueAging({
  total,
  buckets,
  topBorrowers,
}: {
  total: number;
  buckets: OverdueBucket[];
  topBorrowers: OverdueBorrower[];
}) {
  const max = Math.max(1, ...buckets.map((b) => b.amount));

  return (
    <DashCard className="rounded-xl border border-border bg-card p-6">
      <SectionHeading icon={AlertTriangle} tint="rose" title="overdue aging" />

      {total <= 0 ? (
        <div
          className="mt-4 flex items-center gap-3 rounded-lg bg-secondary/60 p-4
            text-sm text-muted-foreground"
        >
          <PartyPopper className="size-5 text-primary" aria-hidden="true" />
          Nothing past due. Nice.
        </div>
      ) : (
        <>
          <p
            className="mt-4 text-3xl font-semibold tracking-tight text-rose-600
              tabular-nums dark:text-rose-400"
          >
            {formatPeso(total)}
          </p>
          <p className="text-sm text-muted-foreground">
            past due, by days late
          </p>

          <ul className="mt-5 space-y-3">
            {buckets.map((b, i) => (
              <li key={b.label}>
                <div
                  className="flex items-baseline justify-between gap-2 text-sm"
                >
                  <span className="text-muted-foreground">{b.label}</span>
                  <span
                    className="font-medium text-card-foreground tabular-nums"
                  >
                    {formatPeso(b.amount)}
                    <span
                      className="ml-1.5 text-xs font-normal
                        text-muted-foreground"
                    >
                      · {b.count}
                    </span>
                  </span>
                </div>
                <div
                  className="mt-1.5 h-2 w-full overflow-hidden rounded-full
                    bg-secondary"
                >
                  <div
                    className={`dash-grow h-full rounded-full ${BUCKET_BAR[i]}`}
                    style={{ width: `${(b.amount / max) * 100}%` }}
                    aria-hidden="true"
                  />
                </div>
              </li>
            ))}
          </ul>

          {topBorrowers.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-card-foreground">
                biggest overdue
              </h3>
              <ul className="mt-2 -mx-2">
                {topBorrowers.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/borrowers/${b.id}`}
                      className="group flex items-center justify-between gap-3
                        rounded-lg px-2 py-2 transition-colors
                        hover:bg-secondary"
                    >
                      <span className="min-w-0">
                        <span
                          className="block truncate text-sm font-medium
                            text-card-foreground"
                        >
                          {b.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          oldest {b.oldestDaysLate} day
                          {b.oldestDaysLate === 1 ? "" : "s"} late
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <span
                          className="text-sm font-semibold text-rose-600
                            tabular-nums dark:text-rose-400"
                        >
                          {formatPeso(b.amount)}
                        </span>
                        <ChevronRight
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </DashCard>
  );
}
