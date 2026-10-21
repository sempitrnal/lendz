"use client";

import { useRef, useState, type ReactNode } from "react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { labelParts } from "@/lib/checklist/composer";
import { extractBorrowerMention } from "@/lib/checklist/labels";
import { planNoteSave, planPlainSave } from "@/lib/checklist/note-edit";
import { todayDateValue } from "@/lib/checklist/dates";
import type { RowView } from "@/lib/checklist/row-state";
import { SheetFooter } from "@/components/dashboard/checklist-v2/sheet";
import { peso } from "@/components/dashboard/checklist-v2/header";
import { rowName } from "@/components/dashboard/checklist-v2/collect-row";
import { BorrowerTitle } from "@/components/dashboard/checklist-v2/sheet-parts";

/**
 * The borrower a row is about: a collection row's, or the mention a plain
 * note carries (a note with no mention has none).
 */
export function rowBorrower(row: RowView): { id: string; name: string } | null {
  return row.model?.borrower ?? extractBorrowerMention(row.item.label);
}

export function MenuEntry({
  icon,
  title,
  onClick,
  disabled,
  danger,
}: {
  icon: ReactNode;
  title: string;
  onClick(): void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex w-full items-center gap-3 rounded-xl border
          border-border bg-background p-3 text-left active:bg-muted
          disabled:opacity-50"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            danger
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
          )}
        >
          {icon}
        </span>
        <span
          className={cn("text-sm font-semibold", danger && "text-destructive")}
        >
          {title}
        </span>
      </button>
    </li>
  );
}

/**
 * The row menu (swipe → More, or More in the pay sheet): Edit item, Open
 * borrower page, Remove from list. A plain note has no dues to edit, so its
 * first entry is "Edit note" (the note sheet, on its text); "Open borrower
 * page" shows only when the row has a borrower.
 *
 * Render it inside `Sheet`, keyed per open.
 */
export function RowMenuSheet({
  row,
  disabled,
  onEditItem,
  onEditNote,
  onOpenBorrower,
  onRemove,
}: {
  row: RowView;
  /** The day is still loading: nothing here may write. */
  disabled: boolean;
  /** Edit item (collection rows): opens the add sheet in edit mode. */
  onEditItem(): void;
  /** Edit note (plain notes): opens the note sheet. */
  onEditNote(): void;
  onOpenBorrower(): void;
  onRemove(): void;
}) {
  const plain = row.model === null;
  const hasBorrower = rowBorrower(row) !== null;
  const name = rowName(row);
  // The remove tap is taken once, however fast the second tap is.
  const removed = useRef(false);
  return (
    <div className="px-5 pt-2 pb-4">
      <h2
        className={cn(
          "text-lg font-semibold",
          !plain && "lowercase",
          plain && "line-clamp-2 whitespace-pre-line",
        )}
      >
        {name}
      </h2>
      <p className="text-sm text-muted-foreground">
        {plain
          ? "Note"
          : row.status === "paid"
            ? "Paid"
            : `${peso(row.left)} left`}
      </p>
      <ul className="mt-3 space-y-2">
        {plain ? (
          <MenuEntry
            icon={<Pencil className="size-4" />}
            title="Edit note"
            onClick={onEditNote}
            disabled={disabled}
          />
        ) : (
          <MenuEntry
            icon={<Pencil className="size-4" />}
            title="Edit item"
            onClick={onEditItem}
            disabled={disabled}
          />
        )}
        {hasBorrower && (
          <MenuEntry
            icon={<ExternalLink className="size-4" />}
            title="Open borrower page"
            onClick={onOpenBorrower}
          />
        )}
        <MenuEntry
          icon={<Trash2 className="size-4" />}
          title="Remove from list"
          danger
          disabled={disabled}
          onClick={() => {
            if (removed.current) return;
            removed.current = true;
            onRemove();
          }}
        />
      </ul>
    </div>
  );
}

/**
 * The note sheet: a textarea on the row's note. Saving keeps the mention,
 * the dues and the `with` mentions and replaces only the note; an empty note
 * clears it. A plain note is edited here as its own text.
 *
 * Render it inside `Sheet`, keyed per open, so each open starts from the
 * saved note.
 */
export function NoteSheet({
  row,
  date,
  disabled,
  setLabel,
  onOpenBorrower,
  onClose,
}: {
  row: RowView;
  date: string;
  /** The day is still loading: nothing here may write. */
  disabled: boolean;
  setLabel(id: string, label: string): void;
  onOpenBorrower(): void;
  onClose(): void;
}) {
  const plain = row.model === null;
  const borrower = rowBorrower(row);
  // The note as it was when the sheet opened; this version is what's edited.
  const [initial] = useState(() =>
    plain ? row.item.label : labelParts(row.item.label, date).note,
  );
  const [text, setText] = useState(initial);
  const submitted = useRef(false);

  const plan = plain
    ? planPlainSave(row.item.label, text)
    : planNoteSave(row.item.label, date, text);
  const clearing = text.trim() === "" && initial.trim() !== "";
  const canSave = !disabled && plan.action !== "blocked";

  const save = () => {
    if (!canSave || submitted.current) return;
    submitted.current = true;
    if (plan.action === "save") setLabel(row.item.id, plan.label);
    onClose();
  };

  const isToday = date === todayDateValue();
  return (
    <>
      <div className="px-5 pt-2 pb-3">
        {plain ? (
          <h2 className="text-lg font-semibold">Edit note</h2>
        ) : (
          <BorrowerTitle
            name={rowName(row)}
            onOpen={borrower ? onOpenBorrower : undefined}
          />
        )}
        <p className="text-sm text-muted-foreground">
          {plain
            ? "The text of this item"
            : `Note for ${isToday ? "today" : "this day"}`}
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={plain ? "Note text" : "Note"}
          placeholder="Promised to pay on the 22nd"
          className="mt-3 min-h-24"
          autoFocus
        />
        {plan.action === "blocked" && (
          <p className="mt-2 text-sm text-muted-foreground">
            A note with no text would be an empty item. Use Remove from list
            instead.
          </p>
        )}
      </div>
      <SheetFooter>
        <Button
          size="lg"
          className="h-12 w-full text-base"
          disabled={!canSave}
          onClick={save}
        >
          {clearing ? "Clear note" : plain ? "Save" : "Save note"}
        </Button>
      </SheetFooter>
    </>
  );
}
