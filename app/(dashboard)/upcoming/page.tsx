import Link from "next/link";
import { connection } from "next/server";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
} from "lucide-react";
import {
  getUpcomingDueDatesData,
  type UpcomingEntry,
} from "@/lib/cache/upcoming-due-dates";
import { formatDate } from "@/lib/utils";

function formatMoney(n: number) {
  return `₱${n.toLocaleString()}`;
}

function StatusBadge({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border-2
          border-rose-700 bg-rose-100 px-2 py-0.5 text-[10px] font-black
          tracking-wide text-rose-800 uppercase dark:border-rose-800
          dark:bg-rose-950/60 dark:text-rose-300"
      >
        <AlertTriangle className="size-2.5" />
        overdue {Math.abs(days)}d
      </span>
    );
  }
  if (days === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border-2
          border-orange-600 bg-orange-100 px-2 py-0.5 text-[10px] font-black
          tracking-wide text-orange-800 uppercase dark:border-orange-700
          dark:bg-orange-950/60 dark:text-orange-300"
      >
        <Clock className="size-2.5" />
        due today
      </span>
    );
  }
  if (days <= 3) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border-2
          border-amber-600 bg-amber-100 px-2 py-0.5 text-[10px] font-black
          tracking-wide text-amber-800 uppercase dark:border-amber-700
          dark:bg-amber-950/60 dark:text-amber-300"
      >
        <Clock className="size-2.5" />
        in {days}d
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border-2
          border-yellow-600 bg-yellow-100 px-2 py-0.5 text-[10px] font-black
          tracking-wide text-yellow-800 uppercase dark:border-yellow-700
          dark:bg-yellow-950/60 dark:text-yellow-300"
      >
        <Calendar className="size-2.5" />
        in {days}d
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border-2
        border-emerald-600 bg-emerald-100 px-2 py-0.5 text-[10px] font-black
        tracking-wide text-emerald-800 uppercase dark:border-emerald-700
        dark:bg-emerald-950/60 dark:text-emerald-300"
    >
      <Calendar className="size-2.5" />
      in {days}d
    </span>
  );
}

