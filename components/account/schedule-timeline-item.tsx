"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScheduleSelection } from "@/components/schedule-selection-provider";
import { ScheduleCheckbox } from "@/components/schedule-checkbox";

export type ScheduleTimelineItemProps = {
  scheduleId: string;
  id?: string;
  index: number;
  isNext: boolean;
  isLast: boolean;
  statusBadge: string;
  statusDot: string;
  statusRing: string;
  statusLabel: string;
  amountLabel: string;
  statusIcon?: React.ReactNode;
  rollingInterestLabel?: string;
  dateLabel: string;
  dateTone?: "slate" | "emerald" | "amber";
  partial?: { paidLabel: string; leftLabel: string; pct: number };
  note?: string | null;
  actions?: React.ReactNode;
  history?: React.ReactNode;
};

const dateToneClasses: Record<
  NonNullable<ScheduleTimelineItemProps["dateTone"]>,
  string
> = {
  slate: "text-slate-600 dark:text-slate-300",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
};

export function ScheduleTimelineItem({
  scheduleId,
  id,
  index,
  isNext,
  isLast,
  statusBadge,
  statusDot,
  statusRing,
  statusLabel,
  amountLabel,
  statusIcon,
  rollingInterestLabel,
  dateLabel,
  dateTone = "slate",
  partial,
  note,
  actions,
  history,
}: ScheduleTimelineItemProps) {
  const { isEditing, isSelected, toggleId } = useScheduleSelection();
  const selected = isSelected(scheduleId);
  const [open, setOpen] = useState(isNext);

  const hasExpand = Boolean(actions || history);

  function handleTap() {
    if (isEditing) {
      toggleId(scheduleId);
      return;
    }
    if (hasExpand) setOpen((v) => !v);
  }

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      id={id}
      className={cn("relative pl-10 xl:pl-0", isNext && "z-10")}
    >
      <div
        className={cn(
          `absolute left-0 top-6 size-5 rounded-full border-4 border-white
          dark:border-slate-950 xl:hidden`,
          statusDot,
          isNext && "ring-4",
          isNext && statusRing,
        )}
      />
      {!isLast && (
        <div
          className={`absolute left-2.5 top-11 h-full w-px bg-slate-200
          dark:bg-slate-800 xl:hidden`}
        />
      )}

      <div
        className={cn(
          "rounded-2xl border bg-white shadow-sm transition dark:bg-slate-900",
          isNext
            ? "border-sky-300 shadow-md dark:border-sky-700"
            : "border-slate-200 dark:border-slate-800",
          selected && "ring-2 ring-cyan-400 dark:ring-cyan-500",
        )}
      >
        <div
          onClick={handleTap}
          className={cn(
            "flex items-start justify-between gap-3 px-4 py-4",
            (isEditing || hasExpand) && "cursor-pointer",
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="text-[11px] font-bold tracking-wide text-slate-400"
              >
                #{index + 1}
              </span>
              {isNext && (
                <span
                  className={`rounded-full bg-sky-100 px-2 py-0.5 text-[9px]
                  font-bold uppercase text-sky-700 dark:bg-sky-800/50
                  dark:text-sky-300`}
                >
                  Next
                </span>
              )}
              <span
                className={cn(
                  `ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold
                  uppercase tracking-wide`,
                  statusBadge,
                )}
              >
                {statusLabel}
              </span>
              <ScheduleCheckbox scheduleId={scheduleId} />
            </div>

            <div className="mt-1.5 flex items-baseline gap-2">
              <p
                className="text-2xl font-extrabold tracking-tight text-slate-900
                  tabular-nums dark:text-slate-100"
              >
                {amountLabel}
              </p>
              {statusIcon}
            </div>

            {rollingInterestLabel ? (
              <p
                className="text-[10px] text-slate-400 tabular-nums
                  dark:text-slate-500"
              >
                {rollingInterestLabel}
              </p>
            ) : null}

            <div
              className="mt-1.5 flex items-center gap-1.5 text-xs font-medium
                text-slate-500 dark:text-slate-400"
            >
              <CalendarClock className="size-3.5 shrink-0" />
              <span className={cn("font-semibold", dateToneClasses[dateTone])}>
                {dateLabel}
              </span>
            </div>

            {partial ? (
              <div className="mt-3">
                <div
                  className="flex justify-between text-[10px] font-bold
                    uppercase tracking-wide text-slate-400"
                >
                  <span>Paid {partial.paidLabel}</span>
                  <span>Left {partial.leftLabel}</span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full
                    bg-slate-200 dark:bg-slate-700"
                >
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all
                      duration-500"
                    style={{ width: `${partial.pct}%` }}
                  />
                </div>
              </div>
            ) : null}

            {note ? (
              <p
                className="mt-2 line-clamp-2 text-xs text-slate-500
                  dark:text-slate-400"
              >
                {note}
              </p>
            ) : null}
          </div>

          {hasExpand && !isEditing ? (
            <ChevronDown
              className={cn(
                "mt-1 size-4 shrink-0 text-slate-400 transition-transform",
                open && "rotate-180",
              )}
            />
          ) : null}
        </div>

        {hasExpand ? (
          <AnimatePresence initial={false}>
            {open ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div
                  className="space-y-3 border-t border-slate-200 px-4 py-4
                    dark:border-slate-800"
                >
                  {actions}
                  {history}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        ) : null}
      </div>
    </motion.li>
  );
}
