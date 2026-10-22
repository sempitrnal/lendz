"use client";

import Link from "next/link";
import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  type TapInfo,
} from "framer-motion";
import { Check, ChevronDown, CloudUpload, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/checklist/labels";
import { plainLabelText, rowDisplayName } from "@/lib/checklist/row-name";
import type { RowLine, RowView } from "@/lib/checklist/row-state";
import { chipClass } from "@/components/dashboard/checklist/dom";
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
export const namePillClass = `inline-block max-w-full min-w-0 truncate
  rounded-md border border-[color-mix(in_srgb,var(--grp,#0ea5e9)_30%,transparent)]
  bg-[color-mix(in_srgb,var(--grp,#0ea5e9)_12%,transparent)] px-2.5 py-1
  text-sm leading-none font-semibold text-slate-700 lowercase
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

/** The muted second line of a collection row, per the spec's row table. */
function subline(row: RowView): {
  text: string;
  /** "3d late": shown as the overdue pill after the text. */
  lateLabel?: string;
  /** The installment types shown after the text: the one open schedule's, or
   * every schedule's on a paid row. */
  kinds?: string[];
} {
  if (row.status === "paid") {
    return {
      text: "paid · tap to edit",
      kinds: [...new Set(row.lines.map((l) => l.type))],
    };
  }
  const open = openLines(row);
  if (open.length > 1) {
    return {
      text: `${open.length} due`,
      lateLabel: row.lateDays > 0 ? `oldest ${row.lateDays}d late` : undefined,
    };
  }
  const line = open[0];
  const due = formatShortDate(line.due_date).toLowerCase();
  return {
    text: due,
    lateLabel: line.overdue ? `${line.daysOverdue}d late` : undefined,
    kinds: [line.type],
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
  /** Row tap with several open installments. */
  onExpandToggle(): void;
  expanded: boolean;
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
  onExpandToggle,
  expanded,
}: CollectRowProps) {
  const controls = useAnimationControls();
  const dragged = useRef(false);
  const downAt = useRef<{ x: number; y: number } | null>(null);

  const isNote = row.model === null;
  const done = isNote ? row.item.is_checked : row.status === "paid";
  const open = openLines(row);
  const multi = !isNote && open.length > 1;
  // Several schedules on one borrower: the row expands to list every one,
  // paid ones included, so a paid schedule can be tapped to edit it.
  const expandable = !isNote && !done && row.lines.length > 1;
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

      <motion.div
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
          highlight ? "bg-primary/15" : "bg-card",
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
              />
              {expandable && (
                <button
                  type="button"
                  aria-expanded={expanded}
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
                {paidSoFar(row) > 0 && (
                  <span className="flex items-center justify-end">
                    <PaidBadge amount={paidSoFar(row)} />
                    <span
                      className="ml-1.5 text-[11px] tabular-nums leading-tight
                        text-muted-foreground line-through"
                      aria-label={`Original ${peso(originalTotal(row))}`}
                    >
                      {peso(originalTotal(row))}
                    </span>
                  </span>
                )}
                <span
                  className={cn(
                    "block text-[15px] font-bold text-zinc-600 tabular-nums ",
                    done && "text-muted-foreground opacity-55",
                  )}
                  aria-label={
                    paidSoFar(row) > 0 ? `${peso(row.left)} left` : undefined
                  }
                >
                  {peso(done ? row.total : row.left)}
                </span>
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
                  className="flex h-8 items-center rounded-full border
                    border-muted-foreground/40 px-2 lowercase text-xs
                    font-semibold transition-colors active:bg-muted"
                >
                  Pay {open.length}
                </button>
              ) : (
                <button
                  type="button"
                  aria-label={`Mark ${name} paid, ${peso(row.left)}`}
                  data-tour="checklist-check"
                  onClick={guard(onPayAll)}
                  className="-mr-1 flex size-6 items-center justify-center"
                >
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
                </button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {expanded && expandable && (
                <motion.div
                  key="expanded"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mx-4 mb-3 rounded-xl bg-muted/50 px-3 py-1">
                    {row.lines.map((line) => (
                      <LineItem
                        key={line.id}
                        line={line}
                        onOpen={guard(() => onOpenLine(line.id))}
                        onPay={guard(() => onPayLine(line.id))}
                      />
                    ))}
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
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
    </li>
  );
}

function RowText({
  row,
  name,
  done,
  waiting,
  onNameClick,
}: {
  row: RowView;
  name: string;
  done: boolean;
  waiting: boolean;
  onNameClick(event: ReactMouseEvent<HTMLAnchorElement>): void;
}) {
  const sub = subline(row);
  const borrowerId = row.model?.borrower?.id ?? null;
  return (
    <div className={cn("min-w-0 flex-1", done && "opacity-55")}>
      <p className="flex min-w-0 items-center gap-1.5">
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
      <p
        className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5
          text-[10px] font-semibold text-muted-foreground"
      >
        {sub.text}
        {sub.lateLabel && <LatePill label={sub.lateLabel} />}
        {sub.kinds?.map((type) => (
          <KindBadge key={type} type={type} compact />
        ))}
      </p>
    </div>
  );
}

/** The old checklist's overdue pill. */
function LatePill({ label }: { label: string }) {
  return <span className={chipClass("overdue")}>{label}</span>;
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
export function PaidBadge({ amount }: { amount: number }) {
  return (
    <span
      className="ml-1.5 inline-block rounded-full bg-violet-500/8 px-1
        align-middle text-[9px] leading-4 font-semibold tracking-wide
        text-violet-900 lowercase dark:bg-violet-400/10 dark:text-violet-200"
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
  onOpen,
  onPay,
}: {
  line: RowLine;
  /** Tapping the schedule itself, or a paid one's check: its pay drawer. */
  onOpen(event: ReactMouseEvent<HTMLButtonElement>): void;
  onPay(event: ReactMouseEvent<HTMLButtonElement>): void;
}) {
  const paid = line.state === "paid";
  const due = formatShortDate(line.due_date).toLowerCase();
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
            <KindBadge type={line.type} />
          </p>
          <p
            className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5
              text-[10px] font-semibold text-muted-foreground"
          >
            {due}
            {line.overdue && <LatePill label={`${line.daysOverdue}d late`} />}
            {paid ? "paid · tap to edit" : ""}
          </p>
        </div>
        <span className="shrink-0 text-right">
          {line.state === "partial" && (
            <span className="flex items-center justify-end">
              <PaidBadge amount={line.recorded} />
              <span
                className="ml-1.5 text-xs leading-tight font-bold tabular-nums
                  text-muted-foreground line-through"
                aria-label={`Original ${peso(line.original)}`}
              >
                {peso(line.original)}
              </span>
            </span>
          )}
          <span className="block text-sm text-zinc-600 font-black tabular-nums">
            {peso(paid ? line.amount : line.left)}
          </span>
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
      </button>
    </div>
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
