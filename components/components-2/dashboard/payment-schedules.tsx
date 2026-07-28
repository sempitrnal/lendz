"use client";

import { useMemo, type ReactNode } from "react";
import { CalendarClock, Check, Frown, PieChart, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/dashboard-data";

export type ScheduleStatus = "pending" | "paid" | "overdue" | "partial";

export const scheduleStatuses: ScheduleStatus[] = [
  "pending",
  "paid",
  "overdue",
  "partial",
];

export interface PaymentScheduleItem {
  id?: string;
  number: number;
  amount: number;
  dueDate: string;
  status: ScheduleStatus;
  paid?: number;
  remaining?: number;
  paidDate?: string | null;
  note?: string | null;
}

export type PaymentSchedule = PaymentScheduleItem;

interface PaymentSchedulesProps {
  title?: string;
  titleId?: string;
  nextDueDate?: string | null;
  nextDueAmount?: number;
  progressLabel?: string;
  progress?: number;
  nextNumber?: number | null;
  schedules: PaymentScheduleItem[];
  onStatusChange?: (number: number, status: ScheduleStatus) => void;
  onEdit?: () => void;
  renderCardHeaderRight?: (schedule: PaymentScheduleItem) => ReactNode;
  renderCardActions?: (schedule: PaymentScheduleItem) => ReactNode;
  renderCardExtras?: (schedule: PaymentScheduleItem) => ReactNode;
  readOnly?: boolean;
  children?: ReactNode;
  className?: string;
}

type StatusStyle = {
  row: string;
  badge: string;
  button: string;
};

const statusStyles: Record<ScheduleStatus, StatusStyle> = {
  pending: {
    row: "border-border bg-card",
    badge:
      "border-amber-600/40 bg-amber-500/10 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-300",
    button:
      "border-amber-600/50 bg-amber-500 text-white dark:border-amber-400/50 dark:bg-amber-400 dark:text-amber-950",
  },
  paid: {
    row: "border-emerald-600/30 bg-emerald-500/[0.08] dark:border-emerald-400/25 dark:bg-emerald-400/10",
    badge:
      "border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-300",
    button:
      "border-emerald-600/50 bg-emerald-600 text-white dark:border-emerald-400/50 dark:bg-emerald-500 dark:text-white",
  },
  overdue: {
    row: "border-rose-600/30 bg-rose-500/[0.08] dark:border-rose-400/25 dark:bg-rose-400/10",
    badge:
      "border-rose-600/40 bg-rose-500/10 text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/15 dark:text-rose-300",
    button:
      "border-rose-600/50 bg-rose-600 text-white dark:border-rose-400/50 dark:bg-rose-500 dark:text-white",
  },
  partial: {
    row: "border-violet-600/30 bg-violet-500/[0.08] dark:border-violet-400/25 dark:bg-violet-400/10",
    badge:
      "border-violet-600/40 bg-violet-500/10 text-violet-700 dark:border-violet-400/40 dark:bg-violet-400/15 dark:text-violet-300",
    button:
      "border-violet-600/50 bg-violet-600 text-white dark:border-violet-400/50 dark:bg-violet-500 dark:text-white",
  },
};

function StatusIcon({ status }: { status: ScheduleStatus }) {
  if (status === "paid")
    return (
      <Check
        className="size-5 text-emerald-600 dark:text-emerald-400"
        aria-hidden="true"
      />
    );
  if (status === "overdue")
    return (
      <Frown
        className="size-5 text-rose-600 dark:text-rose-400"
        aria-hidden="true"
      />
    );
  if (status === "partial")
    return (
      <PieChart
        className="size-5 text-violet-600 dark:text-violet-400"
        aria-hidden="true"
      />
    );
  return null;
}

export function PaymentSchedules({
  title = "Payment schedules",
  titleId = "schedule-heading",
  nextDueDate,
  nextDueAmount,
  progressLabel = "Progress",
  progress,
  nextNumber: nextNumberProp,
  schedules,
  onStatusChange,
  onEdit,
  renderCardHeaderRight,
  renderCardActions,
  renderCardExtras,
  readOnly,
  children,
  className,
}: PaymentSchedulesProps) {
  const computedProgress = useMemo(() => {
    if (typeof progress === "number") return progress;
    const paidCount = schedules.filter((s) => s.status === "paid").length;
    const partialCount = schedules.filter((s) => s.status === "partial").length;
    return schedules.length === 0
      ? 0
      : Math.round(((paidCount + partialCount * 0.5) / schedules.length) * 100);
  }, [progress, schedules]);

  const nextNumber = useMemo(() => {
    if (nextNumberProp !== undefined) return nextNumberProp;
    const next = schedules.find((s) => s.status !== "paid");
    return next?.number ?? null;
  }, [nextNumberProp, schedules]);

  function setStatus(number: number, status: ScheduleStatus) {
    onStatusChange?.(number, status);
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-5 sm:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex size-11 items-center justify-center rounded-xl
              bg-primary/10 text-primary"
          >
            <CalendarClock className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              {title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {nextDueDate
                ? `Next due ${nextDueDate}`
                : "All installments settled"}
              {nextDueAmount !== undefined && nextDueDate
                ? ` · ${formatPeso(nextDueAmount)}`
                : null}
            </p>
          </div>
        </div>
        {onEdit && !readOnly && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-2 rounded-lg border
              border-border px-3 py-2 text-sm font-medium text-foreground
              transition-colors hover:bg-secondary"
          >
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </button>
        )}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">{progressLabel}</span>
          <span className="text-muted-foreground">
            {computedProgress}% · {schedules.length} schedule
            {schedules.length === 1 ? "" : "s"}
          </span>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={computedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${computedProgress}%` }}
          />
        </div>
      </div>

      {children}

      <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {schedules.map((schedule) => {
          const style = statusStyles[schedule.status];
          const isNext = schedule.number === nextNumber;
          const partialPct =
            schedule.status === "partial" && schedule.amount > 0
              ? Math.min(
                  100,
                  Math.round(
                    ((schedule.paid ?? schedule.amount * 0.5) /
                      schedule.amount) *
                      100,
                  ),
                )
              : 0;
          const paidAmount =
            schedule.status === "partial"
              ? (schedule.paid ?? schedule.amount * 0.5)
              : 0;
          const remainingAmount =
            schedule.status === "partial"
              ? (schedule.remaining ?? schedule.amount - paidAmount)
              : 0;

          return (
            <li
              key={schedule.number}
              id={isNext ? "next-schedule" : undefined}
              className={cn(
                `flex flex-col rounded-xl border p-4 shadow-sm transition-colors
                duration-500`,
                style.row,
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] font-black uppercase tracking-wide
                    text-muted-foreground"
                >
                  #{schedule.number}
                </span>
                {isNext && (
                  <span
                    className="rounded-md border border-sky-500/40 bg-sky-500/10
                      px-1.5 py-0.5 text-[10px] font-bold uppercase
                      tracking-wide text-sky-600 dark:text-sky-300"
                  >
                    Next
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <span
                    className={cn(
                      `rounded-full border px-2.5 py-1 text-[10px] font-bold
                      capitalize`,
                      style.badge,
                    )}
                  >
                    {schedule.status}
                  </span>
                  {renderCardHeaderRight?.(schedule)}
                </div>
              </div>

              <div className="mt-2 flex items-baseline gap-2">
                <p
                  className="text-3xl font-black tracking-tight text-foreground
                    tabular-nums"
                >
                  {formatPeso(schedule.amount)}
                </p>
                <StatusIcon status={schedule.status} />
                <span
                  className="ml-auto text-sm font-semibold
                    text-muted-foreground"
                >
                  {schedule.dueDate}
                </span>
              </div>

              {schedule.status === "partial" && (
                <div className="mt-3">
                  <div
                    className="flex justify-between text-[10px] font-black
                      text-muted-foreground"
                  >
                    <span>Paid {formatPeso(paidAmount)}</span>
                    <span>Left {formatPeso(remainingAmount)}</span>
                  </div>
                  <div
                    className="mt-1.5 h-2.5 overflow-hidden rounded-full
                      bg-muted"
                  >
                    <div
                      className="h-full rounded-full bg-violet-500
                        transition-all duration-500 dark:bg-violet-400"
                      style={{ width: `${partialPct}%` }}
                    />
                  </div>
                </div>
              )}

              {renderCardExtras?.(schedule)}

              {(() => {
                if (readOnly) return null;
                const actions = renderCardActions?.(schedule);
                return renderCardActions ? (
                  actions ? (
                    <div className="mt-4 border-t border-border pt-4">
                      <div className="flex flex-wrap items-start gap-2">
                        {actions}
                      </div>
                    </div>
                  ) : null
                ) : (
                  <div className="mt-4 border-t border-border pt-4">
                    <div className="grid grid-cols-2 gap-2">
                      {scheduleStatuses.map((status) => {
                        const isActive = schedule.status === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setStatus(schedule.number, status)}
                            aria-pressed={isActive}
                            className={cn(
                              "rounded-lg border px-2.5 py-1.5 text-xs font-bold capitalize transition-colors",
                              isActive
                                ? statusStyles[status].button
                                : "border-border bg-secondary text-secondary-foreground hover:bg-muted",
                            )}
                          >
                            {status}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
