import { generateLegacyBimonthlyDueDates } from "./bimonthly-legacy";
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
  release_date?: string;
};

function differenceInDays(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / msPerDay);
}

function computeTimeBasedScheduleAmount(
  principal: number,
  interestRate: number,
  termMonths: number,
  totalSchedules: number,
  releaseDateStr: string | undefined,
  firstPaymentDateStr: string,
): number {
  if (totalSchedules <= 0) return 0;

  const monthlyInterest = principal * (interestRate / 100);
  const baseInterest = monthlyInterest * termMonths;
  let extraInterest = 0;

  if (releaseDateStr && firstPaymentDateStr) {
    const release = parseDateInput(releaseDateStr);
    const firstPayment = parseDateInput(firstPaymentDateStr);
    const delayDays = Math.max(0, differenceInDays(firstPayment, release));
    const dailyInterest = monthlyInterest / 30;
    extraInterest = dailyInterest * delayDays;
  }

  const totalInterest = baseInterest + extraInterest;
  const totalPayable = principal + totalInterest;
  return Number((totalPayable / totalSchedules).toFixed(2));
}

export function buildSchedulesPayload(
  accountId: string,
  values: ScheduleInput,
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
    const start = parseDateInput(values.first_payment_date);
    const dueDates = generateLegacyBimonthlyDueDates(start, values.term_months);
    const scheduleAmount = computeTimeBasedScheduleAmount(
      values.principal_amount,
      values.interest_rate,
      values.term_months,
      dueDates.length,
      values.release_date,
      values.first_payment_date,
    );

    for (const d of dueDates) {
      schedules.push({
        account_id: accountId,
        due_date: formatLocalISODate(d),
        amount_due: scheduleAmount,
        amount_paid: 0,
        remaining_amount: scheduleAmount,
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
      const scheduleAmount = computeTimeBasedScheduleAmount(
        values.principal_amount,
        values.interest_rate,
        equivalentMonths,
        numberOfSchedules,
        values.release_date,
        values.first_payment_date,
      );

      const monthsNeeded = Math.ceil(numberOfSchedules / 2);
      const dueDates = generateLegacyBimonthlyDueDates(
        currentDate,
        monthsNeeded,
      );

      for (let i = 0; i < numberOfSchedules; i++) {
        schedules.push({
          account_id: accountId,
          due_date: formatLocalISODate(dueDates[i]),
          amount_due: scheduleAmount,
          amount_paid: 0,
          remaining_amount: scheduleAmount,
          status: "pending",
          note: null,
        });
      }
    } else {
      const numberOfSchedules =
        values.payment_frequency === "weekly"
          ? Math.round(values.term_months * 4)
          : Math.round(values.term_months);

      const scheduleAmount = computeTimeBasedScheduleAmount(
        values.principal_amount,
        values.interest_rate,
        values.term_months,
        numberOfSchedules,
        values.release_date,
        values.first_payment_date,
      );

      for (let i = 0; i < numberOfSchedules; i++) {
        schedules.push({
          account_id: accountId,
          due_date: formatLocalISODate(currentDate),
          amount_due: scheduleAmount,
          amount_paid: 0,
          remaining_amount: scheduleAmount,
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
