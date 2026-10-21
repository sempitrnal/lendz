"use client";

import { useRef, useState } from "react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { releaseReadBack } from "@/lib/checklist/add-sheet";
import type { ReleaseRowView } from "@/lib/checklist/release-items";
import {
  planReleaseEdit,
  releaseDisplayName,
  releaseEditText,
} from "@/lib/checklist/release-edit";
import { MenuEntry } from "@/components/dashboard/checklist-v2/row-sheets";
import { SheetFooter } from "@/components/dashboard/checklist-v2/sheet";
import { BorrowerTitle } from "@/components/dashboard/checklist-v2/sheet-parts";

/**
 * The menu of a Release row ("⋯"): Edit, Open borrower page, Remove from
 * list. Both Edit and Remove change the checklist item only: an account that
 * was already created from it is left alone.
 *
 * Render it inside `Sheet`, keyed per open.
 */
export function ReleaseMenuSheet({
  view,
  disabled,
  onEdit,
  onOpenBorrower,
  onRemove,
}: {
  view: ReleaseRowView;
  /** The day is still loading: nothing here may write. */
  disabled: boolean;
  onEdit(): void;
  onOpenBorrower(): void;
  onRemove(): void;
}) {
  // The remove tap is taken once, however fast the second tap is.
  const removed = useRef(false);
  const hasBorrower = view.parsed?.borrowerId || view.name;
  return (
    <div className="px-5 pt-2 pb-4">
      <h2 className="text-lg font-semibold lowercase">
        {releaseDisplayName(view)}
      </h2>
      <p className="text-sm text-muted-foreground">
        {view.created
          ? "Released · the account is already created; this only changes the list"
          : "Release"}
      </p>
      <ul className="mt-3 space-y-2">
        <MenuEntry
          icon={<Pencil className="size-4" />}
          title="Edit release"
          onClick={onEdit}
          disabled={disabled}
        />
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
 * Edit a release: a textarea on its note, with the borrower kept. The line
 * under it reads the note back live, so a typo in the amount or a date shows
 * before saving. Saving rewrites the checklist item only.
 *
 * Render it inside `Sheet`, keyed per open, so each open starts from the
 * saved text.
 */
export function ReleaseEditSheet({
  view,
  disabled,
  setLabel,
  onOpenBorrower,
  onClose,
}: {
  view: ReleaseRowView;
  /** The day is still loading: nothing here may write. */
  disabled: boolean;
  setLabel(id: string, label: string): void;
  onOpenBorrower(): void;
  onClose(): void;
}) {
  const [text, setText] = useState(() => releaseEditText(view));
  const submitted = useRef(false);

  const plan = planReleaseEdit(view, text);
  const canSave = !disabled && plan.action === "save";
  const readBack =
    plan.action === "save" && plan.parsed
      ? releaseReadBack(plan.parsed)
      : plan.action === "unchanged" && view.parsed
        ? releaseReadBack(view.parsed)
        : null;

  const save = () => {
    if (!canSave || submitted.current || plan.action !== "save") return;
    submitted.current = true;
    setLabel(view.item.id, plan.label);
    onClose();
  };

  return (
    <>
      <div className="px-5 pt-2 pb-3">
        {view.name ? (
          <BorrowerTitle
            name={view.name.toLowerCase()}
            onOpen={onOpenBorrower}
          />
        ) : (
          <h2 className="text-lg font-semibold">Edit release</h2>
        )}
        <p className="text-sm text-muted-foreground">
          Edit release · amount, term and dates are read from the note
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Release note"
          placeholder="10,000 - 10 months for 110426"
          className="mt-3 min-h-24"
          autoFocus
        />
        {readBack ? (
          <p className="mt-2 text-sm font-medium text-primary">{readBack}</p>
        ) : (
          plan.action !== "blocked" && (
            <p className="mt-2 text-sm text-muted-foreground">
              This note doesn&apos;t read as a release yet, so it can&apos;t
              make an account.
            </p>
          )
        )}
        {plan.action === "blocked" && (
          <p className="mt-2 text-sm text-muted-foreground">
            A release with no text would be an empty item. Use Remove from list
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
          Save changes
        </Button>
      </SheetFooter>
    </>
  );
}
