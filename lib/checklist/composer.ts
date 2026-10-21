import {
  buildDueLabel,
  extractBorrowerId,
  extractBorrowerMention,
  NEXT_LINE,
  parseExistingNext,
  TOTAL_LINE,
} from "@/lib/checklist/labels";
import type { DueChecklistItem } from "@/lib/checklist/types";

export type ComposerBorrower = { id: string; name: string };

const AT_TOKEN = /(?:^|\s)@([^\s@]*)$/;
const NEXT_TOKEN = /(^|\s)\/next(?=\s|$)/;
const MENTION = "\\[[^\\]]+\\]\\(\\/borrowers\\/[^)\\s]+\\)";
const OTHERS_SUFFIX = new RegExp(
  `(?:^|\\s)with (${MENTION}(?:, ${MENTION})*)\\s*$`,
);

/** The text after a trailing `@` token (no whitespace in it), or null. */
export function atQuery(text: string): string | null {
  const m = text.match(AT_TOKEN);
  return m ? m[1] : null;
}

/** Drops the trailing `@query` token, keeping what came before it. */
export function removeAtToken(text: string): string {
  return text.replace(/@[^\s@]*$/, "");
}

/** Removes a standalone `/next` token, reporting whether there was one. */
export function stripNextToken(text: string): {
  text: string;
  hadNext: boolean;
} {
  if (!NEXT_TOKEN.test(text)) return { text, hadNext: false };
  return { text: text.replace(NEXT_TOKEN, "").trim(), hadNext: true };
}

function mentionOf(b: ComposerBorrower) {
  return `[${b.name.toLowerCase()}](/borrowers/${b.id})`;
}

/**
 * Builds a checklist label: the active borrower's mention first, then the
 * collection block, then the note, then `with` mentions for other borrowers.
 */
export function composeLabel(input: {
  borrower: ComposerBorrower | null;
  others: ComposerBorrower[];
  lines: DueChecklistItem[];
  note: string;
}): string {
  const { borrower, others, lines } = input;
  const note = input.note.trim();
  const withOthers =
    others.length > 0 ? `with ${others.map(mentionOf).join(", ")}` : "";

  if (lines.length === 0) {
    return [borrower ? mentionOf(borrower) : "", note, withOthers]
      .filter(Boolean)
      .join(" ");
  }

  const block = buildDueLabel({
    borrower_id: borrower?.id ?? "",
    name: borrower?.name ?? "",
    items: lines,
  });
  // Without a borrower, buildDueLabel still writes a mention line; drop it.
  const blockText = borrower ? block : block.split("\n").slice(1).join("\n");
  return [blockText, note, withOthers].filter(Boolean).join("\n");
}

function splitOthers(text: string): {
  rest: string;
  others: ComposerBorrower[];
} {
  const m = text.match(OTHERS_SUFFIX);
  if (!m) return { rest: text, others: [] };
  const others: ComposerBorrower[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let x: RegExpExecArray | null;
  while ((x = re.exec(m[1])) !== null) {
    const id = extractBorrowerId(x[2]);
    if (id) others.push({ id, name: x[1] });
  }
  return { rest: text.slice(0, m.index), others };
}

function parse(label: string, checklistDate: string) {
  void checklistDate;
  const borrower = extractBorrowerMention(label);
  const lines: DueChecklistItem[] = parseExistingNext(label).map((l) => ({
    id: l.id,
    due_date: l.due_date,
    amount: l.amount,
    type: l.type === "cash_advance" ? "cash_advance" : "loan",
  }));

  let rest = label;
  if (borrower) {
    rest = rest.replace(`[${borrower.name}](/borrowers/${borrower.id})`, "");
  }
  const kept = rest
    .split("\n")
    .filter((line) => !NEXT_LINE.test(line) && !TOTAL_LINE.test(line))
    .join("\n");
  const { rest: noteText, others } = splitOthers(kept);
  const note = noteText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
  return { borrower, lines, note, others };
}

/** Splits a label back into the parts the composer edits. */
export function labelParts(
  label: string,
  checklistDate: string,
): {
  borrower: ComposerBorrower | null;
  lines: DueChecklistItem[];
  note: string;
} {
  const { borrower, lines, note } = parse(label, checklistDate);
  return { borrower, lines, note };
}

/** Replaces only the note, leaving the mention, lines and `with` mentions. */
export function withNote(
  label: string,
  checklistDate: string,
  note: string,
): string {
  const { borrower, lines, others } = parse(label, checklistDate);
  return composeLabel({ borrower, others, lines, note });
}

/**
 * Rewrites a label with new collection lines and note, keeping its borrower
 * and its `with` mentions (the edit composer hides `@`, so both stay put).
 */
export function editLabel(
  label: string,
  checklistDate: string,
  input: { lines: DueChecklistItem[]; note: string },
): string {
  const { borrower, others } = parse(label, checklistDate);
  return composeLabel({
    borrower,
    others,
    lines: input.lines,
    note: input.note,
  });
}
