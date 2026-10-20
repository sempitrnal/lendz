import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import {
  composeLabel,
  editLabel,
  type ComposerBorrower,
} from "@/lib/checklist/composer";
import {
  extractScheduleRefs,
  formatShortDate,
  type ManualAccount,
  type NextCollectionItem,
} from "@/lib/checklist/labels";
import {
  parseReleasedLabel,
  type ParsedReleasedLabel,
} from "@/lib/checklist/released";
import { cents, parseAmountInput } from "@/lib/checklist/amount-input";
import type { DueChecklistItem } from "@/lib/checklist/types";

/** Pure logic behind the add sheet (`components/dashboard/checklist-v2/add-sheet.tsx`). */

export type AddMode = "collect" | "release";

/** A collection line on the draft; `paid` marks a manual payment already saved. */
export type DraftLine = DueChecklistItem & { paid?: true };

export const MENTION_FIRST = "Mention a borrower first (@name)";

const peso = (n: number) =>
  `₱${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const lineType = (type: string): DueChecklistItem["type"] =>
  type === "cash_advance" ? "cash_advance" : "loan";

const shortKind = (type: string) => (type === "cash_advance" ? "CA" : "Loan");

export function borrowerName(b: BorrowerSearchItem): string {
  return `${b.first_name} ${b.last_name}`.replace(/\s+/g, " ").trim();
}

export function toComposerBorrower(b: BorrowerSearchItem): ComposerBorrower {
  return { id: b.id, name: borrowerName(b).toLowerCase() };
}

/**
 * Borrowers whose name contains `query` (case-insensitive), skipping the ones
 * already mentioned. An empty query lists the first few.
 */
export function suggestBorrowers(
  borrowers: BorrowerSearchItem[],
  query: string,
  excludeIds: string[] = [],
  limit = 4,
): BorrowerSearchItem[] {
  const q = query.trim().toLowerCase();
  const skip = new Set(excludeIds);
  const out: BorrowerSearchItem[] = [];
  for (const b of borrowers) {
    if (out.length >= limit) break;
    if (skip.has(b.id)) continue;
    if (q && !borrowerName(b).toLowerCase().includes(q)) continue;
    out.push(b);
  }
  return out;
}

/** The borrower dues and `/next` use: the last one mentioned. */
export const activeBorrower = (mentions: ComposerBorrower[]) =>
  mentions.length > 0 ? mentions[mentions.length - 1] : null;

/** A saved manual payment ties the draft to its borrower. */
export const hasPaidLines = (lines: DraftLine[]) => lines.some((l) => l.paid);

/**
 * Adds a mention. In Release mode there is one borrower, so it replaces.
 * In Collect mode the new one becomes the active borrower, and the lines
 * picked for the previous active borrower are dropped (they belong to it).
 * Once a manual payment is saved the active borrower is locked: a new mention
 * goes in before it, so the paid line stays with its borrower.
 */
export function addMention(
  mode: AddMode,
  mentions: ComposerBorrower[],
  lines: DraftLine[],
  b: ComposerBorrower,
): { mentions: ComposerBorrower[]; lines: DraftLine[] } {
  if (mode === "release") return { mentions: [b], lines: [] };
  const active = activeBorrower(mentions);
  const rest = mentions.filter((m) => m.id !== b.id);
  if (hasPaidLines(lines) && active && active.id !== b.id) {
    const others = rest.filter((m) => m.id !== active.id);
    return { mentions: [...others, b, active], lines };
  }
  if (active?.id === b.id) return { mentions, lines };
  return { mentions: [...rest, b], lines: [] };
}

/** Whether the pill can be removed: not the active one once a payment is saved. */
export function canRemoveMention(
  mentions: ComposerBorrower[],
  lines: DraftLine[],
  id: string,
): boolean {
  return !(hasPaidLines(lines) && activeBorrower(mentions)?.id === id);
}

/** Removes a mention; removing the active borrower drops its lines. */
export function removeMention(
  mentions: ComposerBorrower[],
  lines: DraftLine[],
  id: string,
): { mentions: ComposerBorrower[]; lines: DraftLine[] } {
  if (!canRemoveMention(mentions, lines, id)) return { mentions, lines };
  const wasActive = activeBorrower(mentions)?.id === id;
  return {
    mentions: mentions.filter((m) => m.id !== id),
    lines: wasActive ? [] : lines,
  };
}

const NEXT_TOKENS = /(^|\s)\/next(?=\s|$)/g;

function nextTokenStarts(text: string): number[] {
  return [...text.matchAll(NEXT_TOKENS)].map((m) => m.index + m[1].length);
}

/**
 * Reacts to a newly typed `/next`: when `next` has one more token than
 * `prev`, that new token (and one space next to it) is removed and `opened`
 * is true. A `/next` that was already in the text (an edited note) stays.
 */
export function detectNextTyped(
  prev: string,
  next: string,
): { text: string; opened: boolean } {
  const before = nextTokenStarts(prev);
  const after = nextTokenStarts(next);
  if (after.length <= before.length) return { text: next, opened: false };
  const old = new Set(before);
  const at =
    [...after].reverse().find((i) => !old.has(i)) ?? after[after.length - 1];
  let start = at;
  let end = at + "/next".length;
  if (start > 0 && next[start - 1] === " ") start -= 1;
  else if (next[end] === " ") end += 1;
  return { text: next.slice(0, start) + next.slice(end), opened: true };
}

/** Schedule ids already on the day's list, leaving out the item being edited. */
export function listedScheduleIds(
  items: { id: string; label: string }[],
  exceptItemId?: string,
): Set<string> {
  return new Set(
    items
      .filter((i) => i.id !== exceptItemId)
      .flatMap((i) => extractScheduleRefs(i.label).map((r) => r.id)),
  );
}

/**
 * The dues the step offers: the borrower's open installments that aren't on
 * the day's list already and aren't a payment saved in this draft.
 */
export function offerDues(
  fetched: NextCollectionItem[],
  listed: Set<string>,
  lines: DraftLine[],
): { offered: DueChecklistItem[]; alreadyListed: number } {
  const paidIds = new Set(lines.filter((l) => l.paid).map((l) => l.id));
  const offered: DueChecklistItem[] = [];
  let alreadyListed = 0;
  for (const f of fetched) {
    if (!f.id) continue;
    if (listed.has(f.id)) {
      alreadyListed += 1;
      continue;
    }
    if (paidIds.has(f.id)) continue;
    if (offered.some((o) => o.id === f.id)) continue;
    offered.push({
      id: f.id,
      due_date: f.due_date,
      amount: f.amount,
      type: lineType(f.type),
    });
  }
  return { offered, alreadyListed };
}

/** The step starts with the dues already on the draft ticked. */
export function initialSelection(
  offered: DueChecklistItem[],
  lines: DraftLine[],
): Set<string> {
  const onDraft = new Set(lines.map((l) => l.id));
  return new Set(offered.filter((o) => onDraft.has(o.id)).map((o) => o.id));
}

/**
 * The draft's lines after the step: lines the step didn't offer (saved
 * payments, lines no longer open) stay; the offered ones become the ticked
 * ones, in the order they were offered.
 */
export function applyDuesSelection(
  lines: DraftLine[],
  offered: DueChecklistItem[],
  selected: Set<string>,
): DraftLine[] {
  const offeredIds = new Set(offered.map((o) => o.id));
  return [
    ...lines.filter((l) => !offeredIds.has(l.id)),
    ...offered.filter((o) => selected.has(o.id)),
  ];
}

/** The dues step's button: what it does and whether it can. */
export function duesStepButton(
  lines: DraftLine[],
  offered: DueChecklistItem[],
  selected: Set<string>,
): { label: string; enabled: boolean } {
  const chosen = offered.filter((o) => selected.has(o.id));
  const offeredIds = new Set(offered.map((o) => o.id));
  const hadFromDues = lines.some((l) => !l.paid && offeredIds.has(l.id));
  if (chosen.length > 0) {
    const total = cents(chosen.reduce((s, o) => s + o.amount, 0));
    return { label: `Add ${chosen.length} · ${peso(total)}`, enabled: true };
  }
  if (hadFromDues) return { label: "Remove picked dues", enabled: true };
  return { label: "Pick a due", enabled: false };
}

/** e.g. "oct 22 · Loan · ₱2,100", or "Loan · ₱500 paid" for a saved payment. */
export function chipText(line: DraftLine): string {
  if (line.paid) return `${shortKind(line.type)} · ${peso(line.amount)} paid`;
  return `${formatShortDate(line.due_date).toLowerCase()} · ${shortKind(
    line.type,
  )} · ${peso(line.amount)}`;
}

export const linesTotal = (lines: DraftLine[]) =>
  cents(lines.reduce((s, l) => s + l.amount, 0));

/** The label a Release entry makes, and what `parseReleasedLabel` reads in it. */
export function releaseDraft(
  borrower: ComposerBorrower | null,
  text: string,
  date: string,
): { label: string; parsed: ParsedReleasedLabel | null } {
  const note = text.trim();
  if (!borrower || !note) return { label: "", parsed: null };
  const label = composeLabel({ borrower, others: [], lines: [], note });
  return { label, parsed: parseReleasedLabel(label, date) };
}

function longDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** e.g. "Reads as ₱10,000 loan · 10 months · first payment Nov 4, 2026". */
export function releaseReadBack(parsed: ParsedReleasedLabel): string {
  const v = parsed.initialValues;
  const parts = [
    `${peso(Number(v.principal_amount ?? 0))} ${
      v.type === "cash_advance" ? "cash advance" : "loan"
    }`,
  ];
  if (v.term_months) {
    const n = Number(v.term_months);
    parts.push(
      v.payment_frequency === "custom"
        ? `${n} give${n === 1 ? "" : "s"}`
        : `${n} month${n === 1 ? "" : "s"}`,
    );
  }
  if (v.first_payment_date) {
    parts.push(`first payment ${longDate(v.first_payment_date)}`);
  }
  return `Reads as ${parts.join(" · ")}`;
}

export type SubmitPlan =
  | {
      ok: true;
      action: "add";
      label: string;
      categoryId: string | null;
      checked: boolean;
    }
  | { ok: true; action: "edit"; label: string }
  | {
      ok: false;
      reason:
        | "empty"
        | "no-borrower"
        | "unparsed"
        | "no-category"
        | "no-lines"
        | "unchanged";
    };

/**
 * What pressing the sheet's button does, or why it can't.
 * - Collect: the active borrower's mention, its lines, the note and `with`
 *   the other mentions, into Collect. No lines makes a plain note. The item
 *   starts ticked when every line is a payment already saved.
 * - Release: the borrower and the typed note, only once it parses.
 * - Edit: new lines and note on the item's label; needs at least one line.
 */
export function submitPlan(draft: {
  mode: AddMode;
  mentions: ComposerBorrower[];
  lines: DraftLine[];
  text: string;
  date: string;
  /** The label of the item being edited. */
  editOf: string | null;
  collectId: string | null;
  releasedId: string | null;
}): SubmitPlan {
  const note = draft.text.trim();
  const lines: DueChecklistItem[] = draft.lines.map((l) => ({
    id: l.id,
    due_date: l.due_date,
    amount: l.amount,
    type: l.type,
  }));

  if (draft.editOf !== null) {
    if (lines.length === 0) return { ok: false, reason: "no-lines" };
    const label = editLabel(draft.editOf, draft.date, { lines, note });
    if (label === draft.editOf) return { ok: false, reason: "unchanged" };
    return { ok: true, action: "edit", label };
  }

  const borrower = activeBorrower(draft.mentions);
  if (draft.mode === "release") {
    if (!borrower) return { ok: false, reason: "no-borrower" };
    const { label, parsed } = releaseDraft(borrower, draft.text, draft.date);
    if (!parsed) return { ok: false, reason: "unparsed" };
    if (!draft.releasedId) return { ok: false, reason: "no-category" };
    return {
      ok: true,
      action: "add",
      label,
      categoryId: draft.releasedId,
      checked: false,
    };
  }

  if (lines.length === 0 && !note && draft.mentions.length === 0) {
    return { ok: false, reason: "empty" };
  }
  const others = draft.mentions.filter((m) => m.id !== borrower?.id);
  const label = composeLabel({ borrower, others, lines, note });
  return {
    ok: true,
    action: "add",
    label,
    categoryId: draft.collectId,
    checked: draft.lines.length > 0 && draft.lines.every((l) => l.paid),
  };
}

/** The most a manual payment can be: the open rolling schedule, else what's left. */
export function manualPaymentCap(account: ManualAccount): number {
  const open = account.rolling?.open ?? null;
  return cents(open ? open.amount : account.remaining);
}

/** Quick amounts for a manual payment, ending with the full amount it can take. */
export function manualQuickAmounts(account: ManualAccount): number[] {
  const cap = manualPaymentCap(account);
  if (!(cap > 0)) return [];
  return [...[500, 1000, 2000].filter((n) => n < cap), cap];
}

/**
 * Reads the typed manual payment: the amount (centavos), why it can't be
 * saved, and for a rolling account what rolls over with interest.
 */
export function manualPaymentCheck(
  account: ManualAccount,
  raw: string,
): {
  amount: number | null;
  error: string | null;
  hint: string | null;
  rollover: number;
  nextDue: number;
  canSave: boolean;
} {
  const open = account.rolling?.open ?? null;
  const rate = account.rolling?.interestRate ?? 0;
  const cap = manualPaymentCap(account);
  const parsed = parseAmountInput(raw);
  const amount = parsed !== null && parsed > 0 ? cents(parsed) : null;
  const over = amount !== null && amount > cap;
  let error: string | null = null;
  if (raw.trim() && parsed === null) error = "Not a number";
  else if (over) {
    error = open
      ? `At most ${peso(cap)}, the amount due on ${formatShortDate(open.due_date)}`
      : `That's more than the ${peso(cap)} left`;
  }
  const rollover =
    open && amount !== null && !over
      ? cents(Math.max(0, open.amount - amount))
      : 0;
  const nextDue = cents(rollover * (1 + rate / 100));
  let hint: string | null = null;
  if (open && amount !== null && !over) {
    hint =
      rollover > 0
        ? `${peso(rollover)} rolls over to ${peso(nextDue)} (+${rate}%)`
        : `Clears the ${formatShortDate(open.due_date)} schedule`;
  }
  return {
    amount,
    error,
    hint,
    rollover,
    nextDue,
    canSave: amount !== null && !over,
  };
}

/** The toast once a manual payment is saved. */
export function manualPaidMessage(
  amount: number,
  rollover: number,
  nextDue: number,
): string {
  return rollover > 0
    ? `${peso(amount)} paid · ${peso(nextDue)} rolls over`
    : `${peso(amount)} payment recorded`;
}

/** The green chip a saved manual payment becomes. */
export function paidLine(schedule: NextCollectionItem): DraftLine {
  return {
    id: schedule.id,
    due_date: schedule.due_date.slice(0, 10),
    amount: cents(schedule.amount),
    type: lineType(schedule.type),
    paid: true,
  };
}

/** The toast when a manual payment fails: says plainly that no money moved. */
export function manualFailureMessage(error: string): string {
  return `${error.replace(/[.\s]+$/, "")} — no payment was recorded`;
}

/** The toast when the item for a saved payment can't be added. */
export const PAID_ITEM_NOT_ADDED =
  "The payment is saved, but its item wasn't added to the list — don't record it again";
