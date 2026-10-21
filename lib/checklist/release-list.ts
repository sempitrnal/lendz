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
 * Where creating an account from a release item stands on this screen:
 * - "creating": the form's Create was pressed and hasn't finished.
 * - "created": the form said the account was made (saved, or queued offline).
 * No mark means idle.
 */
export type CreateMark = "creating" | "created";
export type CreateMarks = ReadonlyMap<string, CreateMark>;

/**
 * - "submit": Create was pressed (idle → creating; nothing else changes).
 * - "success": the form's onSuccess (→ created, from any state).
 * - "idle": the form is back to idle without success, e.g. an error or a
 *   failed validation (creating → idle; created stays).
 */
export type CreateEvent = { type: "submit" | "success" | "idle"; id: string };

/** idle → creating → created | idle. Returns `marks` itself when nothing changes. */
export function reduceCreateMarks(
  marks: CreateMarks,
  event: CreateEvent,
): CreateMarks {
  const current = marks.get(event.id);
  let next: CreateMark | undefined = current;
  if (event.type === "submit") next = current ?? "creating";
  else if (event.type === "success") next = "created";
  else if (current === "creating") next = undefined;
  if (next === current) return marks;
  const out = new Map(marks);
  if (next) out.set(event.id, next);
  else out.delete(event.id);
  return out;
}

/** The create sheet can't be closed (or checked off) while Create runs. */
export const canLeaveCreate = (mark: CreateMark | undefined) =>
  mark !== "creating";

/**
 * What a release row offers:
 * - "plain": the note doesn't read as a release (or is a collection); no button.
 * - "created": the item is ticked (an account was made, or it was checked off).
 * - "creating": Create is running for it; a disabled "Creating…".
 * - "check-off": an account was made from it here but the item isn't ticked
 *   (the tick failed, or it was unticked since), so it offers to check it
 *   off, never to create a second one.
 * - "create": a parsed release not yet turned into an account.
 */
export type ReleaseRowState =
  | "plain"
  | "created"
  | "creating"
  | "check-off"
  | "create";

export function releaseRowState(
  view: ReleaseRowView,
  /** This item's create mark on this screen, if any. */
  mark: CreateMark | undefined,
): ReleaseRowState {
  if (!releaseOf(view)) return "plain";
  if (view.created) return "created";
  if (mark === "created") return "check-off";
  if (mark === "creating") return "creating";
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

/**
 * The toast after ticking the item the form created an account from, or null
 * when the tick saved. `accountQueued`: the account itself was only queued
 * offline (the form has said so), so this never claims it exists.
 */
export function tickAfterCreateText(
  outcome: "saved" | "queued" | "failed",
  accountQueued: boolean,
): string | null {
  if (outcome === "saved") return null;
  if (outcome === "queued") {
    return "Checked off on this device; it syncs when you're back online.";
  }
  return accountQueued
    ? "The item couldn't be checked off. Tap Check off to try again."
    : "Account created, but the item couldn't be checked off. Tap Check off to try again.";
}

/** The toast after "Check off without account". */
export const checkedOffWithoutAccountText = (name: string) =>
  `${name} checked off without an account`;
