import type { DailyChecklistItem } from "@/lib/checklist/types";

/** Display order of a day: `sort_order` ascending, then newest first. */
export function sortDayItems(
  items: DailyChecklistItem[],
): DailyChecklistItem[] {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return b.created_at.localeCompare(a.created_at);
  });
}

/**
 * Sort orders for rows added to the day: each category's new rows go above
 * everything already in it (below the category's lowest `sort_order`, or 0),
 * keeping the order they were given in.
 */
export function newRowSortOrders(
  existing: DailyChecklistItem[],
  rows: { categoryId: string | null }[],
): number[] {
  const total = new Map<string | null, number>();
  for (const row of rows) {
    total.set(row.categoryId, (total.get(row.categoryId) ?? 0) + 1);
  }
  const seen = new Map<string | null, number>();
  return rows.map((row) => {
    const min = existing
      .filter((i) => i.category_id === row.categoryId)
      .reduce((m, i) => Math.min(m, i.sort_order), 0);
    const idx = seen.get(row.categoryId) ?? 0;
    seen.set(row.categoryId, idx + 1);
    return min - (total.get(row.categoryId) ?? 0) + idx;
  });
}

/**
 * Ids of rows already shown whose content differs in `fetched` (a change made
 * elsewhere), leaving out `exclude` (rows with this screen's own writes still
 * in flight or queued). New and removed rows are not counted.
 */
export function changedShownIds(
  shown: DailyChecklistItem[],
  fetched: DailyChecklistItem[],
  exclude: ReadonlySet<string>,
): string[] {
  const byId = new Map(shown.map((row) => [row.id, row]));
  return fetched
    .filter((next) => {
      const prev = byId.get(next.id);
      if (!prev || exclude.has(next.id)) return false;
      return (
        prev.label !== next.label ||
        prev.is_checked !== next.is_checked ||
        Number(prev.sort_order) !== Number(next.sort_order) ||
        (prev.category_id ?? null) !== (next.category_id ?? null)
      );
    })
    .map((row) => row.id);
}
