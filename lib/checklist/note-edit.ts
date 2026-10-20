import { labelParts, withNote } from "@/lib/checklist/composer";

export type NoteSave =
  /** Nothing changed: close without writing. */
  | { action: "none" }
  /** Write this label. */
  | { action: "save"; label: string }
  /** Would leave an empty item (a plain note with no text): don't write. */
  | { action: "blocked" };

/**
 * What saving the note sheet does. The mention, collection lines and `with`
 * mentions of the label stay; only the note changes, and an empty note clears
 * it. A plain note (no borrower, no dues) is its own text, so clearing it
 * would leave an empty row: that is blocked (Remove from list is the way).
 */
export function planNoteSave(
  label: string,
  checklistDate: string,
  draft: string,
): NoteSave {
  const next = draft.trim();
  const current = labelParts(label, checklistDate).note.trim();
  if (next === current) return { action: "none" };
  const updated = withNote(label, checklistDate, next);
  if (updated.trim() === "") return { action: "blocked" };
  return { action: "save", label: updated };
}

/**
 * Saving a plain note (no dues): the whole label is the text, edited as it is
 * (a mention stays where it is, with its link), so nothing is reordered or
 * lost. Empty would leave an empty item: blocked.
 */
export function planPlainSave(label: string, draft: string): NoteSave {
  const next = draft.trim();
  if (next === label.trim()) return { action: "none" };
  if (next === "") return { action: "blocked" };
  return { action: "save", label: next };
}
