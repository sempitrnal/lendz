import { CalendarTile } from "@/components/calendar-tile";
import { ProgressRing } from "@/components/account/progress-ring";

const fmt = (n: number) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

/** The account page's summary: overall progress as a ring beside the principal, release date, what's left and what's collected. */
export function AccountSummaryCard({
  principal,
  releaseDate,
  amountLeft,
  amountPaid,
  progressPct,
}: {
  principal: number;
  /** `YYYY-MM-DD` or null. */
  releaseDate: string | null;
  amountLeft: number;
  amountPaid: number;
  progressPct: number;
}) {
  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-3
        shadow-[0_1px_3px_rgba(15,23,42,0.08),0_8px_20px_-10px_rgba(15,23,42,0.18)]
        dark:border-border dark:bg-card"
    >
      <div className="flex items-center gap-3.5">
        <ProgressRing percent={progressPct} size={56} stroke={6} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p
              className="truncate text-xl font-black tracking-tight
                text-[#556477] tabular-nums dark:text-foreground"
            >
              ₱{fmt(principal)}
            </p>
            <span
              className="text-[11px] font-medium text-slate-500
                dark:text-slate-400"
            >
              principal
            </span>
            <span className="flex-1" />
            {releaseDate && <CalendarTile date={releaseDate} size="sm" />}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span
              className="rounded-lg bg-yellow-100 px-2.5 py-1 text-xs
                text-slate-500 tabular-nums dark:bg-yellow-900/30
                dark:text-yellow-200/80"
            >
              left{" "}
              <b className="font-black text-[#556477] dark:text-yellow-100">
                ₱{fmt(amountLeft)}
              </b>
            </span>
            <span
              className="rounded-lg bg-emerald-100/80 px-2.5 py-1 text-xs
                text-emerald-800/80 tabular-nums dark:bg-emerald-900/30
                dark:text-emerald-200/80"
            >
              collected{" "}
              <b className="font-black text-[#048863] dark:text-emerald-100">
                ₱{fmt(amountPaid)}
              </b>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
