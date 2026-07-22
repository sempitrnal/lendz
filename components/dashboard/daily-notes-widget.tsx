"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Settings,
  Check,
  Trash2,
  ChevronDown,
  Pencil,
  Plus,
  MoreHorizontal,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBorrowersSearch } from "@/hooks/use-borrowers-search";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";

type ChecklistCategory = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

type DailyChecklistItem = {
  id: string;
  checklist_date: string;
  label: string;
  is_checked: boolean;
  sort_order: number;
  created_at: string;
  category_id: string | null;
  daily_checklist_categories: ChecklistCategory | null;
};

function todayDateValue() {
  return new Date().toLocaleDateString("en-CA");
}

/** Lighten a hex color to a soft tint on white */
function tintColor(hex: string, opacity = 0.08): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const blend = (c: number) => Math.round(c * opacity + 255 * (1 - opacity));
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
}

/** Darken a hex color by mixing with dark surface (#161b22) */
function darkTintColor(hex: string, opacity = 0.15): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const bgR = 22,
    bgG = 27,
    bgB = 34;
  const blend = (c: number, bg: number) =>
    Math.round(c * opacity + bg * (1 - opacity));
  return `rgb(${blend(r, bgR)}, ${blend(g, bgG)}, ${blend(b, bgB)})`;
}

function LinkedLabel({
  label,
  checked,
  borrowers,
}: {
  label: string;
  checked: boolean;
  borrowers: BorrowerSearchItem[];
}) {
  const names = useMemo(() => {
    return new Map(borrowers.map((b) => [`${b.first_name} ${b.last_name}`, b]));
  }, [borrowers]);

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(label)) !== null) {
    if (match.index > lastIndex) {
      parts.push(label.slice(lastIndex, match.index));
    }
    parts.push(
      <MentionPill
        key={match.index}
        name={match[1]}
        href={match[2]}
        checked={checked}
      />,
    );
    lastIndex = regex.lastIndex;
  }
  const tail = label.slice(lastIndex);
  if (tail) {
    let offset = 0;
    names.forEach((borrower, name) => {
      const idx = tail.indexOf(name, offset);
      if (idx !== -1) {
        if (idx > offset) {
          parts.push(tail.slice(offset, idx));
        }
        parts.push(
          <MentionPill
            key={`${borrower.id}-${idx}`}
            name={name}
            href={`/borrowers/${borrower.id}`}
            checked={checked}
          />,
        );
        offset = idx + name.length;
      }
    });
    if (offset < tail.length) {
      parts.push(tail.slice(offset));
    }
  }
  return <>{parts}</>;
}

function MentionPill({
  name,
  href,
  checked,
}: {
  name: string;
  href: string;
  checked: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch
      onClick={(e) => e.stopPropagation()}
      className={`inline-block rounded-md border px-1.5 py-0.5 text-xs
        font-medium leading-none transition-opacity hover:opacity-70 ${
          checked
            ? `border-slate-200 text-slate-400 dark:border-muted-foreground/30
              dark:text-muted-foreground/60`
            : `border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800
              dark:bg-sky-900/20 dark:text-sky-300`
        }`}
    >
      {name}
    </Link>
  );
}

const MENTION_PILL_CLASS =
  "inline-block rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-xs font-medium text-sky-700 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300";

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractBorrowerId(href: string): string | null {
  const match = href.match(/\/borrowers\/([^/]+)$/);
  return match?.[1] ?? null;
}

type MentionSegment = {
  start: number;
  end: number;
  name: string;
  id: string | null;
  href: string | null;
};

