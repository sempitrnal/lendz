"use client";

import { useMemo, type ReactNode } from "react";
import { Check } from "lucide-react";
import {
  PaymentSchedules,
  type PaymentScheduleItem,
} from "@/components/components-2/dashboard/payment-schedules";
import { ScheduleSelectionProvider } from "@/components/schedule-selection-provider";
import { ScheduleCheckbox } from "@/components/schedule-checkbox";
import { ScheduleEditBar } from "@/components/schedule-edit-bar";
import ScheduleStatusForm from "@/components/schedule-status-form";
import { ScheduleDeleteButton } from "@/components/schedule-delete-button";
import PartialPaymentForm from "@/components/partial-payment-form";
import PaymentHistoryPanel, {
  type SchedulePayment,
} from "@/components/payment-history-panel";
import BatchScheduleToolbar, {
  type PaidDateStrategy,
} from "@/components/batch-schedule-toolbar";
import AddSchedulesPanel from "@/components/add-schedules-panel";
import { formatDate } from "@/lib/utils";
import {
  amountPaidOnInstallment,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";

type ScheduleRow = {
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

interface AccountPaymentSchedulesProps {
  accountId: string;
  borrowerId?: string;
  schedules: ScheduleRow[];
  paymentsMap: Record<string, SchedulePayment[]>;
  isManual: boolean;
  isRolling: boolean;
  interestRate: number;
  progressPct: number;
  progressLabel?: string;
  focusScheduleId?: string;
  updateScheduleStatus: (formData: FormData) => Promise<void>;
  batchUpdateScheduleStatus: (
    ids: string[],
    strategy: PaidDateStrategy,
    customDate?: string,
  ) => Promise<void>;
  applyPartialPayment: (formData: FormData) => Promise<void>;
  updatePaymentEntry: (formData: FormData) => Promise<void>;
  deletePaymentEntry: (formData: FormData) => Promise<void>;
  deleteSchedule: (scheduleId: string) => Promise<void>;
  addSchedules: (
    rows: { due_date: string; amount_due: number; note?: string }[],
  ) => Promise<{ error?: string }>;
  children?: ReactNode;
}

function formatMoney(value: number) {
  return `₱${value.toLocaleString("en-US")}`;
}

export function AccountPaymentSchedules({
  accountId,
  borrowerId,
  schedules,
  paymentsMap,
  isManual,
  isRolling,
  interestRate,
  progressPct,
  progressLabel,
  focusScheduleId,
  updateScheduleStatus,
  batchUpdateScheduleStatus,
  applyPartialPayment,
  updatePaymentEntry,
  deletePaymentEntry,
  deleteSchedule,
  addSchedules,
  children,
}: AccountPaymentSchedulesProps) {
  const nextDue = useMemo(
    () => schedules.find((s) => remainingOnInstallment(s) > 0),
    [schedules],
  );

  const nextNumber = useMemo(() => {
    const index = schedules.findIndex((s) => s.status === "pending");
    return index >= 0 ? index + 1 : null;
  }, [schedules]);

  const items: PaymentScheduleItem[] = useMemo(
    () =>
      schedules.map((s, i) => ({
        id: s.id,
        number: i + 1,
        amount: Math.max(0, Number(s.amount_due ?? 0)),
        dueDate: formatDate(s.due_date),
        status: s.status as PaymentScheduleItem["status"],
        paid: amountPaidOnInstallment(s),
        remaining: remainingOnInstallment(s),
        paidDate: s.paid_date,
        note: s.note,
      })),
    [schedules],
  );

  const allIds = useMemo(() => schedules.map((s) => s.id), [schedules]);

  return (
    <ScheduleSelectionProvider>
      <PaymentSchedules
        title="Payment schedules"
        nextDueDate={nextDue ? formatDate(nextDue.due_date) : null}
        nextDueAmount={nextDue ? remainingOnInstallment(nextDue) : undefined}
        progress={progressPct}
        progressLabel={progressLabel ?? (isManual ? "Recovered" : "Progress")}
        nextNumber={nextNumber}
        schedules={items}
        renderCardHeaderRight={(schedule) =>
          schedule.id ? <ScheduleCheckbox scheduleId={schedule.id} /> : null
        }
        renderCardActions={(schedule) => {
          const s = schedules.find((x) => x.id === schedule.id);
          if (!s) return null;
          return (
            <>
              <ScheduleStatusForm
                scheduleId={s.id}
                currentStatus={s.status}
                dueDate={s.due_date}
                updateScheduleStatus={updateScheduleStatus}
                isRollingManual={isRolling}
                applyPartialPayment={applyPartialPayment}
                borrowerId={borrowerId}
              />
              <ScheduleDeleteButton
                scheduleId={s.id}
                deleteSchedule={deleteSchedule}
              />
            </>
          );
        }}
        renderCardExtras={(schedule) => {
          const s = schedules.find((x) => x.id === schedule.id);
          if (!s) return null;

          const due = Math.max(0, Number(s.amount_due ?? 0));
          const hasHistory =
            s.status === "partial" && (paymentsMap[s.id] ?? []).length > 0;

          const paidDiffDays =
            s.paid_date && s.paid_date !== s.due_date
              ? Math.round(
                  (new Date(s.paid_date).getTime() -
                    new Date(s.due_date).getTime()) /
                    86400000,
                )
              : null;

          return (
            <>
              {isRolling && interestRate > 0 && (
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {(() => {
                    const base =
                      Math.round((due / (1 + interestRate / 100)) * 100) / 100;
                    const interest = Math.round((due - base) * 100) / 100;
                    return (
                      <>
                        {formatMoney(base)} + {interestRate}% (+
                        {formatMoney(interest)})
                      </>
                    );
                  })()}
                </p>
              )}

              {s.status === "paid" ? (
                s.paid_date && s.paid_date !== s.due_date ? (
                  <p
                    className={`mt-0.5 text-sm font-semibold ${
                      paidDiffDays !== null && paidDiffDays < 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                      }`}
                  >
                    {formatDate(s.paid_date)}
                    {paidDiffDays !== null && (
                      <span
                        className="ml-1.5 text-[11px] font-semibold opacity-70"
                      >
                        ·{" "}
                        {paidDiffDays > 0
                          ? `${paidDiffDays} day${paidDiffDays === 1 ? "" : "s"} late`
                          : `${Math.abs(paidDiffDays)} day${Math.abs(paidDiffDays) === 1 ? "" : "s"} early`}
                      </span>
                    )}
                  </p>
                ) : (
                  <p
                    className="mt-0.5 flex items-center gap-1 text-sm
                      font-semibold text-muted-foreground"
                  >
                    {formatDate(s.due_date)}
                    <Check
                      className="size-3 text-emerald-600 dark:text-emerald-400"
                    />
                  </p>
                )
              ) : null}

              {s.note ? (
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {s.note}
                </p>
              ) : null}

              {s.status === "partial" && !isRolling && (
                <PartialPaymentForm
                  scheduleId={s.id}
                  applyPartialPayment={applyPartialPayment}
                  autoFocus={focusScheduleId === s.id}
                  dueDate={s.due_date}
                  borrowerId={borrowerId}
                />
              )}

              {hasHistory && (
                <PaymentHistoryPanel
                  payments={paymentsMap[s.id] ?? []}
                  updatePayment={updatePaymentEntry}
                  deletePayment={deletePaymentEntry}
                />
              )}
            </>
          );
        }}
      >
        <ScheduleEditBar allIds={allIds} />
        {isManual && (
          <AddSchedulesPanel
            accountId={accountId}
            addSchedules={addSchedules}
          />
        )}
        {children}
      </PaymentSchedules>

      <BatchScheduleToolbar
        allIds={allIds}
        onBatchPaid={batchUpdateScheduleStatus}
        borrowerId={borrowerId}
      />
    </ScheduleSelectionProvider>
  );
}
