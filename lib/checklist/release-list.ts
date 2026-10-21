import { releaseParts } from "@/lib/checklist/add-sheet";
import { extractScheduleRefs } from "@/lib/checklist/labels";
import type { ParsedReleasedLabel } from "@/lib/checklist/released";
import type { ReleaseRowView } from "@/lib/checklist/release-items";

/** Pure logic behind the Release tab (`components/dashboard/checklist-v2/release-list.tsx`). */

/**
 * The release a row reads as, or null. A row that links installments
 * (`#badge:date:…|<scheduleId>`) is a collection filed under "released", not
 * a release: its amount is a payment, so it is never turned into an account.
 */
export function releaseOf(view: ReleaseRowView): ParsedReleasedLabel | null {
  if (!view.parsed) return null;
  if (extractScheduleRefs(view.item.label).length > 0) return null;
  return view.parsed;
}

/**
 * What a release row offers:
 * - "plain": the note doesn't read as a release (or is a collection); no button.
 * - "created": the item is ticked (an account was made, or it was checked off).
 * - "check-off": an account was made from it here but ticking the item
 *   failed, so it offers to check it off again, never to create a second one.
 * - "create": a parsed release not yet turned into an account.
 */
export type ReleaseRowState = "plain" | "created" | "check-off" | "create";

export function releaseRowState(
  view: ReleaseRowView,
  /** An account was created from this item on this screen. */
  createdHere: boolean,
): ReleaseRowState {
  if (!releaseOf(view)) return "plain";
  if (view.created) return "created";
  if (createdHere) return "check-off";
  return "create";
}

/**
 * The note as typed, without the borrower mention, e.g. "10,000 - 10 months
 * for 110426"; other links (badges) collapse to their text.
 */
export function releaseNote(label: string): string {
  return label
    .replace(/\[[^\]]+\]\(\/borrowers\/[^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** e.g. "₱10,000 loan · 10 months · first payment Nov 4, 2026"; null when it doesn't parse. */
export function releaseSummary(view: ReleaseRowView): string | null {
  const parsed = releaseOf(view);
  return parsed ? releaseParts(parsed).join(" · ") : null;
}

/** The tab's total: the parsed principals (collections left out), added in centavos. */
export function releaseTotal(views: ReleaseRowView[]): number {
  let centavos = 0;
  for (const v of views) {
    const principal = Number(releaseOf(v)?.initialValues.principal_amount ?? 0);
    if (Number.isFinite(principal) && principal > 0) {
      centavos += Math.round(principal * 100);
    }
  }
  return centavos / 100;
}

/** The words after the total. */
export function releasedDayText(isToday: boolean): string {
  return isToday ? "released today" : "released this day";
}

/** The toast when ticking fails after the account was created. */
export const CREATED_NOT_CHECKED_OFF =
  "Account created, but the item couldn't be checked off. Tap Check off to try again.";

/** The toast when ticking is queued offline after the account was created. */
export const CREATED_CHECK_OFF_QUEUED =
  "Account created. The item is checked off on this device and syncs when you're back online.";

/** The toast after "Check off without account". */
export const checkedOffWithoutAccountText = (name: string) =>
  `${name} checked off without an account`;
