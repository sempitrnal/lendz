"use client";

import { Check, CloudUpload, HandCoins, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReleaseRowView } from "@/lib/checklist/release-items";
import {
  type CreateMark,
  type CreateMarks,
  releaseNote,
  releaseRowState,
  releaseSummary,
} from "@/lib/checklist/release-list";

/**
 * The Release tab: one row per released item with its typed note under it.
 * A parsed one offers "Create account" until it is ticked ("Created"); one
 * whose note doesn't read as a release is a plain row with no button.
 */
export function ReleaseList({
  views,
  createMarks,
  waitingIds,
  flashIds,
  disabled,
  onCreate,
  onCheckOff,
  onMenu,
  onNewRelease,
}: {
  views: ReleaseRowView[];
  /** Where creating an account stands per item on this screen. */
  createMarks: CreateMarks;
  waitingIds: Set<string>;
  flashIds: Set<string>;
  /** The day is loading: no writes. */
  disabled: boolean;
  onCreate(view: ReleaseRowView): void;
  /** Ticks an item whose account was made here but whose tick failed. */
  onCheckOff(view: ReleaseRowView): void;
  /** Opens the row's menu: Edit, Open borrower page, Remove. */
  onMenu(view: ReleaseRowView): void;
  onNewRelease(): void;
}) {
  return (
    <div className="mt-3 space-y-3 px-3">
      {views.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No releases on this day yet. Add one with New release.
        </p>
      ) : (
        <section
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          <ul>
            {views.map((view) => (
              <ReleaseRow
                key={view.item.id}
                view={view}
                mark={createMarks.get(view.item.id)}
                waiting={waitingIds.has(view.item.id)}
                highlight={flashIds.has(view.item.id)}
                disabled={disabled}
                onCreate={() => onCreate(view)}
                onCheckOff={() => onCheckOff(view)}
                onMenu={() => onMenu(view)}
              />
            ))}
          </ul>
        </section>
      )}
      <Button
        variant="outline"
        className="h-11 w-full gap-2"
        disabled={disabled}
        onClick={onNewRelease}
      >
        <HandCoins className="size-4" />
        New release
      </Button>
      <p className="pt-2 text-center text-xs text-muted-foreground">
        Typed notes are read for you: amount, term and dates fill the form.
      </p>
    </div>
  );
}

function ReleaseRow({
  view,
  mark,
  waiting,
  highlight,
  disabled,
  onCreate,
  onCheckOff,
  onMenu,
}: {
  view: ReleaseRowView;
  mark: CreateMark | undefined;
  waiting: boolean;
  highlight: boolean;
  disabled: boolean;
  onCreate(): void;
  onCheckOff(): void;
  onMenu(): void;
}) {
  const state = releaseRowState(view, mark);
  const summary = releaseSummary(view);
  const note = releaseNote(view.item.label);
  // A row with no borrower mention shows its whole note as the title.
  const title = view.name || view.typed;
  const plainDone = state === "plain" && view.item.is_checked;

  return (
    <li
      className={cn(
        `flex items-center gap-3 border-b border-border px-4 py-3
        transition-colors duration-700 motion-reduce:transition-none
        last:border-b-0`,
        highlight && "bg-primary/5",
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-[15px] font-bold lowercase",
            plainDone && "text-muted-foreground line-through",
          )}
        >
          {title}
          {waiting && (
            <CloudUpload
              className="ml-1.5 inline size-3.5 text-sky-500"
              aria-label="Waiting to sync"
            />
          )}
        </p>
        {summary && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {summary}
          </p>
        )}
        {view.name && note && (
          <p
            className="text-[11px] break-words text-muted-foreground/70
              lowercase"
          >
            “{note}”
          </p>
        )}
        {state === "attempted" && (
          <p
            className="mt-0.5 text-xs font-medium text-amber-700
              dark:text-amber-400"
          >
            An earlier Create may have made this account
          </p>
        )}
        {state === "check-off" && (
          <p className="mt-0.5 text-xs font-medium text-destructive">
            Not checked off yet
          </p>
        )}
      </div>
      {state === "created" && (
        <span
          className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10
            px-3 py-1.5 text-sm font-medium text-primary"
        >
          <Check className="size-4" strokeWidth={2.5} />
          Created
        </span>
      )}
      {state === "create" && (
        <Button
          onClick={onCreate}
          disabled={disabled}
          className="relative h-9 shrink-0 rounded-full px-4 after:absolute
            after:-inset-y-1 after:inset-x-0 after:content-['']"
        >
          Create account
        </Button>
      )}
      {state === "creating" && (
        <Button
          disabled
          aria-busy="true"
          className="relative h-9 shrink-0 rounded-full px-4"
        >
          Creating…
        </Button>
      )}
      {state === "attempted" && (
        <Button
          variant="outline"
          onClick={onCreate}
          disabled={disabled}
          className="relative h-9 shrink-0 rounded-full px-4 after:absolute
            after:inset-x-0 after:-inset-y-1 after:content-['']"
        >
          Check first
        </Button>
      )}
      {state === "check-off" && (
        <Button
          variant="outline"
          onClick={onCheckOff}
          disabled={disabled}
          className="relative h-9 shrink-0 rounded-full px-4 after:absolute
            after:-inset-y-1 after:inset-x-0 after:content-['']"
        >
          Check off
        </Button>
      )}
      <button
        type="button"
        onClick={onMenu}
        // An account is being made from it right now: leave it alone.
        disabled={disabled || state === "creating"}
        aria-label={`Options for ${title}`}
        className="-mr-2 flex size-11 shrink-0 items-center justify-center
          rounded-full text-muted-foreground active:bg-muted
          disabled:opacity-40"
      >
        <MoreHorizontal className="size-5" />
      </button>
    </li>
  );
}
