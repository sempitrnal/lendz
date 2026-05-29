import {
  bimonthlyLegacyInstallmentAmount,
  generateLegacyBimonthlyDueDates,
} from "./bimonthly-legacy";
import { addOneMonthAnchored } from "./monthly-anchor";

function formatLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateInput(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export type ScheduleInput = {
  principal_amount: number;
  interest_rate: number;
  term_months: number;
  first_payment_date: string;
  payment_frequency: "weekly" | "monthly" | "bimonthly" | "custom";
};

export function buildSchedulesPayload(
  accountId: string,
  values: ScheduleInput
): Array<{
  account_id: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  remaining_amount: number;
  status: string;
  note: null;
}> {
  const schedules: Array<{
    account_id: string;
    due_date: string;
    amount_due: number;
    amount_paid: number;
    remaining_amount: number;
    status: string;
    note: null;
  }> = [];

  if (values.payment_frequency === "bimonthly") {
    const totalWithInterest =
      values.principal_amount * (1 + values.interest_rate / 100);
    const start = parseDateInput(values.first_payment_date);
    const dueDates = generateLegacyBimonthlyDueDates(start, values.term_months);
    const pay = bimonthlyLegacyInstallmentAmount(
      values.principal_amount,
      values.interest_rate,
      values.term_months
    );

    for (const d of dueDates) {
      schedules.push({
        account_id: accountId,
        due_date: formatLocalISODate(d),
        amount_due: pay,
        amount_paid: 0,
        remaining_amount: pay,
        status: "pending",
        note: null,
      });
    }
  } else {
    let currentDate = parseDateInput(values.first_payment_date);
    const monthlyAnchorDay = currentDate.getDate();

    const isCustom = values.payment_frequency === "custom";

    if (isCustom) {
      const numberOfSchedules = Math.round(values.term_months);
      const equivalentMonths = numberOfSchedules / 2;
      const totalInterest =
        values.principal_amount * (values.interest_rate / 100) * equivalentMonths;
      const totalPayment = values.principal_amount + totalInterest;
      const installmentAmount = Number(
        (totalPayment / numberOfSchedules).toFixed(2)
      );

      const monthsNeeded = Math.ceil(numberOfSchedules / 2);
      const dueDates = generateLegacyBimonthlyDueDates(
        currentDate,
        monthsNeeded
      );

      for (let i = 0; i < numberOfSchedules; i++) {
        schedules.push({
          account_id: accountId,
          due_date: formatLocalISODate(dueDates[i]),
          amount_due: installmentAmount,
          amount_paid: 0,
          remaining_amount: installmentAmount,
          status: "pending",
          note: null,
        });
      }
    } else {
      const numberOfSchedules =
        values.payment_frequency === "weekly"
          ? Math.round(values.term_months * 4)
          : Math.round(values.term_months);

      const totalInterest =
        values.principal_amount *
        (values.interest_rate / 100) *
        values.term_months;
      const totalPayment = values.principal_amount + totalInterest;
      const installmentAmount = totalPayment / numberOfSchedules;

      for (let i = 0; i < numberOfSchedules; i++) {
        const amt = Number(installmentAmount.toFixed(2));
        schedules.push({
          account_id: accountId,
          due_date: formatLocalISODate(currentDate),
          amount_due: amt,
          amount_paid: 0,
          remaining_amount: amt,
          status: "pending",
          note: null,
        });

        if (values.payment_frequency === "monthly") {
          currentDate = addOneMonthAnchored(currentDate, monthlyAnchorDay);
        } else if (values.payment_frequency === "weekly") {
          currentDate.setDate(currentDate.getDate() + 7);
        } else {
          currentDate = addOneMonthAnchored(currentDate, monthlyAnchorDay);
        }
      }
    }
  }

  return schedules;
}
