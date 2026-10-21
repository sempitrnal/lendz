import type { AccountSummary } from "@/lib/checklist/schedule-cache";

/**
 * Manual accounts (schedules added by hand, flat or rolling) can't be taken
 * back from the checklist: a rolling payment rolls what's left into a new
 * schedule that a reset doesn't remove, and a flat payment's schedule is the
 * payment itself, so resetting it would turn it into money owed. Edits and
 * Undo on them are sent to the account page instead.
 */

/** Whether a summary is a manual account's (its type label says so). */
export function isManualSummary(
  summary: Pick<AccountSummary, "typeLabel"> | null | undefined,
): boolean {
  return !!summary && /(^|\s)manual(\s|$)/.test(summary.typeLabel);
}

/**
 * Whether the checklist must not reset or lower payments on `accountIds`:
 * some account is manual, or its summary is unknown (not loaded, or failed),
 * so it might be. No accounts: nothing to protect.
 */
export function blocksPaymentChanges(
  accountIds: string[],
  summaries: Record<string, Pick<AccountSummary, "typeLabel">> | null | undefined,
): boolean {
  return accountIds.some((id) => {
    const summary = summaries?.[id];
    return !summary || isManualSummary(summary);
  });
}

/** Shown where an edit or Undo is held back for a manual account. */
export const MANUAL_ACCOUNT_POINTER =
  "Manual account — change its payments on the account page";

/** Shown when the account type couldn't be checked, so changes are held back too. */
export const UNCHECKED_ACCOUNT_POINTER =
  "Couldn't check the account — change its payments on the account page";

/** The line the edit sheet and toasts show when changes are held back. */
export function heldBackPointer(
  accountIds: string[],
  summaries: Record<string, Pick<AccountSummary, "typeLabel">> | null | undefined,
): string | null {
  if (!blocksPaymentChanges(accountIds, summaries)) return null;
  return accountIds.some((id) => isManualSummary(summaries?.[id]))
    ? MANUAL_ACCOUNT_POINTER
    : UNCHECKED_ACCOUNT_POINTER;
}
