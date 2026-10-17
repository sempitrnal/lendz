"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import {
  badgeClassFor,
  categoryTintStyle,
  chipClass,
} from "@/components/dashboard/checklist/dom";
import {
  borrowerCategoryColor,
  extractBorrowerId,
  formatShortDate,
  type CollectionRowModel,
} from "@/lib/checklist/labels";
import type { ScheduleDialogRow } from "@/lib/checklist/schedule-cache";

export function LinkedLabel({
  label,
  checked,
  borrowers,
}: {
  label: string;
  checked: boolean;
  borrowers: BorrowerSearchItem[];
}) {
  const names = useMemo(() => {
    return new Map(borrowers.map((b) => [`${b.first_name} ${b.last_name}`, b]));
  }, [borrowers]);
  const byId = useMemo(
    () => new Map(borrowers.map((b) => [b.id, b])),
    [borrowers],
  );

  const amountPattern = /(?:₱\s*)?\b(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\b/;

  const isAmountBlock = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    return trimmed.split("\n").every((line) => amountPattern.test(line.trim()));
  };

  const strike = (text: string, key: string, preserveWs = false) => {
    if (!text) return null;
    if (isAmountBlock(text)) {
      if (!preserveWs) {
        return (
          <span key={key} className="inline-block w-full pl-2 pt-2">
            <span className={checked ? "line-through" : ""}>{text.trim()}</span>
          </span>
        );
      }
      const leading = text.match(/^\s*/)?.[0] ?? "";
      const trailing = text.match(/\s*$/)?.[0] ?? "";
      return (
        <span key={key}>
          {leading}
          <span className="inline-block pl-2 pt-2">
            <span className={checked ? "line-through" : ""}>{text.trim()}</span>
          </span>
          {trailing}
        </span>
      );
    }
    return (
      <span key={key} className={checked ? "line-through" : ""}>
        {text}
      </span>
    );
  };

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  let prevBadge = false;
  while ((match = regex.exec(label)) !== null) {
    const isBadge = match[2].startsWith("#badge:");
    if (match.index > lastIndex) {
      parts.push(
        strike(
          label.slice(lastIndex, match.index),
          `md-${lastIndex}`,
          prevBadge || isBadge,
        ),
      );
    }
    const mentionedId = extractBorrowerId(match[2]);
    parts.push(
      <MentionPill
        key={match.index}
        name={match[1]}
        href={match[2]}
        checked={checked}
        color={
          mentionedId ? borrowerCategoryColor(byId.get(mentionedId)) : null
        }
      />,
    );
    prevBadge = isBadge;
    lastIndex = regex.lastIndex;
  }
  const tail = label.slice(lastIndex);
  if (tail) {
    let offset = 0;
    names.forEach((borrower, name) => {
      const idx = tail.indexOf(name, offset);
      if (idx !== -1) {
        if (idx > offset) {
          parts.push(
            strike(
              tail.slice(offset, idx),
              `tail-${offset}`,
              prevBadge && offset === 0,
            ),
          );
        }
        parts.push(
          <MentionPill
            key={`${borrower.id}-${idx}`}
            name={name}
            href={`/borrowers/${borrower.id}`}
            checked={checked}
            color={borrowerCategoryColor(borrower)}
          />,
        );
        offset = idx + name.length;
      }
    });
    if (offset < tail.length) {
      parts.push(
        strike(tail.slice(offset), "tail-end", prevBadge && offset === 0),
      );
    }
  }
  return <>{parts}</>;
}

export function MentionPill({
  name,
  href,
  checked,
  color = null,
  asLink = true,
}: {
  name: string;
  href: string;
  checked: boolean;
  color?: string | null;
  /** Plain span when false, e.g. inside a dialog where navigating would be surprising. */
  asLink?: boolean;
}) {
  const badgeClass = badgeClassFor(href);
  if (badgeClass) {
    return (
      <span
        className={`${badgeClass} ${checked ? "opacity-50 line-through" : ""}`}
      >
        {name}
      </span>
    );
  }
  const style = color ? categoryTintStyle(color) : undefined;
  const className = `inline-block lowercase rounded-md border px-2 pl-2.5 py-1
    text-sm font-semibold leading-none transition-opacity ${
      checked ? "opacity-60" : ""
    } ${asLink ? (checked ? "hover:opacity-80" : "hover:opacity-70") : ""} ${
      color
        ? "text-slate-700 dark:text-slate-200"
        : `border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-800
          dark:bg-sky-900/20 dark:text-sky-300`
    }`;
  if (!asLink) {
    return (
      <span style={style} className={className}>
        {name}
      </span>
    );
  }
  return (
    <Link
      href={href}
      prefetch
      onClick={(e) => e.stopPropagation()}
      style={style}
      className={className}
    >
      {name}
    </Link>
  );
}

