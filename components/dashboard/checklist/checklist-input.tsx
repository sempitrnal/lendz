"use client";

import {
  Fragment,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import {
  MENTION_PILL_CLASS,
  createBadgeSpan,
  getCaretOffset,
  getRangeForOffsets,
  insertNodeAtCaret,
  labelToFragment,
  serializeContent,
  setCaretOffset,
} from "@/components/dashboard/checklist/dom";
import {
  formatShortDate,
  parseExistingNext,
  rewriteNextBlock,
  type NextCollectionItem,
} from "@/lib/checklist/labels";
import { overdueCutoffDateValue } from "@/lib/checklist/dates";

export type ChecklistInputHandle = {
  getValue: () => string;
  submit: () => void;
  clear: () => void;
  focus: () => void;
  openNext: () => void;
};

export type ChecklistInputProps = {
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  borrowers: BorrowerSearchItem[];
  showPesoButton?: boolean;
  autoFocus?: boolean;
  className?: string;
  getBorrowerNextAmounts?: (
    borrowerId: string,
  ) => Promise<NextCollectionItem[]>;
};

export const ChecklistInput = forwardRef<
  ChecklistInputHandle,
  ChecklistInputProps
>(
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
      getBorrowerNextAmounts,
    },
    ref,
  ) => {
    const innerRef = useRef<HTMLDivElement>(null);
    const [focused, setFocused] = useState(false);
    const [mentionOpen, setMentionOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionStart, setMentionStart] = useState<number | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const lastMentionedBorrowerRef = useRef<string | null>(null);
    const isProcessingNextRef = useRef(false);
    const [nextOpen, setNextOpen] = useState(false);
    const [nextLoading, setNextLoading] = useState(false);
    const [nextItems, setNextItems] = useState<NextCollectionItem[]>([]);
    const [nextIndex, setNextIndex] = useState(0);
    const [nextSelected, setNextSelected] = useState<Set<number>>(new Set());
    const nextTokenStartRef = useRef<number | null>(null);
    const tokenlessRef = useRef(false);
    const nextDropdownRef = useRef<HTMLDivElement>(null);
    const [nextAnchor, setNextAnchor] = useState<{
      top?: number;
      bottom?: number;
      left: number;
      width: number;
      maxHeight: number;
    } | null>(null);
    const nextTotal = nextItems.reduce((sum, i) => sum + i.amount, 0);
    const isMobile = useMemo(
      () =>
        /iPad|iPhone|iPod|Android/.test(navigator.userAgent) &&
        !(window as any).MSStream,
      [],
    );

    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      el.innerHTML = "";
      if (defaultValue) {
        el.appendChild(labelToFragment(defaultValue, borrowers));
      }
      const pills = el.querySelectorAll("[data-mention]");
      lastMentionedBorrowerRef.current = pills.length
        ? ((pills[pills.length - 1] as HTMLElement).dataset.mention ?? null)
        : null;
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
        const target = e.target as Node;
        if (
          wrapperRef.current &&
          !wrapperRef.current.contains(target) &&
          !nextDropdownRef.current?.contains(target)
        ) {
          setMentionOpen(false);
          setNextOpen(false);
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
      lastMentionedBorrowerRef.current = borrower.id;
      const label = `${borrower.first_name} ${borrower.last_name}`;
      const span = document.createElement("span");
      span.contentEditable = "false";
      span.className = MENTION_PILL_CLASS;
      span.textContent = label.toLowerCase();
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

    const replaceNextToken = (insertNode: Node | null) => {
      const el = innerRef.current;
      if (!el) return;
      const text = el.textContent ?? "";
      let start = nextTokenStartRef.current ?? -1;
      if (start < 0 || text.slice(start, start + 5) !== "/next") {
        start = text.indexOf("/next");
      }
      if (start === -1) return;
      let end = start + 5;
      if (start > 0 && /\s/.test(text[start - 1])) start -= 1;
      if (end < text.length && /\s/.test(text[end])) end += 1;
      const range = getRangeForOffsets(el, start, end);
      if (!range) return;
      range.deleteContents();
      if (insertNode) {
        const insertLen = insertNode.textContent?.length ?? 0;
        range.insertNode(insertNode);
        setCaretOffset(el, start + insertLen);
      }
      onChange?.(el.textContent ?? "");
    };

    const openNextDropdown = async (matchStart: number | null) => {
      const borrowerId = lastMentionedBorrowerRef.current;
      if (!getBorrowerNextAmounts || !borrowerId) return;
      const el = innerRef.current;
      if (!el) return;
      isProcessingNextRef.current = true;
      nextTokenStartRef.current = matchStart;
      tokenlessRef.current = matchStart === null;
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;
      setNextAnchor(
        openUp
          ? {
              bottom: window.innerHeight - rect.top + 4,
              left: rect.left,
              width: rect.width,
              maxHeight: Math.min(spaceAbove - 12, 320),
            }
          : {
              top: rect.bottom + 4,
              left: rect.left,
              width: rect.width,
              maxHeight: Math.min(spaceBelow - 12, 320),
            },
      );
      setNextItems([]);
      setNextSelected(new Set());
      setNextIndex(0);
      setNextLoading(true);
      setNextOpen(true);
      try {
        const fetched = await getBorrowerNextAmounts(borrowerId);
        const present = parseExistingNext(serializeContent(el));
        const presentIds = new Set(present.map((p) => p.id));
        const fetchedIds = new Set(fetched.map((f) => f.id));
        const items = [
          ...fetched.map((f) => ({ ...f, existing: presentIds.has(f.id) })),
          ...present.filter((p) => !fetchedIds.has(p.id)),
        ].sort(
          (a, b) =>
            a.due_date.localeCompare(b.due_date) ||
            a.type.localeCompare(b.type),
        );
        if (!items.length) {
          setNextOpen(false);
          if (!tokenlessRef.current) replaceNextToken(null);
          toast.info("No pending collections");
        } else {
          setNextItems(items);
          setNextSelected(
            new Set(items.flatMap((item, i) => (item.existing ? [i] : []))),
          );
        }
      } catch (err) {
        console.error("openNextDropdown error:", err);
        setNextOpen(false);
        toast.error("Failed to load next collection amounts");
      } finally {
        setNextLoading(false);
        isProcessingNextRef.current = false;
        const text = el.textContent ?? "";
        onChange?.(text);
        detectMention(text, getCaretOffset(el));
      }
    };

    const openNextFromButton = () => {
      if (!getBorrowerNextAmounts) return;
      const el = innerRef.current;
      if (!el) return;
      if (nextOpen) {
        setNextOpen(false);
        return;
      }
      const pills = el.querySelectorAll("[data-mention]");
      lastMentionedBorrowerRef.current = pills.length
        ? ((pills[pills.length - 1] as HTMLElement).dataset.mention ?? null)
        : null;
      if (!lastMentionedBorrowerRef.current) {
        toast.info("Mention a borrower first (@name)");
        return;
      }
      if (!isMobile) el.focus();
      void openNextDropdown(null);
    };

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
      openNext: () => openNextFromButton(),
    }));

    const toggleNextItem = (index: number) => {
      setNextSelected((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    };

    const toggleNextAll = () => {
      setNextSelected((prev) =>
        prev.size === nextItems.length
          ? new Set()
          : new Set(nextItems.map((_, i) => i)),
      );
    };

    const insertNextItems = (selected: NextCollectionItem[]) => {
      const useRewrite =
        tokenlessRef.current || nextItems.some((item) => item.existing);
      if (useRewrite) {
        const el = innerRef.current;
        const next = el
          ? rewriteNextBlock(serializeContent(el), selected)
          : null;
        if (el && next !== null) {
          el.innerHTML = "";
          el.appendChild(labelToFragment(next, borrowers));
          setCaretOffset(el, (el.textContent ?? "").length);
          const pills = el.querySelectorAll("[data-mention]");
          lastMentionedBorrowerRef.current = pills.length
            ? ((pills[pills.length - 1] as HTMLElement).dataset.mention ?? null)
            : null;
          onChange?.(el.textContent ?? "");
        }
        setNextOpen(false);
        setNextItems([]);
        setNextSelected(new Set());
        return;
      }
      if (!selected.length) return;
      const frag = document.createDocumentFragment();
      frag.appendChild(document.createTextNode("\n"));
      selected.forEach((item, i) => {
        if (i > 0) frag.appendChild(document.createTextNode("\n"));
        frag.appendChild(
          document.createTextNode(`₱${item.amount.toLocaleString()}`),
        );
        const hasDate = Boolean(item.due_date);
        const typeOk = item.type === "loan" || item.type === "cash_advance";
        if (!hasDate && !typeOk) return;
        if (!hasDate || !typeOk) {
          const bits = [
            hasDate ? formatShortDate(item.due_date) : "",
            typeOk
              ? item.type === "cash_advance"
                ? "Cash Advance"
                : "Loan"
              : "",
          ].filter(Boolean);
          frag.appendChild(document.createTextNode(` (${bits.join(", ")})`));
          return;
        }
        frag.appendChild(document.createTextNode(" "));
        frag.appendChild(
          createBadgeSpan(
            formatShortDate(item.due_date),
            `#badge:date:${item.due_date}|${item.id}`,
          ),
        );
        frag.appendChild(document.createTextNode(" "));
        frag.appendChild(
          createBadgeSpan(
            item.type === "cash_advance" ? "CA" : "Loan",
            `#badge:type:${item.type}`,
          ),
        );
      });
      if (selected.length > 1) {
        const total = selected.reduce((sum, i) => sum + i.amount, 0);
        frag.appendChild(
          document.createTextNode(`\nTotal: ₱${total.toLocaleString()}`),
        );
      }
      replaceNextToken(frag);
      setNextOpen(false);
      setNextItems([]);
      setNextSelected(new Set());
    };

    const insertNextHighlightedOrSelected = () => {
      const selected = nextItems.filter((_, i) => nextSelected.has(i));
      if (selected.length || nextItems.some((item) => item.existing)) {
        insertNextItems(selected);
      } else {
        const hasAll = nextItems.length > 1;
        const item = nextItems[hasAll ? nextIndex - 1 : nextIndex];
        if (item) insertNextItems([item]);
      }
    };

    const detectSlashCommand = (text: string, cursor: number) => {
      if (
        isProcessingNextRef.current ||
        nextOpen ||
        !getBorrowerNextAmounts ||
        !lastMentionedBorrowerRef.current
      )
        return;
      const matches = [...text.matchAll(/\/next\b/g)];
      let target: RegExpMatchArray | null = null;
      for (const m of matches) {
        const mEnd = (m.index ?? 0) + m[0].length;
        if (mEnd <= cursor) target = m;
      }
      if (!target || target.index === undefined) return;
      void openNextDropdown(target.index);
    };

    const handleInput = () => {
      const el = innerRef.current;
      if (!el) return;
      const pills = el.querySelectorAll("[data-mention]");
      lastMentionedBorrowerRef.current = pills.length
        ? ((pills[pills.length - 1] as HTMLElement).dataset.mention ?? null)
        : null;
      const text = el.textContent ?? "";
      onChange?.(text);
      detectMention(text, getCaretOffset(el));
      detectSlashCommand(text, getCaretOffset(el));
      if (nextOpen && !text.includes("/next")) setNextOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (nextOpen) {
        if (e.key === "Escape") {
          setNextOpen(false);
          return;
        }
        if (nextLoading || !nextItems.length) return;
        const count = nextItems.length + (nextItems.length > 1 ? 1 : 0);
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setNextIndex((i) => Math.min(i + 1, count - 1));
          return;
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setNextIndex((i) => Math.max(i - 1, 0));
          return;
        } else if (e.key === " ") {
          e.preventDefault();
          const hasAll = nextItems.length > 1;
          if (hasAll && nextIndex === 0) {
            toggleNextAll();
          } else {
            toggleNextItem(hasAll ? nextIndex - 1 : nextIndex);
          }
          return;
        } else if (e.key === "Enter") {
          e.preventDefault();
          insertNextHighlightedOrSelected();
          return;
        }
      }

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

      if (e.key === "Enter" && !e.shiftKey && !isMobile) {
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

    const handleBeforeInput = (e: React.FormEvent<HTMLDivElement>) => {
      const inputType = (e.nativeEvent as InputEvent).inputType;
      if (
        isMobile &&
        (inputType === "insertParagraph" || inputType === "insertLineBreak")
      ) {
        e.preventDefault();
        if (mentionOpen) return;
        const el = innerRef.current;
        if (el) {
          insertNodeAtCaret(document.createTextNode("\n"));
          handleInput();
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
              onPointerDown={(e) => e.preventDefault()}
              onTouchStart={(e) => e.preventDefault()}
              onClick={() => insertPeso()}
              className="rounded-md border border-border/50 bg-white px-3 py-1.5
                text-sm font-semibold text-slate-600 shadow-sm transition-colors
                hover:bg-slate-50 dark:bg-card dark:text-slate-300 min-h-[36px]
                min-w-[40px] touch-manipulation select-none"
            >
              ₱
            </button>
            {getBorrowerNextAmounts && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                onClick={() => openNextFromButton()}
                className="ml-2 rounded-md border border-border/50 bg-white px-3
                  py-1.5 text-sm font-semibold text-slate-600 shadow-sm
                  transition-colors hover:bg-slate-50 dark:bg-card
                  dark:text-slate-300 min-h-[36px] touch-manipulation
                  select-none"
              >
                Next
              </button>
            )}
          </div>
        )}
        <div
          ref={innerRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onBeforeInput={handleBeforeInput}
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
            cursor-text select-text whitespace-pre-wrap rounded-xl border
            border-border/50 bg-white/60 px-3 py-2 text-base font-sans
            text-slate-700 transition-all duration-200
            empty:before:text-slate-400
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
        {nextOpen &&
          (nextLoading || nextItems.length > 0) &&
          nextAnchor &&
          createPortal(
            <div
              ref={nextDropdownRef}
              data-next-dropdown
              style={{
                position: "fixed",
                top: nextAnchor.top,
                bottom: nextAnchor.bottom,
                left: nextAnchor.left,
                width: isMobile
                  ? nextAnchor.width
                  : Math.min(288, nextAnchor.width),
                maxHeight: nextAnchor.maxHeight,
              }}
              className="pointer-events-auto z-9999 flex flex-col rounded-lg
                border border-border/50 bg-white p-0.5 shadow-md dark:bg-card"
            >
              {nextLoading ? (
                <div
                  className="px-2 py-1.5 text-sm text-slate-500
                    dark:text-muted-foreground"
                >
                  Loading collections…
                </div>
              ) : (
                <>
                  <div
                    className="min-h-0 divide-y divide-border/50
                      overflow-y-auto"
                  >
                    {nextItems.length > 1 && (
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (!isMobile) innerRef.current?.focus();
                          toggleNextAll();
                        }}
                        className={`w-full rounded-md px-2 py-3 text-left
                          text-sm transition-colors ${
                            nextIndex === 0
                              ? "bg-slate-100 dark:bg-muted"
                              : "hover:bg-slate-50 dark:hover:bg-muted/50"
                          }`}
                      >
                        <span
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              readOnly
                              checked={nextSelected.size === nextItems.length}
                              className="pointer-events-none h-3.5 w-3.5
                                accent-slate-600"
                            />
                            <span
                              className="font-medium text-slate-700
                                dark:text-foreground"
                            >
                              All
                            </span>
                          </span>
                          <span
                            className="text-slate-500
                              dark:text-muted-foreground"
                          >
                            ₱{nextTotal.toLocaleString()}
                          </span>
                        </span>
                      </button>
                    )}
                    {nextItems.map((item, i) => {
                      const itemIndex = nextItems.length > 1 ? i + 1 : i;
                      const isOverdue =
                        item.due_date < overdueCutoffDateValue();
                      const year = item.due_date.slice(0, 4);
                      const showYear =
                        i === 0 ||
                        nextItems[i - 1].due_date.slice(0, 4) !== year;
                      return (
                        <Fragment key={`${item.due_date}-${i}`}>
                          {showYear && (
                            <div
                              className="px-2 pb-1 pt-2 text-[10px] font-bold
                                tracking-wide text-slate-400
                                dark:text-muted-foreground"
                            >
                              {year}
                            </div>
                          )}
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (!isMobile) innerRef.current?.focus();
                              toggleNextItem(i);
                            }}
                            className={`w-full rounded-md px-2 py-3 text-left
                              text-sm transition-colors ${
                                itemIndex === nextIndex
                                  ? "bg-slate-100 dark:bg-muted"
                                  : "hover:bg-slate-50 dark:hover:bg-muted/50"
                              }`}
                          >
                            <span
                              className="flex items-center justify-between
                                gap-2"
                            >
                              <span className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  readOnly
                                  checked={nextSelected.has(i)}
                                  className="pointer-events-none h-3.5 w-3.5
                                    accent-slate-600"
                                />
                                <span
                                  className="font-medium text-slate-700
                                    dark:text-foreground"
                                >
                                  {formatShortDate(item.due_date)}
                                </span>
                                <span
                                  className={`rounded border px-1 py-px
                                    text-[8px] font-semibold lowercase ${
                                      item.type === "cash_advance"
                                        ? `border-amber-300/60 bg-amber-200
                                          text-amber-900 dark:border-amber-700
                                          dark:bg-amber-800 dark:text-amber-100`
                                        : `border-violet-300/60 bg-violet-200
                                          text-violet-900 dark:border-violet-700
                                          dark:bg-violet-800
                                          dark:text-violet-100`
                                    }`}
                                >
                                  {item.type === "cash_advance" ? "CA" : "Loan"}
                                </span>
                                {isOverdue && (
                                  <span
                                    className="rounded border border-rose-300/60
                                      bg-rose-100 px-1 py-px text-[8px]
                                      font-semibold uppercase text-rose-700
                                      dark:border-rose-700 dark:bg-rose-800
                                      dark:text-rose-100"
                                  >
                                    overdue
                                  </span>
                                )}
                              </span>
                              <span
                                className="text-slate-500
                                  dark:text-muted-foreground"
                              >
                                ₱{item.amount.toLocaleString()}
                              </span>
                            </span>
                          </button>
                        </Fragment>
                      );
                    })}
                  </div>
                  <div
                    className="mt-0.5 shrink-0 border-t border-border/50 p-0.5"
                  >
                    <button
                      type="button"
                      disabled={
                        nextSelected.size === 0 &&
                        !nextItems.some((item) => item.existing)
                      }
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!isMobile) innerRef.current?.focus();
                        insertNextItems(
                          nextItems.filter((_, i) => nextSelected.has(i)),
                        );
                      }}
                      className="w-full rounded-md bg-slate-900 px-2 py-1.5
                        text-sm font-medium text-white transition-opacity
                        disabled:opacity-40 dark:bg-slate-100
                        dark:text-slate-900"
                    >
                      {nextItems.some((item) => item.existing)
                        ? "Update"
                        : "Insert"}
                      {nextSelected.size > 0 ? ` (${nextSelected.size})` : ""}
                    </button>
                  </div>
                </>
              )}
            </div>,
            document.body,
          )}
      </div>
    );
  },
);
ChecklistInput.displayName = "ChecklistInput";
