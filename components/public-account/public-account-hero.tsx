import type { ReactNode } from "react";
import { ProgressRing } from "@/components/account/progress-ring";
import ThemeToggle from "@/components/theme-toggle";
import { formatDate, formatMoney } from "@/lib/utils";
import type { PublicAccountViewModel } from "@/lib/public-account";

type Props = {
  view: PublicAccountViewModel;
};

export default function PublicAccountHero({ view }: Props) {
  const typeLabel = view.accountType.replace("_", " ");
  const typeClass =
    view.accountType === "cash_advance"
      ? "border-amber-600/60 bg-amber-100 text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/20 dark:text-amber-300"
      : "border-violet-600/60 bg-violet-100 text-violet-900 dark:border-violet-400/40 dark:bg-violet-400/20 dark:text-violet-300";

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border
        bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle size="icon-sm" />
      </div>

      <p
        className="text-[10px] font-black uppercase tracking-[0.2em]
          text-muted-foreground"
      >
        Loan Details
      </p>
      <h1
        className="mt-1 text-3xl font-black tracking-tight uppercase
          text-foreground sm:text-4xl"
      >
        {view.borrowerName}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1
            text-[10px] font-black uppercase tracking-widest ${typeClass}`}
        >
          {typeLabel}
        </span>
        {view.releaseDate && (
          <span className="text-xs font-semibold text-muted-foreground">
            Released {formatDate(view.releaseDate)}
          </span>
        )}
      </div>

      <div className="mt-8 grid items-center gap-8 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          <ProgressRing percent={view.progressPct} size={120} stroke={10} />
          <span
            className="text-xs font-bold uppercase tracking-widest
              text-muted-foreground"
          >
            {view.progressPct}% paid
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Principal" value={formatMoney(view.principal)} />
          <Stat label="Interest" value={`${view.interestRate}%`} />
          <Stat
            label="Term"
            value={`${view.termMonths ?? 0} ${
              view.termMonths === 1 ? "month" : "months"
            }`}
          />
          <Stat
            label="Frequency"
            value={view.paymentFrequency?.replace("_", " ") ?? "—"}
            valueClassName="capitalize"
          />
          <Stat
            label="Paid"
            value={formatMoney(view.paidTotal)}
            valueClassName="text-emerald-600 dark:text-emerald-400"
          />
          <Stat
            label="Remaining"
            value={formatMoney(view.totalRemaining)}
            valueClassName="text-rose-600 dark:text-rose-400"
          />
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground">Payment progress</span>
          <span
            className="font-bold tabular-nums text-emerald-600
              dark:text-emerald-400"
          >
            {view.paidCount} paid
          </span>
        </div>
        <div
          className="mt-2 h-3 overflow-hidden rounded-full border border-border
            bg-muted"
        >
          <div
            className="h-full rounded-full bg-emerald-400 transition-all
              dark:bg-emerald-500"
            style={{ width: `${view.progressPct}%` }}
          />
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div
      className="rounded-2xl border border-border bg-secondary/40 p-4
        dark:bg-secondary/20"
    >
      <p
        className="text-[10px] font-bold uppercase tracking-wider
          text-muted-foreground"
      >
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-black tabular-nums text-foreground ${
          valueClassName ?? ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
