"use client";

import { paidDay } from "@/lib/paid-day";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/checklist/labels";
import { paymentTiming } from "@/lib/checklist/late-label";
import type { SchedulePayment } from "@/components/dashboard/checklist-v2/use-schedule-payments";

const peso = (n: number) =>
  `₱${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** "1d early", "2d late" or "on time", beside a payment. */
function PaymentTiming({ due, paid }: { due: string; paid: string }) {
  const { text, tone } = paymentTiming(due, paid);
  return (
    <span
      className={cn(
        "ml-1",
        tone === "late" && "text-rose-600 dark:text-rose-400",
        tone === "early" && "text-emerald-600 dark:text-emerald-400",
      )}
    >
      {text}
    </span>
  );
}

/**
 * When a schedule was paid. One payment stays a single quiet line ("paid nov
 * 12 · 1d early ₱520"); several become a short stacked list, one payment per
 * line with the amounts lined up on the right and the total on top.
 */
export function PaymentHistory({
  payments,
  dueDate,
}: {
  payments?: SchedulePayment[];
  /** The schedule's due date, to say how early or late each payment was. */
  dueDate: string;
}) {
  if (!payments || payments.length === 0) return null;
  const day = (p: SchedulePayment) =>
    p.payment_date
      ? paidDay(p.payment_date, (d) => formatShortDate(d).toLowerCase())
      : "no date";

  if (payments.length === 1) {
    const [p] = payments;
    return (
      <p
        className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px]
          font-semibold text-muted-foreground/80"
      >
        <span className="tabular-nums">
          {day(p)}
          {p.payment_date && (
            <PaymentTiming due={dueDate} paid={p.payment_date} />
          )}
        </span>
        <span className="font-bold text-card-foreground/70 tabular-nums">
          {peso(p.amount)}
        </span>
      </p>
    );
  }

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  return (
    <div
      className="mt-1 rounded-lg bg-muted/50 px-2 py-1 text-[10px] font-semibold
        text-muted-foreground/80"
    >
      <p className="flex items-center justify-between gap-2 font-bold">
        <span>{payments.length} payments</span>
        <span className="tabular-nums">{peso(total)}</span>
      </p>
      <ul className="mt-0.5 divide-y divide-border/50">
        {payments.map((p, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-2 py-0.5"
          >
            <span className="min-w-0 tabular-nums">
              {day(p)}
              {p.payment_date && (
                <PaymentTiming due={dueDate} paid={p.payment_date} />
              )}
            </span>
            <span
              className="shrink-0 font-bold text-card-foreground/70
                tabular-nums"
            >
              {peso(p.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
