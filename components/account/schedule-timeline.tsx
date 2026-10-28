"use client";

import {
  Fragment,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { triggerHaptic } from "@/lib/haptics";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import {
  CalendarClock,
  ChartPie,
  CircleCheck,
  ChevronDown,
  Clock,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  amountPaidOnInstallment,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import type { ScheduleOptimisticAction } from "./schedule-optimistic";
import { formatDate } from "@/lib/utils";
import { daysBetween, todayDateValue } from "@/lib/checklist/dates";
import PartialPaymentForm from "@/components/partial-payment-form";
import ScheduleStatusForm from "@/components/schedule-status-form";
import PaymentHistoryPanel from "@/components/payment-history-panel";
import type { SchedulePayment } from "@/components/payment-history-panel";
import { ScheduleDeleteButton } from "@/components/schedule-delete-button";
import { useScheduleSelection } from "@/components/schedule-selection-provider";
import {
  ScheduleTimelineItem,
  type ScheduleState,
} from "./schedule-timeline-item";

function formatMoney(value: number) {
  return `₱${value.toLocaleString()}`;
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
  if (action.type === "delete") {
    return {
      ...state,
      schedules: state.schedules.filter((s) => s.id !== action.scheduleId),
    };
  }

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

/** Upcoming installments shown before "show more". */
const UPCOMING_PREVIEW = 3;

function SectionHead({
  icon: Icon,
  label,
  count,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  badge: string;
}) {
  return (
    <div className="mt-6 mb-2.5 flex items-center gap-2.5 first:mt-0">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1
          text-xs font-bold ring-1 ring-inset ${badge}`}
      >
        <Icon className="size-3.5" aria-hidden />
        {label}
      </span>
      {count != null && (
        <span
          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold
            text-slate-500 tabular-nums dark:bg-white/10 dark:text-slate-400"
        >
          {count}
        </span>
      )}
      <span className="h-px flex-1 bg-slate-200/80 dark:bg-border" />
    </div>
  );
}

/** A thin year marker between rows where the list crosses into another year. */
function YearDivider({ year }: { year: string }) {
  return (
    <li
      aria-label={year}
      className="flex items-center gap-2.5 py-1 text-[11px] font-bold
        text-slate-400 dark:text-slate-500"
    >
      <span className="h-px flex-1 bg-slate-200 dark:bg-border" />
      <span className="tabular-nums">{year}</span>
      <span className="h-px flex-1 bg-slate-200 dark:bg-border" />
    </li>
  );
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
  updateScheduleStatus: (formData: FormData) => Promise<void>;
  applyPartialPayment: (formData: FormData) => Promise<void>;
  deleteSchedule: (scheduleId: string) => Promise<void>;
  updatePaymentEntry: (formData: FormData) => Promise<void>;
  deletePaymentEntry: (formData: FormData) => Promise<void>;
}) {
  const [optimistic, addOptimistic] = useOptimistic(
    { schedules, paymentsMap },
    scheduleOptimisticReducer,
  );
  const { isEditing } = useScheduleSelection();
  const reduceMotion = useReducedMotion();
  const [, startDelete] = useTransition();
  const all = optimistic.schedules;

  /** Swipe-to-delete: the row leaves at once, the server catches up. */
  function handleDelete(scheduleId: string) {
    startDelete(async () => {
      addOptimistic({ type: "delete", scheduleId });
      try {
        await deleteSchedule(scheduleId);
        triggerHaptic("success");
        toast.success("Schedule deleted");
      } catch {
        triggerHaptic("error");
        toast.error("Failed to delete schedule");
      }
    });
  }
  const total = all.length;
  const nextIndex = all.findIndex(
    (s) => s.status === "pending" || s.status === "overdue",
  );
  const today = todayDateValue();

  const { paidRows, partialRows, overdueRows, nextRow, upcomingRows } =
    useMemo(() => {
      const indexed = all.map((s, i) => ({ s, i }));
      return {
        paidRows: indexed.filter((x) => x.s.status === "paid"),
        partialRows: indexed.filter((x) => x.s.status === "partial"),
        overdueRows: indexed.filter(
          (x) => x.s.status === "overdue" && x.i !== nextIndex,
        ),
        nextRow: nextIndex >= 0 ? indexed[nextIndex] : null,
        upcomingRows: indexed.filter(
          (x) =>
            x.s.status !== "paid" &&
            x.s.status !== "partial" &&
            x.s.status !== "overdue" &&
            x.i !== nextIndex,
        ),
      };
    }, [all, nextIndex]);
  const hasFocus = (rows: typeof paidRows) =>
    rows.some((x) => x.s.id === focusScheduleId);

  // Paid rows tuck away unless that's all there is (or one is being focused).
  const [paidOpen, setPaidOpen] = useState(
    () =>
      hasFocus(paidRows) ||
      (paidRows.length > 0 &&
        partialRows.length + overdueRows.length + upcomingRows.length === 0 &&
        !nextRow),
  );
  const [upcomingAll, setUpcomingAll] = useState(() =>
    hasFocus(upcomingRows.slice(UPCOMING_PREVIEW)),
  );
  const showAllUpcoming = upcomingAll || isEditing;
  const visibleUpcoming = showAllUpcoming
    ? upcomingRows
    : upcomingRows.slice(0, UPCOMING_PREVIEW);

  function renderItem(schedule: PaymentScheduleRow, i: number) {
    const state = schedule.status as ScheduleState;
    const isNext = i === nextIndex;
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
            return `${formatMoney(base)} + ${interestRate}% (+${formatMoney(interest)})`;
          })()
        : undefined;

    let subLabel: string;
    let subTone: "slate" | "emerald" | "amber" | "rose" = "slate";
    if (schedule.status === "paid") {
      const paidOn = schedule.paid_date ?? schedule.due_date;
      subLabel = `paid ${formatDate(paidOn)}`;
      subTone = "emerald";
      if (schedule.paid_date && schedule.paid_date !== schedule.due_date) {
        const diff = daysBetween(schedule.due_date, schedule.paid_date);
        const n = Math.abs(diff);
        subLabel += ` · ${n} day${n === 1 ? "" : "s"} ${diff > 0 ? "late" : "early"}`;
        if (diff > 0) subTone = "amber";
      }
    } else {
      const until = daysBetween(today, schedule.due_date);
      if (until < 0) {
        const n = -until;
        subLabel = `${n} day${n === 1 ? "" : "s"} overdue`;
        subTone = "rose";
      } else if (until === 0) {
        subLabel = "due today";
      } else {
        subLabel = `due in ${until} day${until === 1 ? "" : "s"}`;
      }
    }

    const actions = (
      <div className="grid grid-cols-[1fr_auto] items-start gap-2">
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
      (!isRolling || (optimistic.paymentsMap[schedule.id] ?? []).length > 0) ? (
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
                (optimistic.paymentsMap[schedule.id] ?? []) as SchedulePayment[]
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
        number={i + 1}
        total={total}
        isNext={isNext}
        defaultOpen={isNext || focusScheduleId === schedule.id}
        state={state}
        dueDate={schedule.due_date}
        amountLabel={formatMoney(due)}
        subLabel={subLabel}
        subTone={subTone}
        rollingInterestLabel={rollingInterestLabel}
        partial={
          schedule.status === "partial"
            ? {
                paidLabel: formatMoney(paid),
                leftLabel: formatMoney(remaining),
                pct,
              }
            : undefined
        }
        note={schedule.note}
        actions={actions}
        history={history}
        onDelete={() => handleDelete(schedule.id)}
      />
    );
  }

  /** Rows in order, with a year divider wherever the year changes (or the list starts outside this year). */
  function renderRows(rows: { s: PaymentScheduleRow; i: number }[]) {
    return rows.map((x, k) => {
      const year = x.s.due_date.slice(0, 4);
      const before =
        k > 0 ? rows[k - 1].s.due_date.slice(0, 4) : today.slice(0, 4);
      return (
        <Fragment key={x.s.id}>
          {year !== before && <YearDivider year={year} />}
          {renderItem(x.s, x.i)}
        </Fragment>
      );
    });
  }

  const paidTotal = paidRows.reduce(
    (sum, x) => sum + amountPaidOnInstallment(x.s),
    0,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      {paidRows.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setPaidOpen((v) => !v)}
            aria-expanded={paidOpen}
            className="flex w-full items-center gap-3 rounded-2xl border
              border-emerald-200/80 bg-emerald-50/70 px-3.5 py-3 text-left
              transition-colors hover:bg-emerald-50 dark:border-emerald-900/40
              dark:bg-emerald-950/20"
          >
            <span
              className="flex size-9 shrink-0 items-center justify-center
                rounded-full bg-emerald-500 text-white"
            >
              <CircleCheck className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-sm font-black text-emerald-800
                  dark:text-emerald-200"
              >
                {paidRows.length} paid
              </span>
              <span
                className="block truncate text-[11px] text-emerald-700/80
                  dark:text-emerald-300/70"
              >
                {paidRows[0].s.due_date ===
                paidRows[paidRows.length - 1].s.due_date
                  ? formatDate(paidRows[0].s.due_date)
                  : `${formatDate(paidRows[0].s.due_date)} to ${formatDate(
                      paidRows[paidRows.length - 1].s.due_date,
                    )}`}
              </span>
            </span>
            <span
              className="text-sm font-black text-emerald-700 tabular-nums
                dark:text-emerald-300"
            >
              {formatMoney(paidTotal)}
            </span>
            <ChevronDown
              className={`size-4 shrink-0 text-emerald-600/70
              transition-transform duration-300 ${
                paidOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          <AnimatePresence initial={false}>
            {paidOpen && (
              <m.ul
                initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-2">{renderRows(paidRows)}</div>
              </m.ul>
            )}
          </AnimatePresence>
        </>
      )}

      {partialRows.length > 0 && (
        <>
          <SectionHead
            icon={ChartPie}
            label="in progress"
            count={partialRows.length}
            badge="bg-[#f6f2fb] text-[#7a68a0] ring-[#e6def2] dark:bg-[#251f2e] dark:text-[#bcaed6] dark:ring-[#3b3449]"
          />
          <ul className="space-y-2">{renderRows(partialRows)}</ul>
        </>
      )}

      {overdueRows.length > 0 && (
        <>
          <SectionHead
            icon={TriangleAlert}
            label="overdue"
            count={overdueRows.length}
            badge="bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-100 dark:ring-rose-800"
          />
          <ul className="space-y-2">{renderRows(overdueRows)}</ul>
        </>
      )}

      {nextRow && (
        <>
          <SectionHead
            icon={CalendarClock}
            label="next up"
            badge="bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-900/40 dark:text-sky-100 dark:ring-sky-800"
          />
          <ul>{renderItem(nextRow.s, nextRow.i)}</ul>
        </>
      )}

      {upcomingRows.length > 0 && (
        <>
          <SectionHead
            icon={Clock}
            label="upcoming"
            count={upcomingRows.length}
            badge="bg-yellow-100 text-yellow-800 ring-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-100 dark:ring-yellow-800"
          />
          <ul className="space-y-2">{renderRows(visibleUpcoming)}</ul>
          {!showAllUpcoming && upcomingRows.length > UPCOMING_PREVIEW && (
            <button
              type="button"
              onClick={() => setUpcomingAll(true)}
              className="mt-2 flex w-full items-center justify-center gap-1.5
                rounded-xl py-2 text-xs font-bold text-slate-500 transition
                hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/5"
            >
              show {upcomingRows.length - UPCOMING_PREVIEW} more
              <ChevronDown className="size-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
