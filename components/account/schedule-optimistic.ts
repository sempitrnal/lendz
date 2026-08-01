import type { SchedulePayment } from "@/components/payment-history-panel";

export type ScheduleOptimisticAction =
  | {
      type: "status";
      scheduleId: string;
      status: string;
      paid_date?: string | null;
    }
  | {
      type: "payment";
      scheduleId: string;
      payment: SchedulePayment;
    };
