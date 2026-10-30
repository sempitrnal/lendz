import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import { borrowerCategoryColor, parseMentions } from "@/lib/checklist/labels";
import { overdueCutoffDateValue } from "@/lib/checklist/dates";

const MENTION_PILL_BASE =
  "inline-block rounded-md border px-1.5 py-0.5 text-xs font-medium";

export const MENTION_PILL_CLASS = `${MENTION_PILL_BASE} border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300`;

const CATEGORY_MENTION_PILL_CLASS = `${MENTION_PILL_BASE} text-slate-700 dark:text-slate-200`;

/** Grey border for near-white categories, whose own tint would vanish on the card. */
export const NEAR_WHITE_BORDER = "#cbd5e1";

export function isNearWhite(color: string) {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 230;
}

/** Tint derived from a `#rrggbb` category color; text stays neutral for contrast. */
export function categoryTintStyle(color: string) {
  return {
    backgroundColor: `${color}1f`,
    borderColor: isNearWhite(color) ? NEAR_WHITE_BORDER : `${color}4d`,
  };
}

export function createMentionSpan(
  name: string,
  borrowerId: string,
  borrower: BorrowerSearchItem | undefined,
) {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.textContent = name;
  span.dataset.mention = borrowerId;
  const color = borrowerCategoryColor(borrower);
  if (color) {
    span.className = CATEGORY_MENTION_PILL_CLASS;
    Object.assign(span.style, categoryTintStyle(color));
  } else {
    span.className = MENTION_PILL_CLASS;
  }
  return span;
}

export type ChipTone =
  | "neutral"
  | "overdue"
  | "loan"
  | "cash_advance"
  | "paid"
  | "partial"
  | "unpaid";

// Borderless, low-saturation tints: the row should read at a glance, with
// only "overdue" carrying real color.
const CHIP_TONES: Record<ChipTone, string> = {
  neutral: "border-transparent bg-muted text-muted-foreground",
  overdue:
    "border-transparent bg-[#d14d5a]/10 text-[#d14d5a] dark:bg-[#d14d5a]/20 dark:text-[#f0a0a8]",
  loan: "lowercase border-transparent bg-violet-500/10 text-violet-700 dark:text-violet-300",
  cash_advance:
    "lowercase border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
  paid: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  // Muted pastel lavender, softer than the loan chip so the two read apart.
  partial:
    "border-transparent bg-[#f6f2fb] text-[#8a7aa8] dark:bg-[#251f2e] dark:text-[#bcaed6]",
  unpaid:
    "border-dashed border-orange-300 bg-transparent text-orange-700 dark:border-orange-700 dark:text-orange-300",
};

export function chipClass(tone: ChipTone) {
  return `inline-block rounded-full border px-2 py-0.5 align-middle text-[11px] font-medium leading-none ${CHIP_TONES[tone]}`;
}