function UpcomingCard({ entry }: { entry: UpcomingEntry }) {
  const isOverdue = entry.daysUntilDue < 0;
  const isCritical = entry.daysUntilDue >= 0 && entry.daysUntilDue <= 3;
  const isSoon = entry.daysUntilDue > 3 && entry.daysUntilDue <= 7;

  const borderColor = isOverdue
    ? "border-rose-600 dark:border-rose-800"
    : isCritical
      ? "border-amber-600 dark:border-amber-700"
      : isSoon
        ? "border-yellow-500 dark:border-yellow-700"
        : "border-slate-900 dark:border-slate-700";

  const shadowColor = isOverdue
    ? "shadow-[2px_2px_0px_0px_#be123c]"
    : isCritical
      ? "shadow-[2px_2px_0px_0px_#d97706]"
      : isSoon
        ? "shadow-[2px_2px_0px_0px_#ca8a04]"
        : "shadow-[2px_2px_0px_0px_#0f172a]";

  const bgColor = isOverdue
    ? "bg-rose-50 dark:bg-rose-950/20"
    : isCritical
      ? "bg-amber-50 dark:bg-amber-950/20"
      : isSoon
        ? "bg-yellow-50 dark:bg-yellow-950/20"
        : "bg-background dark:bg-card";

  return (
    <div
      className={`min-w-0 rounded-xl border-2 p-4 ${borderColor} ${shadowColor}
        ${bgColor}`}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <StatusBadge days={entry.daysUntilDue} />
        <Link
          href={`/accounts/${entry.accountId}`}
          className="dark:text-muted-foreground flex shrink-0 items-center gap-1
            text-[10px] font-bold text-slate-500 transition hover:text-slate-600
            dark:hover:text-slate-200"
          aria-label="View account"
        >
          account
          <ExternalLink className="size-3" />
        </Link>
      </div>

      {entry.borrowerId ? (
        <Link
          href={`/borrowers/${entry.borrowerId}`}
          className="group block min-w-0"
        >
          <p
            className="dark:text-foreground truncate text-sm font-black
              tracking-tight text-slate-600 lowercase transition
              group-hover:underline"
          >
            {entry.borrowerName}
          </p>
        </Link>
      ) : (
        <p
          className="dark:text-foreground truncate text-sm font-black
            tracking-tight text-slate-600 lowercase"
        >
          {entry.borrowerName}
        </p>
      )}

      <div className="mt-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span
            className="dark:text-muted-foreground font-semibold text-slate-600"
          >
            Due date
          </span>
          <span
            className="dark:text-foreground font-black tabular-nums
              text-slate-600"
          >
            {formatDate(entry.dueDate)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span
            className="dark:text-muted-foreground font-semibold text-slate-600"
          >
            Payment due
          </span>
          <span
            className="dark:text-foreground font-black tabular-nums
              text-slate-600"
          >
            {formatMoney(entry.amountDue)}
          </span>
        </div>
        {entry.remaining < entry.amountDue && entry.amountDue > 0 ? (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span
              className="dark:text-muted-foreground font-semibold
                text-slate-600"
            >
              Remaining
            </span>
            <span
              className="font-black tabular-nums text-rose-700
                dark:text-rose-400"
            >
              {formatMoney(entry.remaining)}
            </span>
          </div>
        ) : null}
      </div>

      {entry.scheduleStatus === "partial" ? (
        <div className="mt-2.5">
          <span
            className="dark:border-border dark:bg-muted
              dark:text-muted-foreground rounded border border-slate-300
              bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase
              text-slate-500"
          >
            partial
          </span>
        </div>
      ) : null}
    </div>
  );
}

function SectionEmptyState({ label }: { label: string }) {
  return (
    <div
      className="dark:border-muted-foreground/30 dark:bg-muted
        dark:text-muted-foreground rounded-xl border-2 border-dashed
        border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm font-semibold
        text-slate-500"
    >
      No borrowers {label}.
    </div>
  );
}

type SectionProps = {
  title: string;
  count: number;
  entries: UpcomingEntry[];
  emptyLabel: string;
  accentClass: string;
  iconClass: string;
};

function UpcomingSection({
  title,
  count,
  entries,
  emptyLabel,
  accentClass,
  iconClass,
}: SectionProps) {
  return (
    <section>
      <div className={"mb-3 flex items-center gap-2.5"}>
        <span
          className={`dark:border-border inline-flex items-center justify-center
            rounded-md border border-slate-900 p-1.5 ${iconClass}`}
        >
          <Calendar className="size-4" />
        </span>
        <h2
          className="dark:text-foreground text-base font-black text-slate-600
            lowercase"
        >
          {title}
        </h2>
        {count > 0 ? (
          <span
            className={`rounded-full border-2 border-slate-900 px-2.5 py-0.5
              text-xs font-black tabular-nums ${accentClass}`}
          >
            {count}
          </span>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <SectionEmptyState label={emptyLabel} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <UpcomingCard key={entry.scheduleId} entry={entry} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function UpcomingDueDatesPage() {
  await connection();

  const TZ = "Asia/Manila";
  const now = new Date();
  const todayIso = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const formattedToday = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  });

  const { overdue, withinSevenDays, withinFourteenDays } =
    await getUpcomingDueDatesData(todayIso);

  const totalCount =
    overdue.length + withinSevenDays.length + withinFourteenDays.length;

  return (
    <main className="mx-auto w-full max-w-5xl px-1 py-2 sm:px-0">
      <div className="mb-4">
        <Link
          href="/dashboard"
          className="dark:text-muted-foreground dark:hover:text-foreground
            inline-flex items-center gap-1.5 text-sm font-bold text-slate-600
            transition hover:text-slate-600"
        >
          <ArrowLeft className="size-4" />
          back to dashboard
        </Link>
      </div>

      <section
        className="dark:border-border dark:via-card mb-6 rounded-xl border-2
          border-slate-900 bg-linear-to-r from-violet-50 via-stone-50
          to-indigo-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] sm:p-6
          dark:from-violet-950/30 dark:to-indigo-950/20"
      >
        <p
          className="dark:text-muted-foreground text-xs font-semibold
            tracking-wider text-slate-600 uppercase"
        >
          {formattedToday}
        </p>
        <h1
          className="dark:text-foreground mt-1 text-2xl font-black
            text-slate-600 lowercase sm:text-3xl"
        >
          upcoming due dates
        </h1>
        <p className="dark:text-muted-foreground mt-2 text-sm text-slate-600">
          {totalCount === 0
            ? "No active accounts with balances due within the next 14 days."
            : `${totalCount} active account${totalCount === 1 ? "" : "s"} with balances due or overdue.`}
        </p>
      </section>

      <div className="space-y-8">
        {overdue.length > 0 ? (
          <UpcomingSection
            title="overdue"
            count={overdue.length}
            entries={overdue}
            emptyLabel="with overdue balances"
            accentClass="bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
            iconClass="bg-rose-100 text-slate-600 dark:bg-rose-900/40 dark:text-rose-300"
          />
        ) : null}

        <UpcomingSection
          title="due in the next 7 days"
          count={withinSevenDays.length}
          entries={withinSevenDays}
          emptyLabel="due in the next 7 days"
          accentClass="bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
          iconClass="bg-amber-100 text-slate-600 dark:bg-amber-900/40 dark:text-amber-300"
        />

        <UpcomingSection
          title="due in 8–14 days"
          count={withinFourteenDays.length}
          entries={withinFourteenDays}
          emptyLabel="due in 8–14 days"
          accentClass="bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
          iconClass="bg-emerald-100 text-slate-600 dark:bg-emerald-900/40 dark:text-emerald-300"
        />
      </div>

      {totalCount === 0 ? (
        <section className="mt-8">
          <div
            className="dark:border-border dark:bg-card flex flex-col
              items-center justify-center rounded-xl border-2 border-dashed
              border-slate-300 bg-slate-50 py-16 text-center"
          >
            <Calendar
              className="dark:text-muted-foreground mb-3 size-10 text-slate-400"
            />
            <p
              className="dark:text-foreground text-sm font-black text-slate-600
                lowercase"
            >
              all clear
            </p>
            <p
              className="dark:text-muted-foreground mt-1 text-sm text-slate-500"
            >
              No accounts due in the next 14 days.
            </p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
