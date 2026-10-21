import { composeLabel } from "@/lib/checklist/composer";
import { extractBorrowerMention } from "@/lib/checklist/labels";
import {
  parseReleasedLabel,
  type ParsedReleasedLabel,
} from "@/lib/checklist/released";
import type { ReleaseRowView } from "@/lib/checklist/release-items";
import { releaseNote } from "@/lib/checklist/release-list";

/** Longest name shown in a toast or sheet heading. */
const NAME_MAX = 40;

/** A release row's name for toasts and headings: the borrower, else its text. */
export function releaseDisplayName(view: ReleaseRowView): string {
  const text = (view.name || view.typed).trim().toLowerCase();
  if (text === "") return "release";
  return text.length > NAME_MAX ? `${text.slice(0, NAME_MAX - 1)}…` : text;
}

/** What the edit sheet starts with: the release note without the borrower. */
export function releaseEditText(view: ReleaseRowView): string {
  return mentionOf(view)
    ? releaseNote(view.item.label)
    : view.item.label.replace(/\s+/g, " ").trim();
}

function mentionOf(view: ReleaseRowView) {
  return extractBorrowerMention(view.item.label);
}

export type ReleaseEditPlan =
  | { action: "blocked" }
  | { action: "unchanged" }
  | { action: "save"; label: string; parsed: ParsedReleasedLabel | null };

/**
 * Saving an edited release: the borrower's mention stays, the note is what
 * was typed. An empty note is blocked (it would be an empty item: Remove from
 * list instead); the same text saves nothing.
 */
export function planReleaseEdit(
  view: ReleaseRowView,
  text: string,
): ReleaseEditPlan {
  const note = text.replace(/\s+/g, " ").trim();
  if (note === "") return { action: "blocked" };
  if (note === releaseEditText(view)) return { action: "unchanged" };
  const borrower = mentionOf(view);
  const label = borrower
    ? composeLabel({ borrower, others: [], lines: [], note })
    : note;
  return {
    action: "save",
    label,
    parsed: parseReleasedLabel(label, view.item.checklist_date),
  };
}
