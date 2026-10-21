"use client";

import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  type TapInfo,
} from "framer-motion";
import { Check, CloudUpload, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/checklist/labels";
import { plainLabelText, rowDisplayName } from "@/lib/checklist/row-name";
import type { RowLine, RowView } from "@/lib/checklist/row-state";
import { peso } from "@/components/dashboard/checklist-v2/header";

/** Partial (or Payment), Note and More, 64 px each. */
const ACTIONS_W = 192;
/** A plain note has no payment, so only Note and More. */
const NOTE_ACTIONS_W = 128;
/** A pointer that moved further than this between down and up was a swipe. */
const TAP_SLOP_PX = 8;
const SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;

export const kindLabel = (type: string) =>
  type === "cash_advance" ? "cash advance" : "loan";

/** The row's name for the list, toasts and headings (see `rowDisplayName`). */
export const rowName = rowDisplayName;

export const openLines = (row: RowView) =>
  row.lines.filter((l) => l.state !== "paid");

/** The muted second line of a collection row, per the spec's row table. */
function subline(row: RowView): { text: string; late: boolean } {
  if (row.status === "paid") return { text: "paid · tap to edit", late: false };
  const open = openLines(row);
  if (open.length > 1) {
    return {
      text: `${open.length} due${
        row.lateDays > 0 ? ` · oldest ${row.lateDays}d late` : ""
      }`,
      late: row.lateDays > 0,
    };
  }
  const line = open[0];
  const paid = line.paid > 0 ? `${peso(line.paid)} paid · ` : "";
  const due = formatShortDate(line.due_date).toLowerCase();
  const late = line.overdue ? ` · ${line.daysOverdue}d late` : "";
  return {
    text: `${paid}${due}${late} · ${kindLabel(line.type)}`,
    late: line.overdue,
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
  /** Paid row (tap or its check), or Payment on a paid row's swipe. */
  onEditPayments(): void;
  /** Swipe → Partial on an unpaid row. */
  onPartial(): void;
  onNote(): void;
  onMore(): void;
  /** The "Pay N" pill: the pay sheet (never pays at once). */
  onPayRow(): void;
  /** One tap pays everything left: the check circle, or "Pay all". */
  onPayAll(): void;
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
  onEditPayments,
  onPartial,
  onNote,
  onMore,
  onPayRow,
  onPayAll,
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
  const name = rowName(row);
  const width = isNote ? NOTE_ACTIONS_W : ACTIONS_W;

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
    if ((event.target as Element | null)?.closest("button")) return;
    if (swiped) return settle(false);
    // A note's tick is its own button; the rest of the row opens its menu
    // (Edit note, Remove), the way to them without a swipe.
    if (isNote) return onMore();
    if (done) onEditPayments();
    else if (multi) onExpandToggle();
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
      className="relative overflow-hidden border-b border-border
        last:border-b-0"
    >
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ width }}
        aria-hidden={!swiped}
      >
        {!isNote &&
          actionButton(
            done ? "Payment" : "Partial",
            "bg-amber-500",
            done ? onEditPayments : onPartial,
          )}
        {actionButton("Note", "bg-slate-600", onNote)}
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
          "relative touch-pan-y transition-colors duration-700 motion-reduce:transition-none",
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
              <RowText row={row} name={name} done={done} waiting={waiting} />
              <span
                className={cn(
                  "text-[15px] font-semibold tabular-nums",
                  done && "text-muted-foreground opacity-55",
                )}
              >
                {peso(done ? row.total : row.left)}
              </span>
              {done ? (
                <button
                  type="button"
                  aria-label={`Edit payments for ${name}`}
                  onClick={guard(onEditPayments)}
                  className="-mr-1 flex size-11 items-center justify-center"
                >
                  <span
                    className="flex size-8 items-center justify-center
                      rounded-full bg-primary text-primary-foreground"
                  >
                    <Check className="size-4" strokeWidth={3} />
                  </span>
                </button>
              ) : multi ? (
                <button
                  type="button"
                  aria-label={`Pay ${open.length} installments for ${name}`}
                  onClick={guard(onPayRow)}
                  className="flex h-9 items-center rounded-full border
                    border-muted-foreground/40 px-3 text-sm font-semibold
                    transition-colors active:bg-muted"
                >
                  Pay {open.length}
                </button>
              ) : (
                <button
                  type="button"
                  aria-label={`Mark ${name} paid, ${peso(row.left)}`}
                  onClick={guard(onPayAll)}
                  className="-mr-1 flex size-11 items-center justify-center"
                >
                  <span
                    className={cn(
                      `flex size-8 items-center justify-center rounded-full
                        border text-muted-foreground transition-colors
                        active:bg-primary active:text-primary-foreground`,
                      row.status === "partial"
                        ? "border-primary/50 text-primary"
                        : "border-muted-foreground/40",
                    )}
                  >
                    <Check className="size-4" strokeWidth={2.5} />
                  </span>
                </button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {expanded && multi && (
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
                        onPay={guard(() => onPayLine(line.id))}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={guard(onPayAll)}
                      className="my-2 w-full rounded-lg bg-primary/10 py-2
                        text-sm font-semibold text-primary active:bg-primary/20"
                    >
                      Pay all {peso(row.left)}
                    </button>
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
}: {
  row: RowView;
  name: string;
  done: boolean;
  waiting: boolean;
}) {
  const sub = subline(row);
  return (
    <div className={cn("min-w-0 flex-1", done && "opacity-55")}>
      <p
        className={cn(
          "truncate text-[15px] font-medium lowercase",
          done && "line-through",
        )}
      >
        {name}
        {row.model?.note && (
          <NotebookPen
            className="ml-1.5 inline size-3.5 text-amber-500"
            aria-label="Has a note"
          />
        )}
        {waiting && <WaitingIcon />}
      </p>
      <p
        className={cn(
          "truncate text-xs",
          sub.late
            ? "text-rose-600 dark:text-rose-400"
            : "text-muted-foreground",
        )}
      >
        {sub.text}
      </p>
    </div>
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
  onPay,
}: {
  line: RowLine;
  onPay(event: ReactMouseEvent<HTMLButtonElement>): void;
}) {
  const paid = line.state === "paid";
  const due = formatShortDate(line.due_date).toLowerCase();
  return (
    <div
      className="flex items-center gap-3 border-b border-border py-2
        last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium capitalize">{kindLabel(line.type)}</p>
        <p
          className={cn(
            "text-xs",
            line.overdue
              ? "text-rose-600 dark:text-rose-400"
              : "text-muted-foreground",
          )}
        >
          {line.paid > 0 && !paid ? `${peso(line.paid)} paid · ` : ""}
          {due}
          {line.overdue ? ` · ${line.daysOverdue}d late` : ""}
          {paid ? " · paid" : ""}
        </p>
      </div>
      <span className="text-sm font-semibold tabular-nums">
        {peso(paid ? line.amount : line.left)}
      </span>
      <button
        type="button"
        disabled={paid}
        aria-label={
          paid
            ? `${kindLabel(line.type)} due ${due} paid`
            : `Pay ${kindLabel(line.type)} due ${due}, ${peso(line.left)}`
        }
        onClick={onPay}
        className="flex size-10 items-center justify-center"
      >
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full border",
            paid
              ? "border-transparent bg-primary text-primary-foreground"
              : line.state === "partial"
                ? "border-primary/50 text-primary"
                : "border-muted-foreground/40 text-muted-foreground",
          )}
        >
          <Check className="size-4" strokeWidth={2.5} />
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
