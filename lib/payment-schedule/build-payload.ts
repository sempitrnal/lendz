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
  release_date?: string;
};

function countSkippedSchedules(
  releaseDateStr: string | undefined,
  firstPaymentDateStr: string,
  paymentFrequency: string,
  termMonths: number,
): number {
  if (!releaseDateStr || !firstPaymentDateStr) return 0;

  const release = parseDateInput(releaseDateStr);
  const firstPayment = parseDateInput(firstPaymentDateStr);

  if (release.getTime() >= firstPayment.getTime()) return 0;

  let expectedDates: Date[] = [];
  const buffer = termMonths + 12;

  if (paymentFrequency === "bimonthly" || paymentFrequency === "custom") {
    expectedDates = generateLegacyBimonthlyDueDates(release, buffer);
  } else if (paymentFrequency === "monthly") {
    let current = new Date(release);
    for (let i = 0; i < buffer; i++) {
      current = addOneMonthAnchored(current, release.getDate());
      expectedDates.push(new Date(current));
    }
  } else if (paymentFrequency === "weekly") {
    let current = new Date(release);
    for (let i = 0; i < buffer * 2; i++) {
      current.setDate(current.getDate() + 7);
      expectedDates.push(new Date(current));
    }
  }

  return expectedDates.filter(
    (d) =>
      d.getTime() > release.getTime() && d.getTime() < firstPayment.getTime(),
  ).length;
}

function additionalPerSchedule(
  principal: number,
  interestRate: number,
  skippedSchedules: number,
  totalSchedules: number,
): number {
  if (skippedSchedules <= 0 || totalSchedules <= 0) return 0;
  const monthlyInterest = principal * (interestRate / 100);
  const additionalInterest = monthlyInterest * skippedSchedules;
  return Number((additionalInterest / totalSchedules).toFixed(2));
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

  const skipped = countSkippedSchedules(
    values.release_date,
    values.first_payment_date,
    values.payment_frequency,
    values.term_months,
  );

  if (values.payment_frequency === "bimonthly") {
    const start = parseDateInput(values.first_payment_date);
    const dueDates = generateLegacyBimonthlyDueDates(start, values.term_months);
    const pay = bimonthlyLegacyInstallmentAmount(
      values.principal_amount,
      values.interest_rate,
      values.term_months,
    );
    const addPer = additionalPerSchedule(
      values.principal_amount,
      values.interest_rate,
      skipped,
      dueDates.length,
    );
    const adjustedPay = Number((pay + addPer).toFixed(2));

    for (const d of dueDates) {
      schedules.push({
        account_id: accountId,
        due_date: formatLocalISODate(d),
        amount_due: adjustedPay,
        amount_paid: 0,
        remaining_amount: adjustedPay,
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
        values.principal_amount *
        (values.interest_rate / 100) *
        equivalentMonths;
      const totalPayment = values.principal_amount + totalInterest;
      const installmentAmount = Number(
        (totalPayment / numberOfSchedules).toFixed(2),
      );
      const addPer = additionalPerSchedule(
        values.principal_amount,
        values.interest_rate,
        skipped,
        numberOfSchedules,
      );
      const adjusted = Number((installmentAmount + addPer).toFixed(2));

      const monthsNeeded = Math.ceil(numberOfSchedules / 2);
      const dueDates = generateLegacyBimonthlyDueDates(
        currentDate,
        monthsNeeded,
      );

      for (let i = 0; i < numberOfSchedules; i++) {
        schedules.push({
          account_id: accountId,
          due_date: formatLocalISODate(dueDates[i]),
          amount_due: adjusted,
          amount_paid: 0,
          remaining_amount: adjusted,
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
      const addPer = additionalPerSchedule(
        values.principal_amount,
        values.interest_rate,
        skipped,
        numberOfSchedules,
      );
      const baseAmt = Number(installmentAmount.toFixed(2));
      const adjustedAmt = Number((baseAmt + addPer).toFixed(2));

      for (let i = 0; i < numberOfSchedules; i++) {
        schedules.push({
          account_id: accountId,
          due_date: formatLocalISODate(currentDate),
          amount_due: adjustedAmt,
          amount_paid: 0,
          remaining_amount: adjustedAmt,
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
