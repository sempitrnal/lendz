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

/** When a schedule was paid: one payment as "paid nov 12 ₱520", several as a list. */
export function PaymentHistory({
  payments,
  dueDate,
}: {
  payments?: SchedulePayment[];
  /** The schedule's due date, to say how early or late each payment was. */
  dueDate: string;
}) {
  if (!payments || payments.length === 0) return null;
  return (
    <p
      className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px]
        font-semibold text-muted-foreground/80"
    >
      <span className="font-bold">
        {payments.length > 1 ? "payments" : "paid"}
      </span>
      {payments.map((p, i) => (
        <span key={i} className="tabular-nums">
          {i > 0 && "· "}
          {p.payment_date
            ? paidDay(p.payment_date, (d) => formatShortDate(d).toLowerCase())
            : "no date"}{" "}
          {peso(p.amount)}
          {p.payment_date && (
            <PaymentTiming due={dueDate} paid={p.payment_date} />
          )}
        </span>
      ))}
    </p>
  );
}
