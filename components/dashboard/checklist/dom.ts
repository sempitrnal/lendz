import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import { parseMentions } from "@/lib/checklist/labels";
import { overdueCutoffDateValue } from "@/lib/checklist/dates";

export const MENTION_PILL_CLASS =
  "inline-block rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-xs font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300";

export function badgeClassFor(href: string): string | null {
  const m = href.match(/^#badge:(date|type):([^|]+)/);
  if (!m) return null;
  const base =
    "inline-block  rounded border px-1 py-px align-middle text-[9px] font-semibold leading-none";
  if (m[1] === "type") {
    return m[2] === "cash_advance"
      ? `${base} lowercase border-amber-300/60 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200`
      : `${base} lowercase border-violet-300/60 bg-violet-100 text-violet-800 dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-200`;
  }
  return m[2] < overdueCutoffDateValue()
    ? `${base} border-rose-300/60 bg-rose-100 text-rose-700 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-200`
    : `${base} border-slate-300/70 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300`;
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
  let idx = 0;
  for (const m of matches) {
    if (m.start > idx) {
      appendTextWithBreaks(fragment, label.slice(idx, m.start));
    }
    const span = document.createElement("span");
    span.contentEditable = "false";
    span.className = (m.href && badgeClassFor(m.href)) ?? MENTION_PILL_CLASS;
    span.textContent = m.name;
    if (m.id) span.dataset.mention = m.id;
    else if (m.href) span.dataset.href = m.href;
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
