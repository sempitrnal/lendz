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
} from "framer-motion";
import { ChevronDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScheduleSelection } from "@/components/schedule-selection-provider";
import { ScheduleCheckbox } from "@/components/schedule-checkbox";
import { CalendarTile } from "@/components/calendar-tile";

export type ScheduleState = "paid" | "partial" | "overdue" | "pending";

/** Row, calendar tile and status chip colours, one set per state. */
const STATE_STYLES: Record<
  ScheduleState,
  { row: string; tileBand: string; tile: string; chip: string }
> = {
  paid: {
    row: "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20",
    tileBand:
      "bg-emerald-200 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
    tile: "border-emerald-200 dark:border-emerald-900/50",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  },
  partial: {
    row: "border-[#e6def2] bg-[#f6f2fb] dark:border-[#3b3449] dark:bg-[#251f2e]",
    tileBand:
      "bg-[#e3d9f3] text-[#5f4d85] dark:bg-[#3b3449] dark:text-[#d8caf0]",
    tile: "border-[#e6def2] dark:border-[#3b3449]",
    chip: "bg-[#ece5f7] text-[#7a68a0] dark:bg-[#322a44] dark:text-[#bcaed6]",
  },
  overdue: {
    row: "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20",
    tileBand:
      "bg-rose-200 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100",
    tile: "border-rose-200 dark:border-rose-900/50",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  },
  pending: {
    row: "border-slate-200 bg-white dark:border-border dark:bg-card",
    tileBand:
      "bg-yellow-200 text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-100",
    tile: "border-yellow-200 dark:border-yellow-900/50",
    chip: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
  },
};

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
}: ScheduleTimelineItemProps) {
  const { isEditing, isSelected, toggleId } = useScheduleSelection();
  const selected = isSelected(scheduleId);
  const [open, setOpen] = useState(defaultOpen ?? isNext);
  const reduceMotion = useReducedMotion();
  const styles = STATE_STYLES[state];

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
      className="relative"
    >
      {onDelete ? (
        <m.div
          style={{ opacity: actionOpacity }}
          className="absolute top-0 right-0 flex w-14 justify-end pt-3"
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
            animate={confirming && !reduceMotion ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 0.25 }}
            aria-label={confirming ? "Confirm delete" : "Delete schedule"}
            className={cn(
              `flex size-14 flex-col items-center justify-center gap-0.5
                rounded-2xl border text-[9px] font-black tracking-wide uppercase
                shadow-sm transition-colors duration-200`,
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
          `relative overflow-hidden rounded-2xl border transition-colors
          duration-200`,
          isNext
            ? `border-2 border-sky-300 bg-sky-50/50 dark:border-sky-700
              dark:bg-sky-950/20`
            : styles.row,
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
            "flex items-center gap-3 px-3.5 py-3",
            (isEditing || hasExpand) && "cursor-pointer",
          )}
        >
          <CalendarTile
            date={dueDate}
            className={cn("self-start", styles.tile)}
            bandClassName={styles.tileBand}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className="text-lg leading-tight font-black tracking-tight
                  text-[#556477] tabular-nums dark:text-foreground"
              >
                {amountLabel}
              </p>
              {isNext && (
                <span
                  className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px]
                    font-black tracking-wide text-sky-800 uppercase
                    dark:bg-sky-900/50 dark:text-sky-200"
                >
                  next
                </span>
              )}
            </div>
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
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-white/70
                    dark:bg-white/10"
                >
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

          <div className="flex shrink-0 flex-col items-end gap-1.5 self-start">
            <span
              className={cn(
                `rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide
                uppercase`,
                styles.chip,
              )}
            >
              {state}
            </span>
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
                <div
                  className="space-y-3 border-t border-black/5 px-3.5 py-3
                    dark:border-white/10"
                >
                  {actions}
                  {history}
                </div>
              </m.div>
            ) : null}
          </AnimatePresence>
        ) : null}
      </m.div>
    </m.li>
  );
}
