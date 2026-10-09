import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import type { DueChecklistGroup } from "@/lib/checklist/types";

export function formatShortDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractBorrowerId(href: string): string | null {
  const match = href.match(/\/borrowers\/([^/]+)$/);
  return match?.[1] ?? null;
}

export type ScheduleRef = { id: string; due_date: string };

/** Pulls payment_schedules ids embedded in `/next`-inserted date badges. */
export function extractScheduleRefs(label: string): ScheduleRef[] {
  const regex = /\[([^\]]*)\]\(#badge:date:([^|)]+)\|([^)]*)\)/g;
  const refs: ScheduleRef[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(label)) !== null) {
    const id = match[3];
    if (id) refs.push({ id, due_date: match[2] });
  }
  return refs;
}

/** Pulls the first borrower mention (name + id) out of a checklist label. */
export function extractBorrowerMention(
  label: string,
): { id: string; name: string } | null {
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(label)) !== null) {
    const id = extractBorrowerId(match[2]);
    if (id) return { id, name: match[1] };
  }
  return null;
}

export const NEXT_LINE =
  /^\s*₱\s*([\d,]+(?:\.\d+)?)\s+\[[^\]]*\]\(#badge:date:(\d{4}-\d{2}-\d{2})\|([^)\s]+)\)(?:\s+\[[^\]]*\]\(#badge:type:(loan|cash_advance)\))?\s*$/;

export const TOTAL_LINE = /^\s*Total:\s*₱[\d,.]+\s*$/;

export const NEXT_MARK = "\u0000";

/** Collection lines (amount + date badge carrying a schedule id) in a label. */
export function parseExistingNext(label: string): NextCollectionItem[] {
  const items: NextCollectionItem[] = [];
  for (const line of label.replace("/next", "").split("\n")) {
    const m = line.match(NEXT_LINE);
    if (!m) continue;
    items.push({
      id: m[3],
      due_date: m[2],
      amount: Number(m[1].replace(/,/g, "")),
      type: m[4] ?? "loan",
      existing: true,
    });
  }
  return items;
}

/**
 * Replaces every linked collection line (and its Total line) in `label` with
 * `selected`, written where the `/next` token was typed (or at the end when
 * the dropdown was opened from the button).
 */
export function rewriteNextBlock(
  label: string,
  selected: NextCollectionItem[],
): string {
  const tokenIdx = label.indexOf("/next");
  const trimmed = label.trimEnd();
  const marked =
    tokenIdx === -1
      ? trimmed
        ? `${trimmed}\n${NEXT_MARK}`
        : NEXT_MARK
      : label.slice(0, tokenIdx) + NEXT_MARK + label.slice(tokenIdx + 5);

  const lines: string[] = [];
  let prevRemoved = false;
  for (const line of marked.split("\n")) {
    const bare = line.replace(NEXT_MARK, "");
    const hadMark = bare.length !== line.length;
    const remove: boolean =
      NEXT_LINE.test(bare) || (prevRemoved && TOTAL_LINE.test(bare));
    prevRemoved = remove;
    if (!remove) lines.push(line);
    else if (hadMark) lines.push(NEXT_MARK);
  }

  const block = selected.map(
    (i) =>
      `₱${i.amount.toLocaleString()} [${formatShortDate(i.due_date)}](#badge:date:${i.due_date}|${i.id}) [${i.type === "cash_advance" ? "CA" : "Loan"}](#badge:type:${i.type})`,
  );
  if (selected.length > 1) {
    const total = selected.reduce((sum, i) => sum + i.amount, 0);
    block.push(`Total: ₱${total.toLocaleString()}`);
  }
  const blockText = block.join("\n");

  const out: string[] = [];
  for (const line of lines) {
    if (!line.includes(NEXT_MARK)) {
      out.push(line);
      continue;
    }
    const [before, after] = line.split(NEXT_MARK);
    const head = before.trimEnd();
    const tail = after.trimStart();
    if (head) out.push(head);
    if (blockText) out.push(blockText);
    if (tail) out.push(tail);
  }
  return out.join("\n");
}

/** Same text/badge format the `/next` flow produces, one borrower per item. */
export function buildDueLabel(group: DueChecklistGroup): string {
  const lines = group.items.map(
    (i) =>
      `₱${i.amount.toLocaleString()} [${formatShortDate(i.due_date)}](#badge:date:${i.due_date}|${i.id}) [${i.type === "cash_advance" ? "CA" : "Loan"}](#badge:type:${i.type})`,
  );
  const mention = `[${group.name.toLowerCase()}](/borrowers/${group.borrower_id})`;
  const total = group.items.reduce((sum, i) => sum + i.amount, 0);
  return [
    mention,
    ...lines,
    ...(group.items.length > 1 ? [`Total: ₱${total.toLocaleString()}`] : []),
  ].join("\n");
}

export type MentionSegment = {
  start: number;
  end: number;
  name: string;
  id: string | null;
  href: string | null;
};

export function parseMentions(
  label: string,
  borrowers: BorrowerSearchItem[],
): MentionSegment[] {
  const names = new Map(
    borrowers.map((b) => [`${b.first_name} ${b.last_name}`, b]),
  );
  const matches: MentionSegment[] = [];

  const mdRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let mdMatch: RegExpExecArray | null;
  while ((mdMatch = mdRegex.exec(label)) !== null) {
    const name = mdMatch[1];
    const href = mdMatch[2];
    matches.push({
      start: mdMatch.index,
      end: mdRegex.lastIndex,
      name,
      id: extractBorrowerId(href),
      href,
    });
  }

  const nameMatches: MentionSegment[] = [];
  names.forEach((borrower, name) => {
    const re = new RegExp(`\\b${escapeRegex(name)}\\b`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(label)) !== null) {
      if (
        matches.some(
          (mm) => m!.index >= mm.start && m!.index + name.length <= mm.end,
        )
      ) {
        continue;
      }
      nameMatches.push({
        start: m.index,
        end: m.index + name.length,
        name,
        id: borrower.id,
        href: `/borrowers/${borrower.id}`,
      });
    }
  });

  const all = [...matches, ...nameMatches].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end;
  });

  const result: MentionSegment[] = [];
  let lastEnd = -1;
  for (const m of all) {
    if (m.start >= lastEnd) {
      result.push(m);
      lastEnd = m.end;
    }
  }
  return result;
}

export type NextCollectionItem = {
  id: string;
  due_date: string;
  amount: number;
  type: string;
  /** Already present in the text being edited (pre-checked in the dropdown). */
  existing?: boolean;
};