export function badgeClassFor(href: string): string | null {
  const m = href.match(/^#badge:(date|type):([^|]+)/);
  if (!m) return null;
  if (m[1] === "type") {
    return chipClass(m[2] === "cash_advance" ? "cash_advance" : "loan");
  }
  return chipClass(m[2] < overdueCutoffDateValue() ? "overdue" : "neutral");
}

export function createBadgeSpan(text: string, href: string) {
  const span = document.createElement("span");
  span.contentEditable = "false";
  span.className = badgeClassFor(href) ?? "";
  span.textContent = text;
  span.dataset.href = href;
  return span;
}

export function labelToFragment(
  label: string,
  borrowers: BorrowerSearchItem[],
) {
  const fragment = document.createDocumentFragment();
  const matches = parseMentions(label, borrowers);
  const byId = new Map(borrowers.map((b) => [b.id, b]));
  let idx = 0;
  for (const m of matches) {
    if (m.start > idx) {
      appendTextWithBreaks(fragment, label.slice(idx, m.start));
    }
    if (m.id) {
      fragment.appendChild(createMentionSpan(m.name, m.id, byId.get(m.id)));
      idx = m.end;
      continue;
    }
    const span = document.createElement("span");
    span.contentEditable = "false";
    span.className = (m.href && badgeClassFor(m.href)) ?? MENTION_PILL_CLASS;
    span.textContent = m.name;
    if (m.href) span.dataset.href = m.href;
    fragment.appendChild(span);
    idx = m.end;
  }
  if (idx < label.length) {
    appendTextWithBreaks(fragment, label.slice(idx));
  }
  return fragment;
}

export function appendTextWithBreaks(parent: Node, text: string) {
  const parts = text.split("\n");
  parts.forEach((part, i) => {
    parent.appendChild(document.createTextNode(part));
    if (i < parts.length - 1) {
      parent.appendChild(document.createTextNode("\n"));
    }
  });
}

export function serializeContent(el: HTMLElement): string {
  let result = "";
  const children = Array.from(el.childNodes);
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.tagName === "BR") {
        result += "\n";
      } else if (element.dataset.mention && element.textContent) {
        result += `[${element.textContent}](/borrowers/${element.dataset.mention})`;
      } else if (element.dataset.href && element.textContent) {
        result += `[${element.textContent}](${element.dataset.href})`;
      } else if (
        element.tagName === "DIV" ||
        element.tagName === "P" ||
        element.tagName === "PRE" ||
        element.tagName === "SPAN"
      ) {
        result += serializeContent(element);
        if (
          i < children.length - 1 &&
          (element.tagName === "DIV" ||
            element.tagName === "P" ||
            element.tagName === "PRE")
        ) {
          result += "\n";
        }
      } else {
        result += element.textContent ?? "";
      }
    }
  }
  return result;
}

export function getCaretOffset(container: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(container);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
}

export function setCaretOffset(container: HTMLElement, offset: number) {
  const selection = window.getSelection();
  const range = document.createRange();
  let currentOffset = 0;
  let found = false;

  function traverse(node: Node) {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0;
      if (currentOffset + len >= offset) {
        range.setStart(node, Math.max(0, offset - currentOffset));
        range.collapse(true);
        found = true;
      } else {
        currentOffset += len;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.contentEditable === "false") {
        const len = el.textContent?.length ?? 0;
        if (currentOffset + len >= offset) {
          const pos = offset - currentOffset;
          if (pos <= 0) {
            range.setStartBefore(el);
          } else {
            range.setStartAfter(el);
          }
          range.collapse(true);
          found = true;
        } else {
          currentOffset += len;
        }
        return;
      }
      for (const child of Array.from(node.childNodes)) {
        traverse(child);
        if (found) return;
      }
    }
  }

  traverse(container);
  if (!found) {
    range.selectNodeContents(container);
    range.collapse(false);
  }
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function getRangeForOffsets(
  container: HTMLElement,
  start: number,
  end: number,
): Range | null {
  const range = document.createRange();
  let currentOffset = 0;
  let startSet = false;
  let endSet = false;

  function traverse(node: Node) {
    if (endSet) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0;
      if (!startSet && currentOffset + len >= start) {
        range.setStart(node, Math.max(0, start - currentOffset));
        startSet = true;
      }
      if (startSet && currentOffset + len >= end) {
        range.setEnd(node, Math.max(0, end - currentOffset));
        endSet = true;
        return;
      }
      currentOffset += len;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.contentEditable === "false") {
        const len = el.textContent?.length ?? 0;
        if (!startSet && currentOffset + len >= start) {
          const pos = start - currentOffset;
          if (pos <= 0) range.setStartBefore(el);
          else range.setStartAfter(el);
          startSet = true;
        }
        if (startSet && currentOffset + len >= end) {
          const pos = end - currentOffset;
          if (pos <= 0) range.setEndBefore(el);
          else range.setEndAfter(el);
          endSet = true;
          return;
        }
        currentOffset += len;
        return;
      }
      for (const child of Array.from(node.childNodes)) {
        traverse(child);
        if (endSet) return;
      }
    }
  }

  traverse(container);
  if (!startSet) return null;
  if (!endSet) {
    range.setEnd(range.startContainer, range.startOffset);
  }
  return range;
}

export function insertNodeAtCaret(node: Node): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return range;
}