function parseMentions(
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

function labelToFragment(label: string, borrowers: BorrowerSearchItem[]) {
  const fragment = document.createDocumentFragment();
  const matches = parseMentions(label, borrowers);
  let idx = 0;
  for (const m of matches) {
    if (m.start > idx) {
      appendTextWithBreaks(fragment, label.slice(idx, m.start));
    }
    const span = document.createElement("span");
    span.contentEditable = "false";
    span.className = MENTION_PILL_CLASS;
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

function appendTextWithBreaks(parent: Node, text: string) {
  const parts = text.split("\n");
  parts.forEach((part, i) => {
    parent.appendChild(document.createTextNode(part));
    if (i < parts.length - 1) {
      parent.appendChild(document.createElement("br"));
    }
  });
}

function serializeContent(el: HTMLElement): string {
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

function formatChecklistDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getCaretOffset(container: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(container);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
}

function setCaretOffset(container: HTMLElement, offset: number) {
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

function insertNodeAtCaret(node: Node): Range | null {
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

function readableColor(hex: string, isDark: boolean): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (isDark) {
    // In dark mode, lighten the color for readability
    const lighten = (c: number) => Math.round(c + (255 - c) * 0.3);
    return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
  }
  // In light mode, darken for readability
  if (luminance > 0.6) {
    const darken = (c: number) => Math.round(c * 0.55);
    return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
  }
  return hex;
}

type ChecklistInputHandle = {
  getValue: () => string;
  submit: () => void;
  clear: () => void;
  focus: () => void;
};

type ChecklistInputProps = {
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  borrowers: BorrowerSearchItem[];
  showPesoButton?: boolean;
  autoFocus?: boolean;
  className?: string;
};

const ChecklistInput = forwardRef<ChecklistInputHandle, ChecklistInputProps>(
  (
    {
      defaultValue = "",
      onChange,
      onSubmit,
      placeholder,
      borrowers,
      showPesoButton = false,
      autoFocus = false,
      className,
    },
    ref,
  ) => {
    const innerRef = useRef<HTMLPreElement>(null);
    const [focused, setFocused] = useState(false);
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionStart, setMentionStart] = useState<number | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const isMobile = useMemo(
      () =>
        /iPad|iPhone|iPod|Android/.test(navigator.userAgent) &&
        !(window as any).MSStream,
      [],
    );

    useImperativeHandle(ref, () => ({
      getValue: () =>
        innerRef.current ? serializeContent(innerRef.current) : "",
      submit: () => {
        const el = innerRef.current;
        if (!el || !onSubmit) return;
        const value = serializeContent(el).trim();
        if (!value) return;
        onSubmit(value);
        el.innerHTML = "";
        onChange?.("");
      },
      clear: () => {
        const el = innerRef.current;
        if (!el) return;
        el.innerHTML = "";
        onChange?.("");
      },
      focus: () => innerRef.current?.focus(),
    }));

    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      el.innerHTML = "";
      if (defaultValue) {
        el.appendChild(labelToFragment(defaultValue, borrowers));
      }
      const text = el.textContent ?? "";
      onChange?.(text);
      setMentionOpen(false);
      setMentionQuery("");
      setMentionStart(null);
    }, [defaultValue, borrowers]);

    useEffect(() => {
      if (autoFocus) innerRef.current?.focus();
    }, [autoFocus]);

    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (
          wrapperRef.current &&
          !wrapperRef.current.contains(e.target as Node)
        ) {
          setMentionOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, []);

    const mentionSuggestions = useMemo(() => {
      const q = mentionQuery.toLowerCase();
      if (!q) return borrowers.slice(0, 6);
      return borrowers
        .filter(
          (b) =>
            b.first_name.toLowerCase().includes(q) ||
            b.last_name.toLowerCase().includes(q) ||
            `${b.first_name} ${b.last_name}`.toLowerCase().includes(q),
        )
        .slice(0, 6);
    }, [borrowers, mentionQuery]);

    const insertPeso = () => {
      const el = innerRef.current;
      if (!el) return;
      el.focus();
      insertNodeAtCaret(document.createTextNode("₱"));
      const text = el.textContent ?? "";
      onChange?.(text);
      detectMention(text, getCaretOffset(el));
    };

    const detectMention = (text: string, cursor: number) => {
      const textBeforeCursor = text.slice(0, cursor);
      const atIndex = textBeforeCursor.lastIndexOf("@");
      if (atIndex === -1) {
        setMentionOpen(false);
        setMentionQuery("");
        setMentionStart(null);
        return;
      }
      const query = textBeforeCursor.slice(atIndex + 1);
      if (/\s/.test(query)) {
        setMentionOpen(false);
        setMentionQuery("");
        setMentionStart(null);
        return;
      }
      setMentionOpen(true);
      setMentionQuery(query);
      setMentionStart(atIndex);
      setMentionIndex(0);
    };

    const insertMention = (borrower: BorrowerSearchItem) => {
      if (mentionStart === null) return;
      const el = innerRef.current;
      if (!el) return;
      const label = `${borrower.first_name} ${borrower.last_name}`;
      const span = document.createElement("span");
      span.contentEditable = "false";
      span.className = MENTION_PILL_CLASS;
      span.textContent = label;
      span.dataset.mention = borrower.id;

      el.focus();
      setCaretOffset(el, mentionStart);
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const startRange = selection.getRangeAt(0);
        setCaretOffset(el, mentionStart + 1 + mentionQuery.length);
        const endRange = selection.getRangeAt(0);
        const fullRange = document.createRange();
        fullRange.setStart(startRange.startContainer, startRange.startOffset);
        fullRange.setEnd(endRange.endContainer, endRange.endOffset);
        fullRange.deleteContents();
        fullRange.insertNode(span);
        const afterSpan = document.createRange();
        afterSpan.setStartAfter(span);
        afterSpan.setEndAfter(span);
        afterSpan.insertNode(document.createTextNode(" "));
        afterSpan.collapse(false);
        el.focus();
        selection.removeAllRanges();
        selection.addRange(afterSpan);
      } else {
        const fallback = insertNodeAtCaret(span);
        if (fallback) {
          const afterSpan = document.createRange();
          afterSpan.setStartAfter(span);
          afterSpan.setEndAfter(span);
          afterSpan.insertNode(document.createTextNode(" "));
          afterSpan.collapse(false);
          el.focus();
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(afterSpan);
        }
      }

      const text = el.textContent ?? "";
      onChange?.(text);
      setMentionOpen(false);
      setMentionQuery("");
      setMentionStart(null);
    };

    const handleInput = () => {
      const el = innerRef.current;
      if (!el) return;
      const text = el.textContent ?? "";
      onChange?.(text);
      detectMention(text, getCaretOffset(el));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLPreElement>) => {
      if (mentionOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIndex((i) =>
            Math.min(i + 1, mentionSuggestions.length - 1),
          );
          return;
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex((i) => Math.max(i - 1, 0));
          return;
        } else if (e.key === "Enter") {
          e.preventDefault();
          const selected = mentionSuggestions[mentionIndex];
          if (selected) insertMention(selected);
          return;
        } else if (e.key === "Escape") {
          setMentionOpen(false);
          return;
        }
      }

      if (isMobile && (e.key === "Enter" || e.keyCode === 13)) {
        e.preventDefault();
        const el = innerRef.current;
        if (el) {
          insertNodeAtCaret(document.createElement("br"));
          handleInput();
        }
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const el = innerRef.current;
        if (!el || !onSubmit) return;
        const value = serializeContent(el).trim();
        if (value) {
          onSubmit(value);
          el.innerHTML = "";
          onChange?.("");
        }
      }
    };

    return (
      <div ref={wrapperRef} className="relative flex flex-col gap-1">
        {showPesoButton && focused && (
          <div className="flex items-center justify-start">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertPeso()}
              className="rounded-md border border-border/50 bg-white px-2 py-1
                text-xs font-semibold text-slate-600 shadow-sm transition-colors
                hover:bg-slate-50 dark:bg-card dark:text-slate-300"
            >
              ₱
            </button>
          </div>
        )}
        <pre
          ref={innerRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            if (
              e.relatedTarget &&
              wrapperRef.current?.contains(e.relatedTarget as Node)
            ) {
              innerRef.current?.focus();
              return;
            }
            setFocused(false);
          }}
          className={`dark:bg-card/50 dark:text-foreground min-h-[40px] w-full
            whitespace-pre-wrap rounded-xl border border-border/50 bg-white/60
            px-3 py-2 text-base font-sans text-slate-700 transition-all
            duration-200 empty:before:text-slate-400
            empty:before:content-[attr(data-placeholder)] focus:border-border
            focus:outline-none dark:empty:before:text-muted-foreground
            ${className ?? ""}`}
          data-placeholder={placeholder ?? ""}
          role="textbox"
          aria-multiline="true"
        />
        {mentionOpen && mentionSuggestions.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full z-9999 mt-1 max-h-48
              overflow-auto rounded-xl border border-border/50 bg-white p-1
              shadow-md dark:bg-card"
          >
            {mentionSuggestions.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  innerRef.current?.focus();
                  insertMention(b);
                }}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm
                transition-colors ${
                  i === mentionIndex
                    ? "bg-slate-100 dark:bg-muted"
                    : "hover:bg-slate-50 dark:hover:bg-muted/50"
                }`}
              >
                <span
                  className="font-medium text-slate-700 dark:text-foreground"
                >
                  {b.first_name} {b.last_name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);
ChecklistInput.displayName = "ChecklistInput";

function CategorySection({
  category,
  items,
  date,
  onAdd,
  onToggle,
  onDelete,
  onEditLabel,
}: {
  category: ChecklistCategory | null;
  items: DailyChecklistItem[];
  date: string;
  onAdd: (
    label: string,
    categoryId: string | null,
    date: string,
  ) => Promise<void>;
  onToggle: (item: DailyChecklistItem) => void;
  onDelete: (id: string) => void;
  onEditLabel: (itemId: string, newLabel: string) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<DailyChecklistItem | null>(
    null,
  );
  const [editLabelValue, setEditLabelValue] = useState("");
  const addInputRef = useRef<ChecklistInputHandle>(null);
  const editInputRef = useRef<ChecklistInputHandle>(null);
  const [expanded, setExpanded] = useState(true);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { data: borrowers = [] } = useBorrowersSearch();

  const checkedCount = items.filter((i) => i.is_checked).length;

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return b.created_at.localeCompare(a.created_at);
      }),
    [items],
  );

  const handleAdd = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    await onAdd(trimmed, category?.id ?? null, date);
    setSaving(false);
    setNewLabel("");
    addInputRef.current?.clear();
  };

  const handleEditSave = (value: string) => {
    if (!editingItem) return;
    const trimmed = value.trim();
    if (trimmed) onEditLabel(editingItem.id, trimmed);
    setEditingItem(null);
    setEditLabelValue("");
  };

  useEffect(() => {
    if (editingItem) setEditLabelValue(editingItem.label);
  }, [editingItem]);

  const catColor = category?.color;
  const bgColor = catColor
    ? isDark
      ? darkTintColor(catColor, 0.08)
      : tintColor(catColor, 0.05)
    : undefined;
  const pillBg = catColor
    ? isDark
      ? darkTintColor(catColor, 0.2)
      : tintColor(catColor, 0.12)
    : undefined;
  const pillText = catColor ? readableColor(catColor, isDark) : undefined;
  const pillBorder = catColor
    ? isDark
      ? `${catColor}30`
      : `${catColor}25`
    : undefined;

  return (
    <div
      className="border-border/50 p-2 transition-all duration-200 sm:p-5"
      style={{
        backgroundColor: bgColor ?? undefined,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`flex w-full items-center gap-2.5 ${expanded ? "mb-3" : ""}`}
      >
        {category ? (
          <span
            className="inline-flex shrink-0 items-center rounded-full px-2.5
              py-0.5 text-xs font-semibold"
            style={{
              backgroundColor: pillBg ?? undefined,
              color: pillText ?? undefined,
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: pillBorder ?? undefined,
            }}
          >
            {category.name}
          </span>
        ) : (
          <span
            className="dark:text-muted-foreground shrink-0 text-xs font-semibold
              text-slate-400"
          >
            Uncategorized
          </span>
        )}
        <span
          className="dark:text-muted-foreground text-xs font-medium
            text-slate-400 tabular-nums"
        >
          {checkedCount}/{items.length}
        </span>
        <ChevronDown
          className={`dark:text-muted-foreground ml-auto size-4 text-slate-400
            transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <>
          <div className="mb-4 flex flex-col gap-2">
            <ChecklistInput
              ref={addInputRef}
              defaultValue=""
              onChange={setNewLabel}
              onSubmit={handleAdd}
              placeholder={`Add item${category ? ` to ${category.name}` : ""}…`}
              borrowers={borrowers}
              showPesoButton
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addInputRef.current?.submit()}
              disabled={saving || !newLabel.trim()}
              className="dark:text-foreground dark:hover:bg-muted/60 shrink-0
                self-start rounded-lg px-3 py-1.5 text-xs font-semibold
                text-slate-600 bg-white dark:bg-slate-800 transition-all
                duration-200 hover:bg-slate-100 disabled:opacity-40"
            >
              {saving ? "Adding…" : "Add item"}
            </button>
          </div>

          {sorted.length === 0 ? (
            <div
              className="dark:text-muted-foreground flex flex-col items-center
                gap-2 py-8 text-center"
            >
              <p className="text-sm text-slate-400">
                No items in this category yet.
              </p>
            </div>
          ) : (
            <ul className="space-y-[8px]">
              {sorted.map((item) => (
                <li
                  key={item.id}
                  onClick={() => onToggle(item)}
                  className={`group flex cursor-pointer items-center gap-3
                    rounded-xl pl-4 border px-2 py-2 transition-all duration-200
                    ${
                      item.is_checked
                        ? `bg-slate-50 dark:border-muted-foreground/30
                          dark:bg-muted/80`
                        : `bg-white shadow-sm hover:bg-slate-100
                          dark:border-muted-foreground/20 dark:bg-muted
                          dark:hover:bg-muted/40`
                    }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(item);
                    }}
                    title={item.is_checked ? "Uncheck" : "Check"}
                    className={`shrink-0 rounded-full border-2 p-0
                      transition-all duration-200 ${
                        item.is_checked
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : `border-slate-300 text-transparent
                            hover:border-emerald-400
                            dark:border-muted-foreground/40`
                      }`}
                    aria-label={item.is_checked ? "Uncheck" : "Check"}
                  >
                    <Check className="size-2" strokeWidth={2} />
                  </button>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <span
                      className={`block text-sm font-medium break-words
                        whitespace-pre-wrap transition-all duration-200 ${
                          item.is_checked
                            ? `text-slate-400 line-through
                              dark:text-muted-foreground/60`
                            : "text-slate-700 dark:text-foreground"
                        }`}
                    >
                      <LinkedLabel
                        label={item.label}
                        checked={item.is_checked}
                        borrowers={borrowers}
                      />
                    </span>
                    <span
                      className="block text-[10px] text-slate-400
                        dark:text-muted-foreground/60"
                    >
                      {formatChecklistDate(item.created_at)}
                    </span>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenFor(
                          menuOpenFor === item.id ? null : item.id,
                        );
                      }}
                      className="rounded-lg p-1.5 text-slate-400
                        transition-colors duration-200 hover:bg-slate-100
                        hover:text-slate-600 dark:text-muted-foreground
                        dark:hover:bg-muted/60 dark:hover:text-foreground"
                      aria-label="More options"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                    {menuOpenFor === item.id && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenFor(null);
                          }}
                        />
                        <div
                          className="absolute right-0 top-full z-50 mt-1 flex
                            flex-col gap-0.5 rounded-xl border border-border/50
                            bg-background p-1 shadow-lg dark:bg-card"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setEditLabelValue(item.label);
                              setMenuOpenFor(null);
                            }}
                            className="flex items-center gap-2 rounded-lg px-3
                              py-1.5 text-xs font-medium text-slate-600
                              transition-colors duration-200 hover:bg-slate-100
                              dark:text-muted-foreground dark:hover:bg-muted/60
                              dark:hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(item.id);
                              setMenuOpenFor(null);
                            }}
                            className="flex items-center gap-2 rounded-lg px-3
                              py-1.5 text-xs font-medium text-rose-500
                              transition-colors duration-200 hover:bg-rose-50
                              dark:hover:bg-rose-900/20
                              dark:hover:text-rose-400"
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Dialog
        open={!!editingItem}
        onOpenChange={(v) => {
          if (!v) setEditingItem(null);
        }}
      >
        <DialogContent className="overflow-visible! sm:max-w-md">
          <DialogHeader className="gap-3 pb-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full
                bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40
                dark:text-indigo-300"
            >
              <Pencil className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Edit Item
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Update the label for this checklist item.
              </DialogDescription>
            </div>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4 pt-2">
              <div>
                <label
                  className="dark:text-muted-foreground mb-1.5 block text-xs
                    font-medium text-slate-500"
                >
                  Label
                </label>
                <ChecklistInput
                  key={editingItem.id}
                  ref={editInputRef}
                  defaultValue={editingItem.label}
                  onChange={setEditLabelValue}
                  onSubmit={handleEditSave}
                  placeholder="Edit item label…"
                  borrowers={borrowers}
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditingItem(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => editInputRef.current?.submit()}
                  disabled={!editLabelValue.trim()}
                >
                  Save
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DailyNotesWidget() {
  const [items, setItems] = useState<DailyChecklistItem[]>([]);
  const [categories, setCategories] = useState<ChecklistCategory[]>([]);
  const [date, setDate] = useState(todayDateValue());
  const [loading, setLoading] = useState(true);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("daily_checklist_categories")
      .select("id, name, color, sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(error.message);
      return;
    }
    setCategories((data ?? []) as ChecklistCategory[]);
  };

  const loadItems = async (targetDate: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("daily_checklist_items")
      .select(
        "id, checklist_date, label, is_checked, sort_order, created_at, category_id, daily_checklist_categories(id, name, color, sort_order)",
      )
      .eq("checklist_date", targetDate)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const normalized = (data ?? []).map((row: Record<string, unknown>) => {
      const cat = row.daily_checklist_categories as
        | ChecklistCategory
        | null
        | unknown[];
      return {
        ...(row as DailyChecklistItem),
        daily_checklist_categories:
          Array.isArray(cat) && cat.length > 0
            ? (cat[0] as ChecklistCategory)
            : cat && !Array.isArray(cat)
              ? (cat as ChecklistCategory)
              : null,
      };
    }) as DailyChecklistItem[];

    setItems(normalized);
    setLoading(false);
  };

  useEffect(() => {
    void loadCategories();
    void loadItems(date);
  }, [date]);

  const editItemLabel = (itemId: string, newLabel: string) => {
    setItems((prev) =>
      prev.map((row) =>
        row.id === itemId ? { ...row, label: newLabel } : row,
      ),
    );

    supabase
      .from("daily_checklist_items")
      .update({ label: newLabel })
      .eq("id", itemId)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          toast.error(error.message);
        }
      });
  };

  const addItem = async (
    label: string,
    categoryId: string | null,
    targetDate: string,
  ) => {
    const catItems = items.filter((i) => i.category_id === categoryId);
    const minSort = catItems.reduce((min, i) => Math.min(min, i.sort_order), 0);
    const newSort = minSort - 1;
    const tempId = crypto.randomUUID();
    const cat = categories.find((c) => c.id === categoryId) ?? null;

    const optimistic: DailyChecklistItem = {
      id: tempId,
      checklist_date: targetDate,
      label,
      is_checked: false,
      sort_order: newSort,
      created_at: new Date().toISOString(),
      category_id: categoryId,
      daily_checklist_categories: cat,
    };

    setItems((prev) => [optimistic, ...prev]);

    const insertPayload: Record<string, unknown> = {
      checklist_date: targetDate,
      label,
      is_checked: false,
      sort_order: newSort,
    };
    if (categoryId) insertPayload.category_id = categoryId;

    const { data, error } = await supabase
      .from("daily_checklist_items")
      .insert(insertPayload)
      .select(
        "id, checklist_date, label, is_checked, sort_order, created_at, category_id",
      )
      .single();

    if (error) {
      toast.error(error.message);
      setItems((prev) => prev.filter((i) => i.id !== tempId));
      return;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.id === tempId
          ? { ...i, id: data.id, created_at: data.created_at }
          : i,
      ),
    );
  };

  const toggleItem = (item: DailyChecklistItem) => {
    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, is_checked: !row.is_checked } : row,
      ),
    );

    supabase
      .from("daily_checklist_items")
      .update({ is_checked: !item.is_checked })
      .eq("id", item.id)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          toast.error(error.message);
          setItems((prev) =>
            prev.map((row) =>
              row.id === item.id
                ? { ...row, is_checked: item.is_checked }
                : row,
            ),
          );
        }
      });
  };

  const deleteItem = (id: string) => {
    const removed = items.find((i) => i.id === id);
    setItems((prev) => prev.filter((i) => i.id !== id));

    supabase
      .from("daily_checklist_items")
      .delete()
      .eq("id", id)
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          toast.error(error.message);
          if (removed) setItems((prev) => [...prev, removed]);
        }
      });
  };

  const grouped = useMemo(() => {
    const map = new Map<string | null, DailyChecklistItem[]>();
    for (const item of items) {
      const key = item.category_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [items]);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div
        className="sticky top-4 z-10 flex items-center justify-between gap-3
          rounded-2xl border border-border/50 bg-background/80 p-3
          backdrop-blur-md"
      >
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="dark:bg-card/50 dark:text-foreground min-w-0 flex-1
            rounded-xl border border-border/50 bg-white/60 px-3 py-2 text-sm
            font-medium text-slate-700 transition-all duration-200
            focus:border-border focus:outline-none"
        />
        <Link
          href="/daily-checklist/categories"
          className="dark:text-muted-foreground dark:hover:bg-muted/60
            inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2
            text-xs font-semibold text-slate-600 transition-all duration-200
            hover:bg-slate-100"
          aria-label="Manage categories"
        >
          <Settings className="size-4" />
          <span className="hidden sm:inline">Categories</span>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/50 p-4 sm:p-5"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="h-5 w-20 animate-pulse rounded-full bg-slate-200
                    dark:bg-muted/60"
                />
                <div
                  className="h-4 w-10 animate-pulse rounded-full bg-slate-100
                    dark:bg-muted/40"
                />
                <div
                  className="ml-auto h-4 w-4 animate-pulse rounded-full
                    bg-slate-100 dark:bg-muted/40"
                />
              </div>
              <div className="mt-4 space-y-2">
                <div
                  className="h-8 animate-pulse rounded-xl bg-slate-100
                    dark:bg-muted/30"
                />
                <div
                  className="h-8 animate-pulse rounded-xl bg-slate-100
                    dark:bg-muted/30"
                />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 && categories.length === 0 ? (
        <div
          className="dark:text-muted-foreground flex flex-col items-center gap-3
            rounded-2xl border border-border/50 py-16 text-center"
        >
          <div
            className="flex size-12 items-center justify-center rounded-full
              bg-slate-100 dark:bg-muted/40"
          >
            <Plus className="size-6 text-slate-400" />
          </div>
          <div>
            <p
              className="text-sm font-semibold text-slate-600
                dark:text-foreground"
            >
              No categories yet
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Create a category to start organizing your tasks
            </p>
          </div>
          <Link
            href="/daily-checklist/categories"
            className="mt-1 rounded-lg bg-slate-900 px-4 py-2 text-xs
              font-semibold text-white transition-colors duration-200
              hover:bg-slate-700 dark:bg-foreground dark:text-background
              dark:hover:bg-foreground/80"
          >
            Create category
          </Link>
        </div>
      ) : (
        <>
          {categories.map((cat) => (
            <CategorySection
              key={cat.id}
              category={cat}
              items={grouped.get(cat.id) ?? []}
              date={date}
              onAdd={addItem}
              onToggle={toggleItem}
              onDelete={deleteItem}
              onEditLabel={editItemLabel}
            />
          ))}
        </>
      )}
    </div>
  );
}
