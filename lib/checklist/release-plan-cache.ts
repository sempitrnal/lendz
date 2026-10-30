import type { MonthKey } from "@/lib/checklist/release-plan";
import type { DailyChecklistItem } from "@/lib/checklist/types";

/**
 * What the release planner keeps on the device: each month's releases (shown
 * at once on the next visit, and offline) and the custom days added by hand.
 * Storage can be full, blocked or gone; every read and write survives that.
 */

const planKey = (month: MonthKey) => `release-plan:month:${month}`;
const DATES_KEY = "release-plan:custom-dates";

export function readCachedPlan(month: MonthKey): DailyChecklistItem[] | null {
  try {
    const raw = window.localStorage.getItem(planKey(month));
    const value: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(value) ? (value as DailyChecklistItem[]) : null;
  } catch {
    return null;
  }
}

export function writeCachedPlan(month: MonthKey, items: DailyChecklistItem[]) {
  try {
    window.localStorage.setItem(planKey(month), JSON.stringify(items));
  } catch {
    // Full or blocked: the next visit loads from the server instead.
  }
}

export function readCustomDates(): string[] {
  try {
    const raw = window.localStorage.getItem(DATES_KEY);
    const value: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(value)
      ? value.filter(
          (d): d is string =>
            typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d),
        )
      : [];
  } catch {
    return [];
  }
}

export function saveCustomDates(dates: string[]) {
  try {
    window.localStorage.setItem(DATES_KEY, JSON.stringify(dates));
  } catch {
    // Kept for this visit only.
  }
}
