"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { m, useAnimationControls, type TapInfo } from "motion/react";
import { Check, ChevronDown, CloudUpload, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/checklist/labels";
import { lateLabel } from "@/lib/checklist/late-label";
import { plainLabelText, rowDisplayName } from "@/lib/checklist/row-name";
import {
  lineProfit,
  type RowLine,
  type RowView,
} from "@/lib/checklist/row-state";
import { PaymentHistory } from "@/components/dashboard/checklist-v2/payment-history";
import {
  useSchedulePayments,
  type SchedulePayment,
} from "@/components/dashboard/checklist-v2/use-schedule-payments";
import { totalProfit } from "@/lib/checklist/profit";
import { showsPartial } from "@/lib/checklist/partial-display";
import { ProfitText } from "@/components/dashboard/checklist/profit-text";
import { peso } from "@/components/dashboard/checklist-v2/header";

/** The swipe shows More only. */
const ACTIONS_W = 88;
/** A pointer that moved further than this between down and up was a swipe. */
const TAP_SLOP_PX = 8;
const SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;

/**
 * A borrower's name as the old checklist's pill: tinted with the group's
 * category colour (`--grp`, set by the list), sky when it has none.
 */
// The whole name always shows: a long one wraps onto a second line instead of
// being cut off.
export const namePillClass = `inline-block max-w-full min-w-0 break-words
  rounded-md border border-[var(--grp-border,color-mix(in_srgb,var(--grp,#0ea5e9)_30%,transparent))]
  dark:border-[color-mix(in_srgb,var(--grp,#0ea5e9)_30%,transparent)]
  bg-[color-mix(in_srgb,var(--grp,#0ea5e9)_12%,transparent)] px-2.5 py-1
  text-sm leading-[1.15] font-extrabold text-slate-600 lowercase
  dark:text-slate-200 mb-1`;

export const kindLabel = (type: string) =>
  type === "cash_advance" ? "cash advance" : "loan";

/** The row's name for the list, toasts and headings (see `rowDisplayName`). */
export const rowName = rowDisplayName;

export const openLines = (row: RowView) =>
  row.lines.filter((l) => l.state !== "paid");

/** What has been paid on a part-paid row, across all its schedules. */
export const paidSoFar = (row: RowView) =>
  row.status === "partial"
    ? Math.round(row.lines.reduce((sum, l) => sum + l.recorded, 0) * 100) / 100
    : 0;

/** What the row was before anything was paid: the crossed-out total. */
export const originalTotal = (row: RowView) =>
  Math.round(row.lines.reduce((sum, l) => sum + l.original, 0) * 100) / 100;

/** "oct 23 – dec 8", or one date when they are all the same day. */
function dueRange(lines: { due_date: string }[]) {
  const days = lines.map((l) => l.due_date.slice(0, 10)).sort();
  const word = (d: string) => formatShortDate(d).toLowerCase();
  const first = word(days[0]);
  const last = word(days[days.length - 1]);
  return first === last ? first : `${first} – ${last}`;
}

/**
 * What a collection row says about itself. Under the name: when it is due, how
 * late, and what kind it is, then what was paid. The profit goes with the
 * amount on the right.
 */
function subline(row: RowView): {
  text: string;
  /** Days late, shown as the overdue pill after the text. */
  lateDays?: number;
  /** The installment types shown after the text: the one open schedule's, or
   * every schedule's on a paid row. */
  kinds?: string[];
  /** A parent row of several schedules: more about what it holds. */
  multi?: {
    /** "oct 23 – dec 8": the span of the open schedules' due dates. */
    range: string;
    /** How many of the open schedules are overdue. */
    overdue: number;
    /** Schedules already paid, of all the row's. */
    paid: number;
    total: number;
  };
  /**
   * Nothing paid yet: what the open schedules earn once paid (`expected`).
   * Anything paid: the profit in what has been paid so far.
   */
  profit?: number | null;
  expected?: boolean;
} {
  const open = openLines(row);
  const profit =
    row.status === "unpaid"
      ? {
          profit: totalProfit(open.map((l) => l.installmentProfit)),
          expected: true,
        }
      : { profit: totalProfit(row.lines.map((l) => l.earned)) };
  if (row.status === "paid") {
    return {
      // One schedule: its due date (the payment date is on the line below).
      // Several: how many, and the span they were due over.
      text:
        row.lines.length === 1
          ? `due ${formatShortDate(row.lines[0].due_date).toLowerCase()}`
          : `${row.lines.length} paid`,
      multi:
        row.lines.length > 1
          ? {
              range: dueRange(row.lines),
              overdue: 0,
              paid: row.lines.length,
              total: row.lines.length,
            }
          : undefined,
      kinds: [...new Set(row.lines.map((l) => l.type))],
      ...profit,
    };
  }
  if (open.length > 1) {
    return {
      text: `${open.length} due`,
      lateDays: row.lateDays > 0 ? row.lateDays : undefined,
      kinds: [...new Set(open.map((l) => l.type))],
      multi: {
        range: dueRange(open),
        overdue: open.filter((l) => l.overdue).length,
        paid: row.lines.length - open.length,
        total: row.lines.length,
      },
      ...profit,
    };
  }
  const line = open[0];
  const due = formatShortDate(line.due_date).toLowerCase();
  return {
    text: `due ${due}`,
    lateDays: line.overdue ? line.daysOverdue : undefined,
    kinds: [line.type],
    ...profit,
  };
}

export type CollectRowProps = {
  row: RowView;
  /** Changed while offline and not synced yet. */
  waiting: boolean;
  /** Just changed from another device; the tint fades over 700 ms. */
  highlight: boolean;
  /** Whether this row's swipe actions are showing. */
  swiped: boolean;
  onSwiped(open: boolean): void;
  /** Row tap with one open installment: the pay sheet. */
  onOpenPay(): void;
  onMore(): void;
  /** The "Pay N" pill: the pay sheet (never pays at once). */
  onPayRow(): void;
  /** One tap pays everything left: the check circle, or "Pay all". */
  onPayAll(): void;
  /** An expanded schedule's row: the pay sheet for just that schedule. */
  onOpenLine(lineId: string): void;
  /** Pays one installment from the expanded row. */
  onPayLine(lineId: string): void;
  /** A plain note's tick. */
  onTick(): void;
  /** Schedules paid on the viewed day: a part payment shows only for these. */
  paidIds?: ReadonlySet<string> | null;
};

/**
 * One Collect row: name, second line, ₱ and a pay control, with swipe-left
 * actions. A drag (or any pointer that moved more than 8 px) never counts as
 * a tap; the row only pans horizontally so the list still scrolls.
 */
export function CollectRow({
  row,
  waiting,
  highlight,
  swiped,
  onSwiped,
  onOpenPay,
  onMore,
  onPayRow,
  onPayAll,
  onOpenLine,
  onPayLine,
  onTick,
  paidIds,
}: CollectRowProps) {
  // A part payment shows only on the day it was paid; other days just show
  // what is left.
  const partialShown =
    paidSoFar(row) > 0 &&
    row.lines.some((l) => l.recorded > 0 && showsPartial(l.id, paidIds));
  // Open or closed lives here, not on the screen: a toggle re-renders this row
  // only, not the whole list.
  const [expanded, setExpanded] = useState(false);
  // The schedules mount on the first open and stay, so closing can animate.
  const [bodyMounted, setBodyMounted] = useState(false);
  const onExpandToggle = () => {
    setBodyMounted(true);
    setExpanded((v) => !v);
  };
  const controls = useAnimationControls();
  const dragged = useRef(false);
  const downAt = useRef<{ x: number; y: number } | null>(null);

  const isNote = row.model === null;
  const done = isNote ? row.item.is_checked : row.status === "paid";
  const open = openLines(row);
  const multi = !isNote && open.length > 1;
  const sub = isNote ? null : subline(row);
  // Several schedules on one borrower: the row expands to list every one,
  // paid ones included, so a paid schedule can be tapped to edit it. A row
  // that is all paid expands too, so its schedules can be seen one by one.
  const expandable = !isNote && row.lines.length > 1;
  const hasPayments = row.lines.some(
    (l) => l.state === "paid" || l.recorded > 0,
  );
  const name = rowName(row);
  const width = ACTIONS_W;

  // Closing from outside (another row opened, a sheet opened) springs back.
  useEffect(() => {
    if (!swiped) void controls.start({ x: 0, transition: SPRING });
  }, [swiped, controls]);

  const settle = (openActions: boolean) => {
    void controls.start({
      x: openActions ? -width : 0,
      transition: SPRING,
    });
    onSwiped(openActions);
  };

  const onTap = (
    event: MouseEvent | TouchEvent | PointerEvent,
    info: TapInfo,
  ) => {
    if (dragged.current) return;
    const from = downAt.current;
    if (
      from &&
      Math.hypot(info.point.x - from.x, info.point.y - from.y) > TAP_SLOP_PX
    )
      return;
    // Taps on the row's own buttons are handled by those buttons.
    if ((event.target as Element | null)?.closest("button, a")) return;
    if (swiped) return settle(false);
    // A note's tick is its own button; the rest of the row opens its menu
    // (Edit note, Remove), the way to them without a swipe.
    if (isNote) return onMore();
    // A multi-schedule row opens the pay drawer with every schedule (paid
    // ones too, each with its Undo); the chevron expands the row in place.
    // A single paid row opens the same drawer.
    if (done || (expandable && hasPayments)) onPayRow();
    else if (expandable) onExpandToggle();
    else onOpenPay();
  };

  /** Where the last pointer went down on the row, in viewport pixels. */
  const pressAt = useRef<{ x: number; y: number } | null>(null);

  /**
   * Wraps the row's own buttons (check, pill, expanded checks, Pay all): a
   * press that dragged the row, or moved more than 8 px, is a swipe and must
   * not also click; on a swiped-open row the press only closes it.
   */
  const guard =
    (run: () => void) => (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      // detail 0: keyboard or assistive tech, no pointer involved.
      const fromPointer = event.detail !== 0;
      const from = pressAt.current;
      if (
        fromPointer &&
        (dragged.current ||
          (from &&
            Math.hypot(event.clientX - from.x, event.clientY - from.y) >
              TAP_SLOP_PX))
      )
        return;
      if (swiped) return settle(false);
      run();
    };

  /**
   * The name's link to the borrower page: a drag or a swipe-open row must not
   * also navigate.
   */
  const onNameClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    const from = pressAt.current;
    if (
      dragged.current ||
      swiped ||
      (from &&
        Math.hypot(event.clientX - from.x, event.clientY - from.y) >
          TAP_SLOP_PX)
    ) {
      event.preventDefault();
      if (swiped) settle(false);
    }
  };

  const actionButton = (label: string, className: string, run: () => void) => (
    <button
      type="button"
      tabIndex={swiped ? 0 : -1}
      onClick={() => {
        settle(false);
        run();
      }}
      className={cn("flex-1 text-sm font-semibold text-white", className)}
    >
      {label}
    </button>
  );

  return (
    <li
      data-tour={
        expandable
          ? "checklist-multi-row"
          : isNote
            ? undefined
            : "checklist-row"
      }
      className="relative overflow-hidden border-b border-border
        last:border-b-0"
    >
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ width }}
        aria-hidden={!swiped}
      >
        {actionButton("More", "bg-slate-400 dark:bg-slate-500", onMore)}
      </div>

      <m.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -width, right: 0 }}
        dragElastic={0.08}
        animate={controls}
        onPointerDownCapture={(e) => {
          dragged.current = false;
          pressAt.current = { x: e.clientX, y: e.clientY };
        }}
        onTapStart={(_, info) => {
          dragged.current = false;
          downAt.current = info.point;
        }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={(_, info) =>
          settle(info.offset.x < -48 || info.velocity.x < -300)
        }
        onTap={onTap}
        className={cn(
          `relative touch-pan-y transition-colors duration-700
          motion-reduce:transition-none`,
          highlight
            ? "bg-primary/15"
            : "bg-[color-mix(in_srgb,var(--grp,var(--card))_6%,var(--card))]",
        )}
      >
        {isNote ? (
          <NoteBody
            row={row}
            done={done}
            waiting={waiting}
            onTick={guard(onTick)}
            onOpen={guard(onMore)}
          />
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-2">
              <RowText
                row={row}
                name={name}
                done={done}
                waiting={waiting}
                onNameClick={onNameClick}
                paid={partialShown ? paidSoFar(row) : undefined}
              />
              {expandable && (
                <button
                  type="button"
                  aria-expanded={expanded}
                  data-tour="checklist-expand"
                  aria-label={`${expanded ? "Hide" : "Show"} ${row.lines.length} schedules for ${name}`}
                  onClick={guard(onExpandToggle)}
                  className="-mx-1 flex size-11 shrink-0 items-center
                    justify-center text-muted-foreground"
                >
                  <ChevronDown
                    className={cn(
                      `size-5 transition-transform
                        motion-reduce:transition-none`,
                      expanded && "rotate-180",
                    )}
                  />
                </button>
              )}
              <span className="shrink-0 text-right">
                {/* Only the figures sit here, so the name keeps the width. What
                    was paid so far is a badge under the name. */}
                {partialShown && (
                  <span
                    className="block text-[11px] leading-tight
                      text-muted-foreground tabular-nums line-through"
                    aria-label={`Original ${peso(originalTotal(row))}`}
                  >
                    {peso(originalTotal(row))}
                  </span>
                )}
                <span
                  className={cn(
                    "block text-[15px] font-bold text-zinc-600 tabular-nums ",
                    done && "text-muted-foreground opacity-55",
                  )}
                  aria-label={
                    partialShown ? `${peso(row.left)} left` : undefined
                  }
                >
                  {peso(done ? row.total : row.left)}
                </span>
                {/* Money stays together: the profit sits under the amount. */}
                <ProfitText
                  amount={sub?.profit}
                  expected={sub?.expected}
                  className={cn(
                    "block text-[11px] leading-tight",
                    done && "opacity-55",
                  )}
                />
              </span>
              {done ? (
                <button
                  type="button"
                  aria-label={`Payments for ${name}`}
                  onClick={guard(onPayRow)}
                  className="-mr-1 flex size-6 items-center justify-center"
                >
                  <span
                    className="flex size-6 items-center justify-center
                      rounded-full bg-primary text-primary-foreground"
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                </button>
              ) : multi ? (
                <button
                  type="button"
                  aria-label={`Pay ${open.length} installments for ${name}`}
                  data-tour="checklist-pay-pill"
                  onClick={guard(onPayRow)}
                  // The check circles' size, so the column lines up.
                  className="-mr-1 flex h-6 min-w-6 items-center justify-center
                    rounded-full border border-muted-foreground/40 px-1
                    text-[11px] font-bold tabular-nums transition-colors
                    active:bg-muted"
                >
                  {open.length}
                </button>
              ) : (
                <button
                  type="button"
                  aria-label={`Mark ${name} paid, ${peso(row.left)}`}
                  data-tour="checklist-check"
                  onClick={guard(onPayAll)}
                  className="-mr-1 flex size-6 items-center justify-center"
                >
                  {partialShown ? (
                    <PartialMark />
                  ) : (
                    <span
                      className={cn(
                        `flex size-6 items-center justify-center rounded-full
                          border text-muted-foreground transition-colors
                          active:bg-primary active:text-primary-foreground`,
                        row.status === "partial"
                          ? "border-primary/50 text-primary"
                          : "border-muted-foreground/40",
                      )}
                    >
                      <Check className="size-3.5" strokeWidth={2.5} />
                    </span>
                  )}
                </button>
              )}
            </div>

            {expandable && (
              // Open and close by animating the grid row from 0fr to 1fr in CSS.
              // On a touch device (an iPhone's WebKit re-lays the list out on
              // every frame, and it lagged) the rows change at once and only
              // the content fades, which costs no layout.
              <div
                inert={!expanded}
                className={cn(
                  `grid transition-[grid-template-rows,opacity] duration-200
                    ease-out motion-reduce:transition-none
                    [@media(hover:none)]:transition-opacity
                    [@media(hover:none)]:duration-150`,
                  expanded
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  {bodyMounted && (
                    <div
                      data-tour="checklist-lines"
                      className="mx-4 mb-3 rounded-xl bg-muted/50 px-3 py-1"
                    >
                      <LineList
                        row={row}
                        grouped
                        paidIds={paidIds}
                        onOpen={(id) => guard(() => onOpenLine(id))}
                        onPay={(id) => guard(() => onPayLine(id))}
                      />
                      {multi && (
                        <button
                          type="button"
                          onClick={guard(onPayAll)}
                          className="my-2 w-full rounded-lg bg-primary/10 py-2
                            text-sm font-semibold text-primary
                            active:bg-primary/20"
                        >
                          Pay all {peso(row.left)}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </m.div>
    </li>
  );
}

function RowText({
  row,
  name,
  done,
  waiting,
  onNameClick,
  paid,
}: {
  row: RowView;
  name: string;
  done: boolean;
  waiting: boolean;
  onNameClick(event: ReactMouseEvent<HTMLAnchorElement>): void;
  /** Part-paid: the amount recorded so far, shown as a badge. */
  paid?: number;
}) {
  const sub = subline(row);
  const borrowerId = row.model?.borrower?.id ?? null;
  // A row of one schedule has no list to open: its payment dates show here.
  const single = row.lines.length === 1 ? row.lines[0] : null;
  const hasPayment =
    !!single && (single.state === "paid" || single.recorded > 0);
  const payments = useSchedulePayments(single ? [single.id] : [], hasPayment);
  const facts: ReactNode[] = [];
  if (sub.text) facts.push(sub.text);
  // A parent of several schedules: the span they cover, then how many are
  // overdue (the oldest by how much), and how many are already paid.
  if (sub.multi && sub.multi.range) facts.push(sub.multi.range);
  if (sub.lateDays !== undefined) {
    facts.push(
      <LateText
        days={sub.lateDays}
        count={sub.multi && sub.multi.overdue > 1 ? sub.multi.overdue : 0}
      />,
    );
  }
  if (sub.multi && sub.multi.paid > 0 && sub.multi.paid < sub.multi.total) {
    facts.push(
      <span className="text-emerald-700 dark:text-emerald-400">
        {sub.multi.paid} of {sub.multi.total} paid
      </span>,
    );
  }
  for (const type of sub.kinds ?? []) {
    facts.push(<KindBadge type={type} compact />);
  }
  return (
    <div className={cn("min-w-0 flex-1", done && "opacity-55")}>
      <p className="flex min-w-0 items-start gap-1.5">
        {borrowerId ? (
          <Link
            href={`/borrowers/${borrowerId}`}
            data-tour="checklist-name"
            draggable={false}
            onClick={onNameClick}
            className={namePillClass}
          >
            {name}
          </Link>
        ) : (
          <span className={namePillClass}>{name}</span>
        )}
        {row.model?.note && (
          <NotebookPen
            className="size-3.5 shrink-0 text-amber-500"
            aria-label="Has a note"
          />
        )}
        {waiting && <WaitingIcon />}
      </p>
      {/* One line, always in the same order: due, how late, kind. */}
      {facts.length > 0 && (
        <p
          className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5
            text-[10px] font-semibold text-muted-foreground"
        >
          {facts.map((fact, i) => (
            <span key={i} className="flex items-center gap-x-1.5">
              {i > 0 && (
                <span aria-hidden="true" className="opacity-50">
                  ·
                </span>
              )}
              {fact}
            </span>
          ))}
        </p>
      )}
      {/* Then what was paid: the payment dates of a single schedule, or the
          amount so far across several. */}
      {single && hasPayment ? (
        <PaymentHistory
          payments={payments?.[single.id]}
          dueDate={single.due_date}
        />
      ) : (
        paid !== undefined && (
          <p className="mt-0.5 leading-none">
            <PaidBadge amount={paid} className="ml-0" />
          </p>
        )
      )}
    </div>
  );
}

/** "14d late" in red: how overdue a row is, as plain text on its line. */
function LateText({ days, count = 0 }: { days: number; count?: number }) {
  const { short, spoken } = lateLabel(days);
  return (
    <span
      className="font-bold text-rose-600 dark:text-rose-400"
      aria-label={count > 1 ? `${count} overdue, oldest ${spoken}` : spoken}
    >
      {count > 1 ? `${count} overdue · oldest ${short}` : `${short} late`}
    </span>
  );
}

/** The installment's type: purple for a loan, amber for a cash advance. */
export function KindBadge({
  type,
  compact,
  className,
}: {
  type: string;
  /** Single-schedule rows: "ca" for a cash advance. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        `inline-flex items-center gap-1 align-middle text-slate-600 lowercase
        dark:text-slate-300`,
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          type === "cash_advance" ? "bg-amber-400" : "bg-violet-500",
        )}
        aria-hidden="true"
      />
      {compact && type === "cash_advance" ? "ca" : kindLabel(type)}
    </span>
  );
}

/** Part-paid: what has been recorded so far. */
export function PaidBadge({
  amount,
  className,
}: {
  amount: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        `ml-1.5 inline-block rounded-full bg-violet-500/8 px-1 align-middle
        text-[9px] leading-4 font-semibold tracking-wide text-violet-900
        lowercase dark:bg-violet-400/10 dark:text-violet-200`,
        className,
      )}
    >
      {peso(amount)} paid
    </span>
  );
}

function WaitingIcon() {
  return (
    <CloudUpload
      className="ml-1.5 inline size-3.5 text-sky-500"
      aria-label="Waiting to sync"
    />
  );
}

/** One installment inside an expanded row, with its own check. */
function LineItem({
  line,
  showPartial,
  grouped = false,
  payments,
  onOpen,
  onPay,
}: {
  line: RowLine;
  /** Payments made on this schedule, oldest first, once loaded. */
  payments?: SchedulePayment[];
  /** Under its loan's heading: the date leads, the type is the heading's. */
  grouped?: boolean;
  /** Whether this schedule was paid on the viewed day (see `showsPartial`). */
  showPartial: boolean;
  /** Tapping the schedule itself, or a paid one's check: its pay drawer. */
  onOpen(event: ReactMouseEvent<HTMLButtonElement>): void;
  onPay(event: ReactMouseEvent<HTMLButtonElement>): void;
}) {
  const paid = line.state === "paid";
  const due = formatShortDate(line.due_date).toLowerCase();
  const partPaid = line.state === "partial" && showPartial;
  return (
    <div
      className="flex items-center gap-3 border-b border-border py-2
        last:border-b-0"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-10 min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {grouped ? (
              <span className="font-bold text-foreground/80">{due}</span>
            ) : (
              <KindBadge type={line.type} />
            )}
          </p>
          {/* The same order as the row above: due, how late, then what was
              paid. The profit is under the amount. */}
          {(!grouped || line.overdue) && (
            <p
              className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5
                text-[10px] font-semibold text-muted-foreground"
            >
              {!grouped && `due ${due}`}
              {!grouped && line.overdue && (
                <span aria-hidden="true" className="opacity-50">
                  ·
                </span>
              )}
              {line.overdue && <LateText days={line.daysOverdue} />}
            </p>
          )}
          {payments && payments.length > 0 ? (
            <PaymentHistory payments={payments} dueDate={line.due_date} />
          ) : (
            partPaid && (
              <p className="mt-0.5 leading-none">
                <PaidBadge amount={line.recorded} className="ml-0" />
              </p>
            )
          )}
        </div>
        <span className="shrink-0 text-right">
          {partPaid && (
            <span
              className="block text-[11px] leading-tight text-muted-foreground
                tabular-nums line-through"
              aria-label={`Original ${peso(line.original)}`}
            >
              {peso(line.original)}
            </span>
          )}
          <span className="block text-sm font-black text-zinc-600 tabular-nums">
            {peso(paid ? line.amount : line.left)}
          </span>
          <ProfitText
            {...lineProfit(line, showPartial)}
            className="block text-[11px] leading-tight"
          />
        </span>
      </button>
      <button
        type="button"
        aria-label={
          paid
            ? `Payment for ${kindLabel(line.type)} due ${due}`
            : `Pay ${kindLabel(line.type)} due ${due}, ${peso(line.left)}`
        }
        onClick={paid ? onOpen : onPay}
        className="flex size-10 items-center justify-center"
      >
        {line.state === "partial" && showPartial ? (
          <PartialMark />
        ) : (
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full border",
              paid
                ? "border-transparent bg-primary text-primary-foreground"
                : line.state === "partial"
                  ? "border-primary/50 text-primary"
                  : "border-muted-foreground/40 text-muted-foreground",
            )}
          >
            <Check className="size-3.5" strokeWidth={2.5} />
          </span>
        )}
      </button>
    </div>
  );
}

/**
 * A part payment made on the viewed day: a circle half filled in the
 * partial purple, in place of the check (paid, but not in full).
 */
function PartialMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-6 items-center justify-center rounded-full border-2
        border-[#7f5ead]"
      style={{
        backgroundImage:
          "linear-gradient(to right, #7f5ead 50%, transparent 50%)",
      }}
    />
  );
}

/**
 * An open row's installments. A row with several is split per loan, each
 * under a heading with its principal and release date.
 */
function LineList({
  row,
  grouped,
  paidIds,
  onOpen,
  onPay,
}: {
  row: RowView;
  grouped: boolean;
  paidIds: CollectRowProps["paidIds"];
  onOpen(lineId: string): (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onPay(lineId: string): (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const lineIds = useMemo(() => row.lines.map((l) => l.id), [row.lines]);
  const payments = useSchedulePayments(lineIds, true);
  const item = (line: RowLine) => (
    <LineItem
      key={line.id}
      line={line}
      grouped={grouped}
      payments={payments?.[line.id]}
      showPartial={showsPartial(line.id, paidIds)}
      onOpen={onOpen(line.id)}
      onPay={onPay(line.id)}
    />
  );
  if (!grouped) return <>{row.lines.map(item)}</>;
  // One heading per type, loans first, its schedules listed under it by due
  // date.
  const byType = (type: string) =>
    row.lines
      .filter((l) => (l.type === "cash_advance") === (type === "cash_advance"))
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
  return (
    <>
      {["loan", "cash_advance"].map((type) => {
        const lines = byType(type);
        if (lines.length === 0) return null;
        return (
          <div key={type} className="border-b border-border/70 last:border-b-0">
            <p
              className="flex items-center gap-1.5 pt-2.5 pb-0.5 text-[11px]
                font-bold text-muted-foreground"
            >
              <KindBadge type={type} />
              <span className="ml-auto font-semibold tabular-nums">
                {lines.length}
              </span>
            </p>
            {lines.map(item)}
          </div>
        );
      })}
    </>
  );
}

/** A plain note: a tick and its text, no pay control. */
function NoteBody({
  row,
  done,
  waiting,
  onTick,
  onOpen,
}: {
  row: RowView;
  done: boolean;
  waiting: boolean;
  onTick(event: ReactMouseEvent<HTMLButtonElement>): void;
  /** The note's text: opens the row menu. */
  onOpen(event: ReactMouseEvent<HTMLButtonElement>): void;
}) {
  const text = plainLabelText(row.item.label);
  return (
    <div className="flex items-center gap-1 py-0.5 pr-4 pl-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Untick ${text}` : `Tick ${text}`}
        onClick={onTick}
        className="flex size-11 shrink-0 items-center justify-center"
      >
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-md border",
            done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/40",
          )}
        >
          {done && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${text}, open menu`}
        className="flex min-h-11 min-w-0 flex-1 items-center text-left"
      >
        <span
          className={cn(
            "line-clamp-2 min-w-0 text-sm whitespace-pre-line",
            done && "text-muted-foreground line-through",
          )}
        >
          {text}
          {waiting && <WaitingIcon />}
        </span>
      </button>
    </div>
  );
}
