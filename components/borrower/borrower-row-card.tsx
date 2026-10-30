"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveRecentBorrower } from "@/lib/recent-borrowers";
import type { buildBorrowerScheduleCardProps } from "./borrower-schedule-card";

type CardProps = ReturnType<typeof buildBorrowerScheduleCardProps>;

type Visit = {
  id: string;
  first_name: string;
  last_name: string;
  categoryColor: string | null;
};

/** Which of a month's statuses needs looking at first. */
const URGENCY = ["overdue", "partial", "pending", "paid"];

const PILL: Record<string, string> = {
  overdue: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  partial: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  pending: "bg-amber-400/25 text-amber-700 dark:text-amber-300",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  manual: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;

const shortDate = (d: string, tz?: string) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: tz,
  });

/** "jamielyn ponteras" → "JP". */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")
  ).toUpperCase();
}

/**
 * What the card's right side says: one amount and one status, for this
 * month, or the next payment when nothing falls in it.
 */
function summary(p: CardProps): {
  amount: string | null;
  status: string | null;
  note: string;
} {
  if (!p.hasAccounts)
    return { amount: null, status: null, note: "no account yet" };
  const manual =
    p.manualAccountsCount > 0 && p.accountsCount === p.manualAccountsCount;
  if (manual) {
    return {
      amount: peso(p.manualTotalRemaining),
      status: "manual",
      note: "left on a manual account",
    };
  }
  if (p.schedules.length > 0) {
    const status =
      URGENCY.find((s) => p.schedules.some((x) => x.status === s)) ??
      p.schedules[0].status;
    if (status === "paid") {
      return {
        amount: peso(p.totalPaid),
        status,
        note: "paid this month",
      };
    }
    const due = p.schedules.find((s) => s.status === status) ?? p.schedules[0];
    return {
      amount: peso(p.totalRemaining),
      status,
      note: `due ${shortDate(due.dueDate, p.tz)}`,
    };
  }
  if (p.nextSchedule) {
    return {
      amount: peso(p.nextSchedule.amount),
      status: p.nextSchedule.status,
      note: `next ${shortDate(p.nextSchedule.dueDate, p.tz)}`,
    };
  }
  return { amount: null, status: null, note: "nothing scheduled" };
}

/** A borrower on one line: who, their category, and what is due. */
export default function BorrowerRowCard({
  displayCategory = true,
  onVisit,
  ...p
}: CardProps & {
  displayCategory?: boolean;
  onVisit?: (borrower: Visit) => void;
}) {
  const router = useRouter();
  const color = p.categoryColor ?? "#94a3b8";
  const { amount, status, note } = summary(p);
  const href = `/borrowers/${p.borrowerId}`;

  const recordVisit = () => {
    const [first_name = "", ...rest] = p.name.trim().split(/\s+/);
    const visit = {
      id: p.borrowerId,
      first_name,
      last_name: rest.join(" "),
      categoryColor: p.categoryColor,
    };
    if (onVisit) onVisit(visit);
    else saveRecentBorrower(visit);
  };

  return (
    <article
      style={{ "--cat": color } as React.CSSProperties}
      onPointerEnter={() => router.prefetch(href)}
      className="relative flex items-center gap-3 rounded-3xl border
        border-border bg-card p-3 shadow-sm transition-transform
        has-[a:active]:scale-[0.98]"
    >
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-2xl
          bg-[color-mix(in_oklab,var(--cat)_22%,var(--card))] text-sm font-black
          text-[color-mix(in_oklab,var(--cat)_45%,var(--foreground))] ring-1
          ring-black/5 ring-inset dark:ring-white/10"
      >
        {initials(p.name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {/* The name's link covers the whole card. */}
          <Link
            href={href}
            prefetch
            onClick={recordVisit}
            className="truncate text-[15px] font-black tracking-tight lowercase
              after:absolute after:inset-0 after:rounded-3xl after:content-['']"
          >
            {p.name}
          </Link>
          {p.notesCount > 0 && (
            <span
              className="relative inline-flex shrink-0 items-center gap-0.5
                text-[11px] font-bold text-amber-600 dark:text-amber-300"
              aria-label={`${p.notesCount} note${p.notesCount === 1 ? "" : "s"}`}
            >
              <StickyNote className="size-3" aria-hidden="true" />
              {p.notesCount}
            </span>
          )}
        </div>
        <p
          className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px]
            font-semibold text-muted-foreground"
        >
          {displayCategory && (
            <>
              <span
                className="size-2 shrink-0 rounded-full bg-(--cat)"
                aria-hidden="true"
              />
              <span className="truncate lowercase">{p.category}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span className="shrink-0">{note}</span>
        </p>
      </div>

      {(amount || status) && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          {amount && (
            <span className="text-[15px] font-black tabular-nums">
              {amount}
            </span>
          )}
          {status && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-black lowercase",
                PILL[status] ?? "bg-muted text-muted-foreground",
              )}
            >
              {status}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
