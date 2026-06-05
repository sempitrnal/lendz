import {
  generateLegacyBimonthlyDueDates,
  countSkippedBimonthlySchedules,
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
  release_date?: string;
  calculate_skipped_schedules?: boolean;
};

export function countSkippedSchedules(
  releaseDateStr: string,
  firstPaymentDateStr: string,
  paymentFrequency: "weekly" | "monthly" | "bimonthly" | "custom",
): number {
  const release = parseDateInput(releaseDateStr);
  const firstPayment = parseDateInput(firstPaymentDateStr);

  if (paymentFrequency === "bimonthly" || paymentFrequency === "custom") {
    return countSkippedBimonthlySchedules(release, firstPayment);
  }

  if (paymentFrequency === "weekly") {
    let current = new Date(release);
    current.setDate(current.getDate() + 7);

    if (firstPayment <= current) return 0;

    let count = 0;
    while (current < firstPayment) {
      count++;
      current.setDate(current.getDate() + 7);
    }
    return count;
  }

  // monthly
  let current = new Date(
    release.getFullYear(),
    release.getMonth(),
    release.getDate(),
  );
  const nextMonth = current.getMonth() + 1;
  const nextYear = current.getFullYear() + (nextMonth > 11 ? 1 : 0);
  const nextMonthIndex = nextMonth % 12;
  const daysInNextMonth = new Date(nextYear, nextMonthIndex + 1, 0).getDate();
  const nextDay = Math.min(current.getDate(), daysInNextMonth);
  current = new Date(nextYear, nextMonthIndex, nextDay);

  if (firstPayment <= current) return 0;

  let count = 0;
  while (current < firstPayment) {
    count++;
    const nm = current.getMonth() + 1;
    const ny = current.getFullYear() + (nm > 11 ? 1 : 0);
    const nmi = nm % 12;
    const dim = new Date(ny, nmi + 1, 0).getDate();
    const nd = Math.min(current.getDate(), dim);
    current = new Date(ny, nmi, nd);
  }
  return count;
}

export function hasSkippedSchedules(
  releaseDateStr: string,
  firstPaymentDateStr: string,
  paymentFrequency: "weekly" | "monthly" | "bimonthly" | "custom",
): boolean {
  return (
    countSkippedSchedules(
      releaseDateStr,
      firstPaymentDateStr,
      paymentFrequency,
    ) > 0
  );
}

function computeTimeBasedScheduleAmount(
  principal: number,
  interestRate: number,
  termMonths: number,
  totalSchedules: number,
  releaseDateStr: string | undefined,
  firstPaymentDateStr: string,
  paymentFrequency: "weekly" | "monthly" | "bimonthly" | "custom",
  calculateSkipped = true,
): number {
  if (totalSchedules <= 0) return 0;

  const monthlyInterest = principal * (interestRate / 100);
  const baseInterest = monthlyInterest * termMonths;
  let extraInterest = 0;

  if (calculateSkipped && releaseDateStr && firstPaymentDateStr) {
    const skippedCount = countSkippedSchedules(
      releaseDateStr,
      firstPaymentDateStr,
      paymentFrequency,
    );
    if (skippedCount > 0) {
      const dailyInterest = monthlyInterest / 30;
      const periodDays =
        paymentFrequency === "bimonthly" || paymentFrequency === "custom"
          ? 15
          : paymentFrequency === "monthly"
            ? 30
            : 7;
      extraInterest = dailyInterest * periodDays * skippedCount;
    }
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
      values.payment_frequency,
      values.calculate_skipped_schedules,
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
        values.payment_frequency,
        values.calculate_skipped_schedules,
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
        values.payment_frequency,
        values.calculate_skipped_schedules,
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
