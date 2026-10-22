import type { RowView } from "@/lib/checklist/row-state";

/**
 * The `created_at` the 6 AM auto-populate gives its rows: exactly 6:00:00 AM
 * Philippine time (UTC+8) on that day. Rows added by hand carry the real
 * time they were made, so this is how the screen tells the two apart without
 * a database column.
 */
export function autoPopulateStamp(date: string): string {
  return new Date(`${date}T06:00:00+08:00`).toISOString();
}

export type AutoPopulateSummary = {
  added: number;
  /** Added rows with something due on the day. */
  dueToday: RowView[];
  /** Added rows that are only from earlier days. */
  carried: RowView[];
  /** What is still to collect on all of them. */
  left: number;
};

/** What the day's 6 AM run added, or null when it added nothing. */
export function summarizeAutoPopulate(
  rows: RowView[],
  date: string,
): AutoPopulateSummary | null {
  const stamp = new Date(autoPopulateStamp(date)).getTime();
  const added = rows.filter(
    (r) =>
      r.model !== null &&
      r.item.checklist_date.slice(0, 10) === date &&
      new Date(r.item.created_at).getTime() === stamp,
  );
  if (added.length === 0) return null;
  const left = added.reduce((sum, r) => sum + r.left, 0);
  return {
    added: added.length,
    dueToday: added.filter((r) => !r.carried),
    carried: added.filter((r) => r.carried),
    left: Math.round(left * 100) / 100,
  };
}

/** The device remembers it has shown a day's summary under this key. */
export const summarySeenKey = (date: string) =>
  `lendz-populate-summary-seen:${date}`;
