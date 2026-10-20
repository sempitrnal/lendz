/**
 * Texts and rules for the Collect list menu ("⋯"): Populate due, Undo
 * populate, Clear all and Mark all paid.
 */

/** Unpaid schedules carry over onto the checklist for this many days. */
export const CARRY_OVER_DAYS = 7;

export const NOTHING_NEW_TO_ADD =
  "Nothing new to add — everyone due or carried over is already listed";

export const NOTHING_TO_UNDO_POPULATE =
  "Nothing to undo — items were already changed or removed";

/** Added to a toast whose write was queued offline. */
export const QUEUED_SUFFIX = " · will sync when online";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** "Added 3 borrowers" / "Added 1 borrower". */
export const addedBorrowersText = (n: number) =>
  `Added ${plural(n, "borrower", "borrowers")}`;

/** "Marked 3 collections paid" / "Marked 1 collection paid". */
export const markedPaidText = (n: number) =>
  `Marked ${plural(n, "collection", "collections")} paid`;

/** "Cleared 3 items" / "Cleared 1 item". */
export const clearedItemsText = (n: number) =>
  `Cleared ${plural(n, "item", "items")}`;

/** The due-collections URL for a day (that day and the 7 days before). */
export const dueGroupsUrl = (date: string) =>
  `/api/checklist/due?date=${date}&back=${CARRY_OVER_DAYS}`;

/** Why the due collections couldn't be loaded (the old widget's wording). */
export const dueGroupsErrorText = (online: boolean) =>
  online
    ? "Failed to load due collections"
    : "Due collections for this day aren't saved offline — reconnect to populate";

/**
 * Undo populate takes back only the rows still as populate left them: same
 * label and not ticked. Rows edited or ticked since are kept; rows already
 * gone are neither removed nor kept.
 */
export function planUndoPopulate(
  populated: { id: string; label: string }[],
  current: { id: string; label: string; is_checked: boolean }[],
): { removeIds: string[]; kept: number } {
  const byId = new Map(current.map((i) => [i.id, i]));
  const removeIds: string[] = [];
  let kept = 0;
  for (const row of populated) {
    const item = byId.get(row.id);
    if (!item) continue;
    if (item.label === row.label && !item.is_checked) removeIds.push(row.id);
    else kept += 1;
  }
  return { removeIds, kept };
}

/** "Removed 3 items (1 kept — edited or ticked)". */
export const undoPopulateText = (removed: number, kept: number) =>
  `Removed ${plural(removed, "item", "items")}${
    kept > 0 ? ` (${kept} kept — edited or ticked)` : ""
  }`;
