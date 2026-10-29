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
import { CircleCheck, ChevronDown } from "lucide-react";
import { HIDDEN_AMOUNT, useHideAmounts } from "@/lib/hide-amounts";
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

/** A thin year marker between rows where the list crosses into another year. */
function YearDivider({ year }: { year: string }) {
  return (
    <li
      aria-label={year}
      className="flex items-center gap-2.5 py-1 pl-9 text-[11px] font-bold
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
  const [hide] = useHideAmounts();
  const mask = (text: string) => (hide ? HIDDEN_AMOUNT : text);
  const total = all.length;
  // "Next up" is the first pending schedule; overdue ones have their own section.
  const nextIndex = all.findIndex((s) => s.status === "pending");
  const today = todayDateValue();

  // The rail runs in schedule order. Paid ones fold into one line at its top;
  // of the rest, the ones that need you (in progress, overdue, next) always
  // show, and only a long tail of plain upcoming ones waits behind "show more".
  const { paidRows, openRows, upcomingRows } = useMemo(() => {
    const indexed = all.map((s, i) => ({ s, i }));
    const open = indexed.filter((x) => x.s.status !== "paid");
    return {
      paidRows: indexed.filter((x) => x.s.status === "paid"),
      openRows: open,
      upcomingRows: open.filter(
        (x) =>
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
    () => hasFocus(paidRows) || (paidRows.length > 0 && openRows.length === 0),
  );
  const [upcomingAll, setUpcomingAll] = useState(() =>
    hasFocus(upcomingRows.slice(UPCOMING_PREVIEW)),
  );
  const showAllUpcoming = upcomingAll || isEditing;
  const hiddenIds = new Set(
    showAllUpcoming
      ? []
      : upcomingRows.slice(UPCOMING_PREVIEW).map((x) => x.s.id),
  );
  const visibleOpen = openRows.filter((x) => !hiddenIds.has(x.s.id));
  // The first one that needs you opens by itself, with its buttons showing.
  const firstOpenId = openRows[0]?.s.id;

  function renderItem(schedule: PaymentScheduleRow, i: number, isLast = false) {
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
            return mask(
              `${formatMoney(base)} + ${interestRate}% (+${formatMoney(interest)})`,
            );
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
        defaultOpen={
          schedule.id === firstOpenId || focusScheduleId === schedule.id
        }
        isLast={isLast}
        state={state}
        dueDate={schedule.due_date}
        amountLabel={mask(formatMoney(due))}
        subLabel={subLabel}
        subTone={subTone}
        rollingInterestLabel={rollingInterestLabel}
        partial={
          schedule.status === "partial"
            ? {
                paidLabel: mask(formatMoney(paid)),
                leftLabel: mask(formatMoney(remaining)),
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
  function renderRows(
    rows: { s: PaymentScheduleRow; i: number }[],
    lastRow: PaymentScheduleRow | null,
  ) {
    return rows.map((x, k) => {
      const year = x.s.due_date.slice(0, 4);
      const before =
        k > 0 ? rows[k - 1].s.due_date.slice(0, 4) : today.slice(0, 4);
      return (
        <Fragment key={x.s.id}>
          {year !== before && <YearDivider year={year} />}
          {renderItem(x.s, x.i, x.s === lastRow)}
        </Fragment>
      );
    });
  }

  const paidTotal = paidRows.reduce(
    (sum, x) => sum + amountPaidOnInstallment(x.s),
    0,
  );
  const hiddenCount = openRows.length - visibleOpen.length;
  // The rail ends at the last dot; a "show more" under it keeps it going.
  const lastOpen =
    hiddenCount === 0 && visibleOpen.length > 0
      ? visibleOpen[visibleOpen.length - 1].s
      : null;
  const lastPaid =
    paidOpen && visibleOpen.length === 0 && paidRows.length > 0
      ? paidRows[paidRows.length - 1].s
      : null;

  return (
    <div
      className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-black/5
        dark:ring-white/10"
    >
      <p className="px-1 pb-2 text-xs font-bold text-muted-foreground lowercase">
        payment schedule · {total} installment{total === 1 ? "" : "s"}
      </p>
      <ul>
        {paidRows.length > 0 && (
          <li className="pb-2">
            <button
              type="button"
              onClick={() => setPaidOpen((v) => !v)}
              aria-expanded={paidOpen}
              className="flex w-full items-center gap-3 rounded-2xl
                bg-emerald-50/70 px-3 py-2.5 text-left transition-colors
                hover:bg-emerald-50 dark:bg-emerald-950/20"
            >
              <span
                className="flex size-6 shrink-0 items-center justify-center
                  rounded-full bg-emerald-500 text-white"
              >
                <CircleCheck className="size-4" />
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
                {mask(formatMoney(paidTotal))}
              </span>
              <ChevronDown
                className={`size-4 shrink-0 text-emerald-600/70
                transition-transform duration-300 ${
                  paidOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </li>
        )}
        {paidOpen && renderRows(paidRows, lastPaid)}
        {renderRows(visibleOpen, lastOpen)}
        {hiddenCount > 0 && (
          <li className="pl-9">
            <button
              type="button"
              onClick={() => setUpcomingAll(true)}
              className="flex w-full items-center justify-center gap-1.5
                rounded-xl py-2 text-xs font-bold text-slate-500 transition
                hover:bg-black/5 dark:text-slate-400 dark:hover:bg-white/5"
            >
              show {hiddenCount} more
              <ChevronDown className="size-3.5" />
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