type LineState = "paid" | "partial" | "unpaid";

function lineState(row: ScheduleDialogRow | undefined): LineState | null {
  if (!row) return null;
  if (row.status === "paid") return "paid";
  return Number(row.amount_paid ?? 0) > 0 ? "partial" : "unpaid";
}

const peso = (n: number) => `₱${n.toLocaleString()}`;

/**
 * A `/next`-linked item: borrower, one chip row per collection, amount on the
 * right. Each line carries its schedule's payment state from the saved
 * schedules, so a ticked row only strikes the lines actually paid; lines the
 * device has no status for follow the tick, as before.
 */
export function CollectionLabel({
  model,
  checked,
  borrowers,
  schedules,
}: {
  model: CollectionRowModel;
  checked: boolean;
  borrowers: BorrowerSearchItem[];
  schedules?: Map<string, ScheduleDialogRow>;
}) {
  const multi = model.lines.length > 1;
  const lines = model.lines.map((line) => {
    const row = schedules?.get(line.id);
    const state = lineState(row);
    const settled = state === "paid" || (checked && state === null);
    // Past due isn't the same as overdue: the app marks a schedule overdue a
    // day after its due date, and partly paid ones stay partial. Go by the
    // schedule's own status; only when it isn't known on this device does the
    // date decide.
    const overdue =
      !settled &&
      line.daysOverdue > 0 &&
      (row ? row.status === "overdue" : true);
    return { line, row, state, settled, overdue };
  });
  const allSettled = lines.every((l) => l.settled);
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        {model.borrower ? (
          <MentionPill
            name={model.borrower.name}
            href={`/borrowers/${model.borrower.id}`}
            checked={checked}
            color={borrowerCategoryColor(
              borrowers.find((b) => b.id === model.borrower?.id),
            )}
          />
        ) : null}
        <div className="space-y-1">
          {lines.map(({ line, row, state, settled, overdue }) => (
            <div
              key={line.id}
              className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${
                settled ? "opacity-60" : ""
              }`}
            >
              {multi && (
                <span
                  className={`font-medium text-muted-foreground tabular-nums ${
                    settled ? "line-through" : ""
                  }`}
                >
                  {peso(line.amount)}
                </span>
              )}
              <span className="text-muted-foreground tabular-nums">
                {formatShortDate(line.due_date).toLowerCase()}
              </span>
              {overdue && (
                <span className={chipClass("overdue")}>
                  {line.daysOverdue}d late
                </span>
              )}
              {/* Type as a quiet dot + word; the color alone tells loan from ca. */}
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${
                    line.type === "cash_advance"
                      ? "bg-amber-400"
                      : "bg-violet-400"
                  }`}
                />
                {line.type === "cash_advance" ? "ca" : "loan"}
              </span>
              {state === "paid" && (
                <span className={chipClass("paid")}>paid</span>
              )}
              {state === "partial" && row && (
                <span className={`${chipClass("partial")} tabular-nums`}>
                  {peso(Number(row.amount_paid ?? 0))} paid ·{" "}
                  {peso(Number(row.remaining_amount ?? 0))} left
                </span>
              )}
              {state === "unpaid" && checked && (
                <span className={chipClass("unpaid")}>not paid</span>
              )}
            </div>
          ))}
        </div>
        {model.note ? (
          <p className="text-xs whitespace-pre-wrap text-muted-foreground">
            <LinkedLabel
              label={model.note}
              checked={checked}
              borrowers={borrowers}
            />
          </p>
        ) : null}
      </div>
      <span
        className={`shrink-0 text-base font-semibold tabular-nums ${
          allSettled ? "text-muted-foreground line-through" : "text-foreground"
          }`}
      >
        {peso(model.total)}
      </span>
    </div>
  );
}
