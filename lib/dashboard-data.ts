export interface DashboardSummary {
  outstanding: number;
  /** Interest still to be collected, part of `outstanding`. */
  outstandingProfit: number;
  /** Principal still to be collected: `outstanding` minus the profit. */
  outstandingPrincipal: number;
  activeLoans: number;
  overdue: number;
  overdueSchedules: number;
  overdueBorrowers: number;
  duesToday: number;
  duesTodaySchedules: number;
  avgMonthlyProfit: number;
  avgMonthlyProfitMonths: number;
  activeBorrowers: number;
  activeBorrowersDelta: number;
}

export interface CurrentMonthData {
  label: string;
  toCollectThisMonth: number;
  toCollectSoFar: number;
  collected: number;
  meme: number;
  expectedProfit: number;
  remainingProfit: number;
}

export interface ProfitCategoryItem {
  id?: string;
  name: string;
  color?: string | null;
  profit: number;
  collectedProfit: number;
  remainingProfit: number;
}

export interface MonthlyProfit {
  key: string;
  month: string;
  short: string;
  actual: number;
  expected: number;
  percent: number;
  collected: number;
  due: number;
  released: number;
  releasedCount: number;
  isCurrent: boolean;
  isFuture: boolean;
}

export interface CashFlowWeek {
  label: string;
  range: string;
  expected: number;
  count: number;
}

export interface OverdueBucket {
  label: string;
  amount: number;
  count: number;
}

export interface OverdueBorrower {
  id: string;
  name: string;
  amount: number;
  oldestDaysLate: number;
}

export function formatPeso(value: number): string {
  return `₱${Math.round(value).toLocaleString()}`;
}

export function formatPesoCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `₱${Math.round(value / 1_000)}k`;
  return `₱${Math.round(value)}`;
}
