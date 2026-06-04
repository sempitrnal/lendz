/**
 * Legacy bimonthly payroll schedule (Philippine-style 15th / end-of-month style anchors).
 * Ported from the original app logic; keeps the same date progression and edge cases.
 */

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function computePayroll1(day: number, currentMonth: number): number {
  if (day <= 15) {
    return day;
  }

  if (currentMonth === 1) {
    if (day === 28) {
      return day - 13;
    }
    if (day === 29) {
      return day - 14;
    }
    return day - 15;
  }

  if (day === 28) {
    return day - 13;
  }
  return day - 15;
}

function computePayroll2(
  payroll1: number,
  currentMonth: number,
  currentYear: number,
): number {
  if (payroll1 <= 15) {
    if (currentMonth === 1) {
      if (payroll1 === 15) {
        return isLeapYear(currentYear) ? 29 : 28;
      }
      return payroll1 + 15;
    }
    return payroll1 + 15;
  }
  return payroll1;
}

/**
 * Per-installment amount: (principal + linear interest over term) / (2 payments per month × months).
 * `interestRatePercent` is the annual-style percent from the form (e.g. 5 for 5%).
 */
export function bimonthlyLegacyInstallmentAmount(
  principal: number,
  interestRatePercent: number,
  termMonths: number,
): number {
  const interest = interestRatePercent / 100;
  const total =
    (principal * interest * termMonths + principal) / (termMonths * 2);
  return Number(total.toFixed(2));
}

/**
 * Produces exactly `2 * termMonths` due dates (two per month for `termMonths` months).
 * First date is always exactly the startDate (user's first_payment_date).
 * Subsequent dates follow the 15th/30th payroll pattern.
 */
export function generateLegacyBimonthlyDueDates(
  startDate: Date,
  termMonths: number,
): Date[] {
  const dates: Date[] = [];

  // First date is exactly what the user entered
  dates.push(new Date(startDate));

  let currentYear = startDate.getFullYear();
  let currentMonth = startDate.getMonth();
  const day = startDate.getDate();

  // Determine the next date pattern
  // If first date is on or before 15th, next is 15th of same month
  // If first date is after 15th, next is 15th of NEXT month
  let use15thNext = true;
  if (day > 15) {
    // Move to next month for the 15th
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
  } else {
    // First date is on or before 15th, so next should be end of same month
    use15thNext = false;
  }

  // Generate remaining dates in alternating 15th/30th pattern
  for (let i = 0; i < termMonths * 2 - 1; i++) {
    if (use15thNext) {
      dates.push(new Date(currentYear, currentMonth, 15));
      use15thNext = false;
    } else {
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      dates.push(new Date(currentYear, currentMonth, daysInMonth));
      use15thNext = true;
      // After end of month, move to next month
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
    }
  }

  return dates;
}
