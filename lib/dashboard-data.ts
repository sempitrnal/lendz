export interface DashboardSummary {
  activeBorrowers: number;
  activeBorrowersDelta: number;
  duesToday: number;
  duesTodaySchedules: number;
  avgMonthlyProfit: number;
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
  collected: number;
  remaining: number;
}

export interface MonthlyProfit {
  month: string;
  short: string;
  actual: number;
  expected: number;
  percent: number;
}

export function formatPeso(value: number): string {
  return `₱${Math.round(value).toLocaleString()}`;
}
