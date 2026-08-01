"use client";

import { useOptimistic } from "react";
import {
  amountPaidOnInstallment,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import type { ScheduleOptimisticAction } from "./schedule-optimistic";
import { formatDate } from "@/lib/utils";
import PartialPaymentForm from "@/components/partial-payment-form";
import ScheduleStatusForm from "@/components/schedule-status-form";
import PaymentHistoryPanel from "@/components/payment-history-panel";
import type { SchedulePayment } from "@/components/payment-history-panel";
import { ScheduleDeleteButton } from "@/components/schedule-delete-button";
import PaidCheck from "@/components/paid-check";
import OverdueSad from "@/components/overdue-sad";
import PartialPie from "@/components/partial-pie";
import { ScheduleTimelineItem } from "./schedule-timeline-item";

function formatMoney(value: number) {
  return `₱${value.toLocaleString()}`;
}

function getScheduleStatusClasses(status: string) {
  if (status === "paid") {
    return {
      badge:
        "border-emerald-600/80 bg-emerald-50 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-400/[0.18] dark:text-emerald-300",
      dot: "bg-emerald-500 dark:bg-emerald-400",
      ring: "ring-emerald-200 dark:ring-emerald-400/30",
    };
  }
  if (status === "partial") {
    return {
      badge:
        "border-violet-600/80 bg-violet-50 text-violet-950 dark:border-violet-400/40 dark:bg-violet-400/[0.18] dark:text-violet-300",
      dot: "bg-violet-500 dark:bg-violet-400",
      ring: "ring-violet-200 dark:ring-violet-400/30",
    };
  }
  if (status === "overdue") {
    return {
      badge:
        "border-rose-600/80 bg-rose-50 text-rose-900 dark:border-rose-400/40 dark:bg-rose-400/[0.18] dark:text-rose-300",
      dot: "bg-rose-500 dark:bg-rose-400",
      ring: "ring-rose-200 dark:ring-rose-400/30",
    };
  }
  return {
    badge:
      "border-amber-600/80 bg-amber-50 text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/[0.18] dark:text-amber-300",
    dot: "bg-amber-500 dark:bg-amber-400",
    ring: "ring-amber-200 dark:ring-amber-400/30",
  };
}

type PaymentScheduleRow = {
  id: string;
  account_id: string;
  due_date: string;
  amount_due: number | null;
  amount_paid: number | null;
  remaining_amount: number | null;
  note: string | null;
  paid_date: string | null;
  status: string;
};

type OptimisticState = {
  schedules: PaymentScheduleRow[];
  paymentsMap: Record<string, SchedulePayment[]>;
};

function scheduleOptimisticReducer(
  state: OptimisticState,
  action: ScheduleOptimisticAction,
): OptimisticState {
  if (action.type === "status") {
    return {
      ...state,
      schedules: state.schedules.map((s) => {
        if (s.id !== action.scheduleId) return s;
        const due = Number(s.amount_due ?? 0);
        if (action.status === "paid") {
          return {
            ...s,
            status: "paid",
            paid_date: action.paid_date ?? s.paid_date,
            amount_paid: due,
            remaining_amount: 0,
          };
        }
        if (action.status === "pending" || action.status === "overdue") {
          return {
            ...s,
            status: action.status,
            paid_date: null,
            amount_paid: 0,
            remaining_amount: due,
          };
        }
        return { ...s, status: action.status };
      }),
    };
  }

  return {
    schedules: state.schedules.map((s) => {
      if (s.id !== action.scheduleId) return s;
      const due = Number(s.amount_due ?? 0);
      const paid = Number(s.amount_paid ?? 0) + action.payment.amount;
      const remaining = Math.max(0, due - paid);
      const status = remaining <= 0 ? "paid" : "partial";
      return {
        ...s,
        amount_paid: paid,
        remaining_amount: remaining,
        status,
        paid_date:
          status === "paid" ? action.payment.payment_date : s.paid_date,
      };
    }),
    paymentsMap: {
      ...state.paymentsMap,
      [action.scheduleId]: [
        ...(state.paymentsMap[action.scheduleId] ?? []),
        action.payment,
      ],
    },
  };
}

export function ScheduleTimeline({
  schedules,
  paymentsMap,
  isRolling,
  interestRate,
  focusScheduleId,
  borrowerId,
  updateScheduleStatus,
  applyPartialPayment,
  deleteSchedule,
  updatePaymentEntry,
  deletePaymentEntry,
}: {
  schedules: PaymentScheduleRow[];
  paymentsMap: Record<string, SchedulePayment[]>;
  isRolling: boolean;
  interestRate: number;
  focusScheduleId?: string;
  borrowerId?: string;
  updateScheduleStatus: any;
  applyPartialPayment: any;
  deleteSchedule: any;
  updatePaymentEntry: any;
  deletePaymentEntry: any;
}) {
  const [optimistic, addOptimistic] = useOptimistic(
    { schedules, paymentsMap },
    scheduleOptimisticReducer,
  );
  const nextIndex = optimistic.schedules.findIndex(
    (s) => s.status === "pending" || s.status === "overdue",
  );

  return (
    <ul className="mx-auto max-w-3xl space-y-4 px-4 py-4">
      {optimistic.schedules.map((schedule, i) => {
        const st = getScheduleStatusClasses(schedule.status);
        const isNext = i === nextIndex;
        const paidDiffDays =
          schedule.paid_date && schedule.paid_date !== schedule.due_date
            ? Math.round(
                (new Date(schedule.paid_date).getTime() -
                  new Date(schedule.due_date).getTime()) /
                  86400000,
              )
            : null;
        const paid = amountPaidOnInstallment(schedule);
        const due = Number(schedule.amount_due ?? 0);
        const remaining = remainingOnInstallment(schedule);
        const pct = due > 0 ? Math.min(100, Math.round((paid / due) * 100)) : 0;

        const rollingInterestLabel =
          isRolling && interestRate > 0
            ? (() => {
                const base =
                  Math.round((due / (1 + interestRate / 100)) * 100) / 100;
                const interest = Math.round((due - base) * 100) / 100;
                return `${formatMoney(base)} + ${interestRate}% (+${formatMoney(
                  interest,
                )})`;
              })()
            : undefined;

        let dateLabel = formatDate(schedule.due_date);
        let dateTone: "slate" | "emerald" | "amber" = "slate";
        if (schedule.status === "paid") {
          if (schedule.paid_date && schedule.paid_date !== schedule.due_date) {
            dateLabel = `Paid ${formatDate(schedule.paid_date)}`;
            if (paidDiffDays !== null) {
              dateLabel += ` · ${
                paidDiffDays > 0
                  ? `${paidDiffDays} day${paidDiffDays === 1 ? "" : "s"} late`
                  : `${Math.abs(paidDiffDays)} day${Math.abs(paidDiffDays) === 1 ? "" : "s"} early`
              }`;
            }
            dateTone =
              paidDiffDays !== null && paidDiffDays < 0 ? "emerald" : "amber";
          } else {
            dateLabel = `Paid ${formatDate(schedule.due_date)}`;
            dateTone = "emerald";
          }
        }

        const partial =
          schedule.status === "partial"
            ? {
                paidLabel: formatMoney(paid),
                leftLabel: formatMoney(remaining),
                pct,
              }
            : undefined;

        const statusIcon =
          schedule.status === "paid" ? (
            <PaidCheck />
          ) : schedule.status === "partial" ? (
            <PartialPie progress={pct} />
          ) : schedule.status === "overdue" ? (
            <OverdueSad />
          ) : null;

        const actions = (
          <div className="flex flex-wrap items-center gap-2">
            <ScheduleStatusForm
              scheduleId={schedule.id}
              currentStatus={schedule.status}
              dueDate={schedule.due_date}
              updateScheduleStatus={updateScheduleStatus}
              isRollingManual={isRolling}
              applyPartialPayment={applyPartialPayment}
              borrowerId={borrowerId}
              onOptimisticUpdate={addOptimistic}
            />
            <ScheduleDeleteButton
              scheduleId={schedule.id}
              deleteSchedule={deleteSchedule}
            />
          </div>
        );

        const history =
          schedule.status === "partial" &&
          (!isRolling ||
            (optimistic.paymentsMap[schedule.id] ?? []).length > 0) ? (
            <div className="space-y-3">
              {!isRolling ? (
                <PartialPaymentForm
                  scheduleId={schedule.id}
                  applyPartialPayment={applyPartialPayment}
                  autoFocus={focusScheduleId === schedule.id}
                  dueDate={schedule.due_date}
                  borrowerId={borrowerId}
                  onOptimisticUpdate={addOptimistic}
                />
              ) : null}
              {(optimistic.paymentsMap[schedule.id] ?? []).length > 0 ? (
                <PaymentHistoryPanel
                  payments={
                    (optimistic.paymentsMap[schedule.id] ??
                      []) as SchedulePayment[]
                  }
                  updatePayment={updatePaymentEntry}
                  deletePayment={deletePaymentEntry}
                />
              ) : null}
            </div>
          ) : undefined;

        return (
          <ScheduleTimelineItem
            key={schedule.id}
            scheduleId={schedule.id}
            id={isNext ? "next-schedule" : undefined}
            index={i}
            isNext={isNext || focusScheduleId === schedule.id}
            isLast={i === schedules.length - 1}
            statusBadge={st.badge}
            statusDot={st.dot}
            statusRing={st.ring}
            statusLabel={schedule.status}
            amountLabel={formatMoney(due)}
            statusIcon={statusIcon}
            rollingInterestLabel={rollingInterestLabel}
            dateLabel={dateLabel}
            dateTone={dateTone}
            partial={partial}
            note={schedule.note}
            actions={actions}
            history={history}
          />
        );
      })}
    </ul>
  );
}
