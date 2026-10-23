import { releaseParts } from "@/lib/checklist/add-sheet";
import { extractScheduleRefs } from "@/lib/checklist/labels";
import type { ParsedReleasedLabel } from "@/lib/checklist/released";
import type { ReleaseRowView } from "@/lib/checklist/release-items";

/** Pure logic behind the Release tab (`components/dashboard/checklist-v2/release-list.tsx`). */

/**
 * The release a row reads as, or null. A row that links installments
 * (`#badge:date:…|<scheduleId>`) is a collection filed under "released", not
 * a release: its amount is a payment, so it is never turned into an account.
 * `tabOf` already sends such rows to Collect; this guard only matters if that
 * rule is reverted, so it stays as a safety net.
 */
export function releaseOf(view: ReleaseRowView): ParsedReleasedLabel | null {
  if (!view.parsed) return null;
  if (extractScheduleRefs(view.item.label).length > 0) return null;
  return view.parsed;
}

/**
 * Where creating an account from a release item stands on this screen:
 * - "creating": the form's Create was pressed and its button is busy.
 * - "attempted": a real submit ran and ended without the form's onSuccess
 *   (yet). An account MAY exist: the form re-enables its button (its own
 *   `reset`) before its last await and `onSuccess`, and an insert can save
 *   the account and then fail on the schedules. Creating again needs an
 *   explicit "Create anyway".
 * - "created": the form said the account was made (saved, or queued offline).
 * No mark means idle.
 */
export type CreateMark = "creating" | "attempted" | "created";
export type CreateMarks = ReadonlyMap<string, CreateMark>;

/**
 * - "submit": Create was pressed (idle → creating; nothing else changes).
 * - "invalid": that press was a failed validation, nothing was sent
 *   (creating → idle).
 * - "ended": a real submit ended without success, or it can't be told
 *   (creating → attempted).
 * - "lost": the form went away while busy (creating → attempted).
 * - "confirm": the user chose "Create anyway" (attempted → idle).
 * - "success": the form's onSuccess (→ created, from any state).
 */
export type CreateEvent = {
  type: "submit" | "invalid" | "ended" | "lost" | "confirm" | "success";
  id: string;
};

/** Returns `marks` itself when nothing changes. */
export function reduceCreateMarks(
  marks: CreateMarks,
  event: CreateEvent,
): CreateMarks {
  const current = marks.get(event.id);
  let next: CreateMark | undefined = current;
  switch (event.type) {
    case "submit":
      if (current === undefined) next = "creating";
      break;
    case "invalid":
      if (current === "creating") next = undefined;
      break;
    case "ended":
    case "lost":
      if (current === "creating") next = "attempted";
      break;
    case "confirm":
      if (current === "attempted") next = undefined;
      break;
    case "success":
      next = "created";
      break;
  }
  if (next === current) return marks;
  const out = new Map(marks);
  if (next) out.set(event.id, next);
  else out.delete(event.id);
  return out;
}

/**
 * The create sheet can't be closed, left for another sheet or day, or
 * checked off while the form's Create is busy.
 */
export const canLeaveCreate = (mark: CreateMark | undefined) =>
  mark !== "creating";

/** A submit pressed while "attempted" is held back until "Create anyway". */
export const needsCreateConfirm = (mark: CreateMark | undefined) =>
  mark === "attempted";

/**
 * Reads one sample of the form after a submit (the screen polls it):
 * - "wait": still running (button disabled), or too soon to tell.
 * - "invalid": a failed validation. react-hook-form only calls the form's
 *   submit handler when validation passes, clearing all errors first, so a
 *   field error showing once the button is enabled means nothing was sent.
 * - "ended": the button was seen busy and is enabled with no field error (a
 *   real submit ended: saved and reset, failed, or still finishing after its
 *   reset), or it never showed busy within `quietMs` and shows no error
 *   either. When unsure this is the answer: it only asks for a confirmation.
 */
export function classifySubmitSample(sample: {
  buttonDisabled: boolean;
  seenBusy: boolean;
  fieldErrors: number;
  elapsedMs: number;
  quietMs?: number;
}): "wait" | "invalid" | "ended" {
  if (sample.buttonDisabled) return "wait";
  if (sample.fieldErrors > 0) return "invalid";
  if (sample.seenBusy) return "ended";
  return sample.elapsedMs >= (sample.quietMs ?? 1000) ? "ended" : "wait";
}

/**
 * What a release row offers:
 * - "plain": the note doesn't read as a release (or is a collection); no button.
 * - "created": the item is ticked (an account was made, or it was checked off).
 * - "creating": Create is busy for it; a disabled "Creating…".
 * - "attempted": an earlier Create may have made the account; "Check first"
 *   opens the sheet on a warning before any new form.
 * - "check-off": an account was made from it here but the item isn't ticked
 *   (the tick failed, or it was unticked since), so it offers to check it
 *   off, never to create a second one.
 * - "create": a parsed release not yet turned into an account.
 */
export type ReleaseRowState =
  | "plain"
  | "created"
  | "creating"
  | "attempted"
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
  if (mark === "attempted") return "attempted";
  return "create";
}

/** The warning before creating again after an attempt. */
export const CREATE_AGAIN_WARNING =
  "A previous attempt may already have created this account — check the borrower's page before creating another.";

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

/**
 * The two Bisaya lines under the Release tab's total: how many releases the
 * day has, and how to turn one into an account.
 */
export function releaseHintLines(
  count: number,
  isToday: boolean,
): [string, string] {
  const when = isToday ? "karong adlawa" : "niining adlawa";
  const first =
    count > 0
      ? `${count} ka release ${when}`
      : isToday
        ? `Wala pay release ${when}`
        : `Walay release ${when}`;
  return [first, "Pindota ang “Create account” aron himoon nga account."];
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
