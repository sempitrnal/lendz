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
  currentYear: number
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
  termMonths: number
): number {
  const interest = interestRatePercent / 100;
  const total =
    (principal * interest * termMonths + principal) / (termMonths * 2);
  return Number(total.toFixed(2));
}

/**
 * Produces exactly `2 * termMonths` due dates (two per month for `termMonths` months),
 * matching the original generator.
 */
export function generateLegacyBimonthlyDueDates(
  startDate: Date,
  termMonths: number
): Date[] {
  const dates: Date[] = [];

  const day = startDate.getDate();
  let currentYear = startDate.getFullYear();
  let currentMonth = startDate.getMonth();

  let payroll1 = computePayroll1(day, currentMonth);
  let payroll2 = computePayroll2(payroll1, currentMonth, currentYear);

  const monthChecker = day === payroll2;

  dates.push(new Date(startDate));
  if (monthChecker) {
    currentMonth++;
  }
  dates.push(
    new Date(
      currentYear,
      currentMonth,
      monthChecker ? payroll1 : payroll2
    )
  );
  if (!monthChecker) {
    let temp = currentMonth;
    currentMonth = (currentMonth % 12) + 1;
    if (temp === 12) {
      currentYear++;
    }
  }

  for (let i = 0; i < termMonths - 1; i++) {
    if (day <= 15) {
      payroll1 = day;
    } else if (currentMonth === 1) {
      if (day === 28) {
        payroll1 = day - 13;
      } else if (day === 29) {
        payroll1 = day - 14;
      } else {
        payroll1 = day - 15;
      }
    } else if (day === 28) {
      payroll1 = day - 13;
    } else {
      payroll1 = day - 15;
    }

    if (payroll1 <= 15) {
      if (currentMonth === 1) {
        if (payroll1 === 15) {
          payroll2 = isLeapYear(currentYear) ? 29 : 28;
        } else {
          payroll2 = payroll1 + 15;
        }
      } else {
        payroll2 = payroll1 + 15;
      }
    } else {
      payroll2 = payroll1;
    }

    dates.push(
      new Date(
        currentYear,
        currentMonth,
        monthChecker ? payroll2 : payroll1
      )
    );
    if (monthChecker) {
      let temp = currentMonth;
      currentMonth = (currentMonth % 12) + 1;
      if (temp === 12) {
        currentYear++;
      }
    }
    dates.push(
      new Date(
        currentYear,
        currentMonth,
        monthChecker ? payroll1 : payroll2
      )
    );
    if (!monthChecker) {
      let temp = currentMonth;
      currentMonth = (currentMonth % 12) + 1;
      if (temp === 12) {
        currentYear++;
      }
    }
  }

  return dates;
}
