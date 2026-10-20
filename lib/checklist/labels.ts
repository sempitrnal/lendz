import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import type { DueChecklistGroup } from "@/lib/checklist/types";
import { daysBetween } from "@/lib/checklist/dates";

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

function normalizeHex(color: string | null | undefined): string | null {
  const hex = color?.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hex) return null;
  const digits =
    hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
  return `#${digits.toLowerCase()}`;
}

export type BorrowerCategory = {
  id: string;
  name: string;
  /** Normalized `#rrggbb`, or null when unset/invalid. */
  color: string | null;
  sort_order: number | null;
};

/**
 * The category a borrower is shown under: the first one with a valid color,
 * else the first one at all.
 */
export function borrowerPrimaryCategory(
  borrower: BorrowerSearchItem | null | undefined,
): BorrowerCategory | null {
  const categories = (borrower?.borrower_categories ?? [])
    .flatMap((row) => row.category ?? [])
    .filter(Boolean)
    .map((c) => ({
      id: c.id,
      name: c.name,
      color: normalizeHex(c.color),
      sort_order: c.sort_order ?? null,
    }));
  return categories.find((c) => c.color) ?? categories[0] ?? null;
}

/** First valid category color on a borrower, normalized to `#rrggbb`. */
export function borrowerCategoryColor(
  borrower: BorrowerSearchItem | null | undefined,
): string | null {
  return borrowerPrimaryCategory(borrower)?.color ?? null;
}

export const OTHER_GROUP_KEY = "other";

export type BorrowerCategoryGroup<T> = {
  key: string;
  name: string;
  color: string | null;
  rows: T[];
};

/**
 * Buckets rows by the primary category of the first borrower mentioned in
 * each label. Rows with no mention or an uncategorized borrower land in a
 * trailing "other" group. Row order within a group is preserved.
 */
export function groupByBorrowerCategory<T>(
  rows: T[],
  labelOf: (row: T) => string,
  borrowers: BorrowerSearchItem[],
): BorrowerCategoryGroup<T>[] {
  const byId = new Map(borrowers.map((b) => [b.id, b]));
  const groups = new Map<string, BorrowerCategoryGroup<T>>();
  const sortOrder = new Map<string, number | null>();
  const other: BorrowerCategoryGroup<T> = {
    key: OTHER_GROUP_KEY,
    name: "other",
    color: null,
    rows: [],
  };

  for (const row of rows) {
    const label = labelOf(row);
    const id =
      extractBorrowerMention(label)?.id ??
      parseMentions(label, borrowers).find((m) => m.id)?.id ??
      null;
    const category = id ? borrowerPrimaryCategory(byId.get(id)) : null;
    if (!category) {
      other.rows.push(row);
      continue;
    }
    let group = groups.get(category.id);
    if (!group) {
      group = {
        key: category.id,
        name: category.name,
        color: category.color,
        rows: [],
      };
      groups.set(category.id, group);
      sortOrder.set(category.id, category.sort_order);
    }
    group.rows.push(row);
  }

  const ordered = [...groups.values()].sort((a, b) => {
    const sa = sortOrder.get(a.key) ?? null;
    const sb = sortOrder.get(b.key) ?? null;
    if (sa !== sb) {
      if (sa === null) return 1;
      if (sb === null) return -1;
      return sa - sb;
    }
    return a.name.localeCompare(b.name);
  });
  return other.rows.length > 0 ? [...ordered, other] : ordered;
}

export type MentionSegment = {
  start: number;
  end: number;
  name: string;
  id: string | null;
  href: string | null;
};

/** Stands in while the borrower list loads, so memoized work keys on a stable array. */
export const NO_BORROWERS: BorrowerSearchItem[] = [];

/** Full-name lookups, built once per borrower list rather than once per label. */
const namesByBorrowerList = new WeakMap<
  BorrowerSearchItem[],
  Map<string, BorrowerSearchItem>
>();

function borrowerNames(borrowers: BorrowerSearchItem[]) {
  let names = namesByBorrowerList.get(borrowers);
  if (!names) {
    names = new Map(
      borrowers.map((b) => [`${b.first_name} ${b.last_name}`, b]),
    );
    namesByBorrowerList.set(borrowers, names);
  }
  return names;
}

export function parseMentions(
  label: string,
  borrowers: BorrowerSearchItem[],
): MentionSegment[] {
  const names = borrowerNames(borrowers);
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
    // A whole-word match is also a substring match, and this is far cheaper
    // than compiling a pattern for every borrower on every label.
    if (!label.includes(name)) return;
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
  /** Comes from a manual-schedule account (schedules added by hand). */
  manual?: boolean;
};

/** A manual account the `/next` dropdown can record a payment on. */
export type ManualAccount = {
  id: string;
  type: string;
  /** Paid so far. */
  paid: number;
  /** What is still owed. */
  remaining: number;
  release_date: string | null;
  /**
   * Rolling accounts pay their open schedule; what's left of it rolls into a
   * new one with interest. Flat accounts get a new paid schedule instead.
   */
  rolling?: {
    interestRate: number;
    /** The open schedule a payment goes against (null when none is open). */
    open: { id: string; due_date: string; amount: number } | null;
  };
};

export type BorrowerNextData = {
  items: NextCollectionItem[];
  manualAccounts: ManualAccount[];
};

export type CollectionRowLine = NextCollectionItem & {
  /** Days past due relative to the checklist date (0 when not late). */
  daysOverdue: number;
};

export type CollectionRowModel = {
  borrower: { id: string; name: string } | null;
  lines: CollectionRowLine[];
  total: number;
  /** Whatever else the label says, with the mention and collection lines removed. */
  note: string;
};

/**
 * Splits a `/next`-style label into the parts the checklist row shows.
 * Returns null when the label has no linked collection lines.
 */
export function collectionRowModel(
  label: string,
  checklistDate: string,
): CollectionRowModel | null {
  const key = `${checklistDate}\u0000${label}`;
  if (rowModelCache.has(key)) return rowModelCache.get(key) ?? null;
  const model = buildCollectionRowModel(label, checklistDate);
  // Bounded: a long session shouldn't keep every label it ever showed.
  if (rowModelCache.size >= 500) rowModelCache.clear();
  rowModelCache.set(key, model);
  return model;
}

/** Parsed rows by day and label, so a tap that changes one row doesn't re-parse them all. */
const rowModelCache = new Map<string, CollectionRowModel | null>();

function buildCollectionRowModel(
  label: string,
  checklistDate: string,
): CollectionRowModel | null {
  const parsed = parseExistingNext(label);
  if (parsed.length === 0) return null;

  const borrower = extractBorrowerMention(label);
  const lines = parsed.map((l) => ({
    ...l,
    daysOverdue: Math.max(0, daysBetween(l.due_date, checklistDate)),
  }));
  const total =
    Math.round(lines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100;

  let rest = label.replace("/next", "");
  if (borrower) {
    rest = rest.replace(`[${borrower.name}](/borrowers/${borrower.id})`, "");
  }
  const note = rest
    .split("\n")
    .filter((line) => !NEXT_LINE.test(line) && !TOTAL_LINE.test(line))
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  return { borrower, lines, total, note };
}
