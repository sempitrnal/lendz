import type { RowView } from "@/lib/checklist/row-state";

/** Longest name shown in a toast or sheet heading before the ellipsis. */
export const ROW_NAME_MAX = 40;

/** A label's text with `[name](href)` shown as the name (borrowers lowercase). */
export function plainLabelText(label: string): string {
  return label
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, name: string, href: string) =>
      href.startsWith("/borrowers/") ? name.toLowerCase() : name,
    )
    .trim();
}

function shorten(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > ROW_NAME_MAX
    ? `${oneLine.slice(0, ROW_NAME_MAX - 1).trimEnd()}…`
    : oneLine;
}

/**
 * What a row is called in toasts and headings: a collection row's borrower
 * (lowercase), else its note's first line; a plain note is its own text
 * (first line, mentions as names, truncated); "item" when there is nothing.
 */
export function rowDisplayName(row: Pick<RowView, "model" | "item">): string {
  const borrower = row.model?.borrower?.name.toLowerCase();
  if (borrower) return shorten(borrower) || "item";
  const text = row.model ? row.model.note : plainLabelText(row.item.label);
  const firstLine =
    text
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean) ?? "";
  return shorten(firstLine) || "item";
}
