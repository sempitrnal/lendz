"use client";

import { useEffect, useRef, useState } from "react";
import {
  m,
  AnimatePresence,
  animate,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { Check, ChevronDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScheduleSelection } from "@/components/schedule-selection-provider";
import { ScheduleCheckbox } from "@/components/schedule-checkbox";

export type ScheduleState = "paid" | "partial" | "overdue" | "pending";

/** The dot on the rail, one look per state; the next one is yellow. */
const DOT: Record<ScheduleState, string> = {
  paid: "border-emerald-500 bg-emerald-500 text-white",
  partial:
    "border-violet-400 bg-violet-100 dark:border-violet-500 dark:bg-violet-900/50",
  overdue:
    "border-rose-400 bg-rose-100 dark:border-rose-500 dark:bg-rose-900/50",
  pending: "border-slate-300 bg-card dark:border-slate-600",
};

const STATE_LABEL: Record<ScheduleState, string> = {
  paid: "paid",
  partial: "partial",
  overdue: "overdue",
  pending: "",
};

const LABEL_TONE: Record<ScheduleState, string> = {
  paid: "text-emerald-700 dark:text-emerald-300",
  partial: "text-violet-600 dark:text-violet-300",
  overdue: "text-rose-600 dark:text-rose-300",
  pending: "text-sky-700 dark:text-sky-300",
};

function shortDay(date: string) {
  const [, month, day] = date.slice(0, 10).split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** How far a row slides left: the 56px delete tile plus a small gap. */
const SWIPE_WIDTH = 68;
const SNAP = { type: "spring", stiffness: 500, damping: 40 } as const;

const SUB_TONES = {
  slate: "text-slate-500 dark:text-slate-400",
  emerald: "text-emerald-700 dark:text-emerald-300",
  amber: "text-amber-700 dark:text-amber-300",
  rose: "text-rose-600 dark:text-rose-300",
} as const;

export type ScheduleTimelineItemProps = {
  scheduleId: string;
  id?: string;
  /** 1-based position in the whole schedule. */
  number: number;
  total: number;
  isNext: boolean;
  state: ScheduleState;
  /** `YYYY-MM-DD`, for the calendar tile. */
  dueDate: string;
  amountLabel: string;
  /** Under the amount: "due in 14 days", "Paid Sep 20 · 10 days early", … */
  subLabel: string;
  subTone?: keyof typeof SUB_TONES;
  rollingInterestLabel?: string;
  partial?: { paidLabel: string; leftLabel: string; pct: number };
  note?: string | null;
  actions?: React.ReactNode;
  history?: React.ReactNode;
  defaultOpen?: boolean;
  /** Enables swipe-left to reveal a delete button. */
  onDelete?: () => void;
  /** The last dot on the rail has no line below it. */
  isLast?: boolean;
};

export function ScheduleTimelineItem({
  scheduleId,
  id,
  number,
  total,
  isNext,
  state,
  dueDate,
  amountLabel,
  subLabel,
  subTone = "slate",
  rollingInterestLabel,
  partial,
  note,
  actions,
  history,
  defaultOpen,
  onDelete,
  isLast,
}: ScheduleTimelineItemProps) {
  const { isEditing, isSelected, toggleId } = useScheduleSelection();
  const selected = isSelected(scheduleId);
  const [open, setOpen] = useState(defaultOpen ?? isNext);
  const reduceMotion = useReducedMotion();

  const hasExpand = Boolean(actions || history);

  const canSwipe = Boolean(onDelete) && !isEditing;
  const rowRef = useRef<HTMLLIElement>(null);
  const dragControls = useDragControls();
  const x = useMotionValue(0);
  // The row tints are see-through, so the red layer only shows once it moves.
  const actionOpacity = useTransform(x, [-SWIPE_WIDTH, -12, 0], [1, 0, 0]);
  const [revealed, setRevealed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /** Set while a drag is in progress so the click that ends it is ignored. */
  const draggedRef = useRef(false);

  function snap(open: boolean) {
    setRevealed(open);
    if (!open) setConfirming(false);
    void animate(x, open ? -SWIPE_WIDTH : 0, SNAP);
  }

  // A tap anywhere else closes an open row.
  useEffect(() => {
    if (!revealed) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rowRef.current?.contains(e.target as Node)) return;
      setRevealed(false);
      setConfirming(false);
      void animate(x, 0, SNAP);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [revealed, x]);

  function handleTap() {
    if (draggedRef.current) return;
    if (revealed) {
      snap(false);
      return;
    }
    if (isEditing) {
      toggleId(scheduleId);
      return;
    }
    if (hasExpand) setOpen((v) => !v);
  }

  return (
    <m.li
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      id={id}
      ref={rowRef}
      className="relative pb-2"
    >
      {/* The rail: a line down to the next dot, and this installment's dot. */}
      {!isLast && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-7 -bottom-2 left-[11px] w-0.5",
            state === "paid"
              ? "bg-emerald-300 dark:bg-emerald-800"
              : "bg-slate-200 dark:bg-white/10",
          )}
        />
      )}
      <span
        aria-hidden="true"
        className={cn(
          `absolute top-3 left-0 z-10 flex size-6 items-center justify-center
          rounded-full border-2`,
          isNext && state === "pending"
            ? "border-yellow-400 bg-yellow-100 dark:bg-yellow-900/40"
            : DOT[state],
        )}
      >
        {state === "paid" && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <div className="relative ml-9">
        {onDelete ? (
          <m.div
            style={{ opacity: actionOpacity }}
            className="absolute top-0 right-0 flex w-14 justify-end"
            aria-hidden={!revealed}
          >
            <m.button
              type="button"
              tabIndex={revealed ? 0 : -1}
              onClick={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                snap(false);
                onDelete();
              }}
              animate={
                confirming && !reduceMotion ? { scale: [1, 1.08, 1] } : {}
              }
              transition={{ duration: 0.25 }}
              aria-label={confirming ? "Confirm delete" : "Delete schedule"}
              className={cn(
                `flex size-14 flex-col items-center justify-center gap-0.5
                  rounded-2xl border text-[9px] font-black tracking-wide
                  uppercase shadow-sm transition-colors duration-200`,
                confirming
                  ? `border-rose-600 bg-rose-600 text-white dark:border-rose-500
                    dark:bg-rose-600`
                  : `border-rose-200 bg-rose-50 text-rose-600
                    dark:border-rose-900/60 dark:bg-rose-950/40
                    dark:text-rose-300`,
              )}
            >
              <Trash2 className="size-4" />
              {confirming ? "confirm" : "delete"}
            </m.button>
          </m.div>
        ) : null}
        <m.div
          drag={canSwipe ? "x" : false}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ left: -SWIPE_WIDTH, right: 0 }}
          dragElastic={{ left: 0.15, right: 0 }}
          dragMomentum={false}
          style={{ x }}
          onDragStart={() => {
            draggedRef.current = true;
          }}
          onDragEnd={(_, info) => {
            snap(
              info.offset.x < -SWIPE_WIDTH / 2 ||
                (info.velocity.x < -400 && info.offset.x < 0),
            );
            // Let the click that ends the drag pass before taps count again.
            setTimeout(() => {
              draggedRef.current = false;
            }, 0);
          }}
          className={cn(
            `relative overflow-hidden rounded-2xl bg-card transition-colors
            duration-200`,
            isNext &&
              `bg-yellow-50 ring-1 ring-yellow-200 dark:bg-[#2b2615]
              dark:ring-yellow-500/30`,
            selected && "ring-2 ring-cyan-400 dark:ring-cyan-500",
          )}
        >
          <div
            onClick={handleTap}
            onPointerDown={(e) => {
              if (canSwipe) dragControls.start(e);
            }}
            style={canSwipe ? { touchAction: "pan-y" } : undefined}
            className={cn(
              "flex items-start gap-3 px-3 py-2.5",
              (isEditing || hasExpand) && "cursor-pointer",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2">
                <span
                  className="text-lg leading-tight font-black tracking-tight
                    text-card-foreground/70 tabular-nums"
                >
                  {amountLabel}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {shortDay(dueDate)}
                </span>
              </p>
              <p className={cn("text-[11px] font-medium", SUB_TONES[subTone])}>
                {number} of {total} · {subLabel}
              </p>
              {rollingInterestLabel ? (
                <p
                  className="text-[10px] text-slate-400 tabular-nums
                    dark:text-slate-500"
                >
                  {rollingInterestLabel}
                </p>
              ) : null}
              {partial ? (
                <div className="mt-1.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[#b9a8d8] transition-all
                        duration-500 dark:bg-[#6b5a8c]"
                      style={{ width: `${partial.pct}%` }}
                    />
                  </div>
                  <p
                    className="mt-1 text-[11px] font-medium text-[#7a68a0]
                      tabular-nums dark:text-[#bcaed6]"
                  >
                    {partial.paidLabel} paid · {partial.leftLabel} left
                  </p>
                </div>
              ) : null}
              {note ? (
                <p
                  className="mt-1 line-clamp-2 text-xs text-slate-500
                    dark:text-slate-400"
                >
                  {note}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2 self-start pt-0.5">
              {isNext && state === "pending" ? (
                <span
                  className="text-[11px] font-bold text-sky-700
                    dark:text-sky-300"
                >
                  next
                </span>
              ) : STATE_LABEL[state] ? (
                <span
                  className={cn("text-[11px] font-bold", LABEL_TONE[state])}
                >
                  {STATE_LABEL[state]}
                </span>
              ) : null}
              <ScheduleCheckbox scheduleId={scheduleId} />
              {hasExpand && !isEditing ? (
                <ChevronDown
                  className={cn(
                    "size-4 text-slate-400 transition-transform duration-300",
                    open && "rotate-180",
                  )}
                />
              ) : null}
            </div>
          </div>

          {hasExpand ? (
            <AnimatePresence initial={false}>
              {open ? (
                <m.div
                  initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 px-3 pt-1 pb-3">
                    {actions}
                    {history}
                  </div>
                </m.div>
              ) : null}
            </AnimatePresence>
          ) : null}
        </m.div>
      </div>
    </m.li>
  );
}
