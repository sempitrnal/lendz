"use client";

import { groupColorStyle } from "@/lib/checklist/group-color";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useMemo, useState } from "react";
import {
  CalendarRange,
  Check,
  ChevronDown,
  CloudUpload,
  HandCoins,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { namePillClass } from "@/components/dashboard/checklist-v2/collect-row";
import type { BorrowerSearchItem } from "@/app/api/borrowers/route";
import { groupByBorrowerCategory } from "@/lib/checklist/labels";
import {
  NEAR_WHITE_BORDER,
  isNearWhite,
} from "@/components/dashboard/checklist/dom";
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
 * Grouped by the borrower's category, like Collect. A parsed one offers "Create account" until it is ticked ("Created"); one
 * whose note doesn't read as a release is a plain row with no button.
 */
export function ReleaseList({
  views,
  borrowers,
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
  borrowers: BorrowerSearchItem[];
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
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const groups = useMemo(
    () => groupByBorrowerCategory(views, (v) => v.item.label, borrowers),
    [views, borrowers],
  );

  return (
    <div className="mt-3 space-y-3">
      {views.length === 0 ? (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground">
          No releases on this day yet. Add one with New release.
        </p>
      ) : (
        <section className="overflow-hidden border-y border-border bg-card">
          {groups.map((g) => {
            const isCollapsed = collapsed.has(g.key);
            const done = g.rows.filter((v) => v.item.is_checked).length;
            return (
              <div
                key={g.key}
                style={groupColorStyle(g.color)}
                className="border-b border-border last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => toggle(g.key)}
                  aria-expanded={!isCollapsed}
                  className={cn(
                    `flex w-full items-center gap-2 px-4 py-2 text-left text-xs
                      font-semibold lowercase`,
                    g.color
                      ? "bg-[color:color-mix(in_oklab,var(--grp)_8%,var(--card))]"
                      : "bg-card",
                  )}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: g.color ?? "var(--muted-foreground)",
                      opacity: g.color ? 1 : 0.4,
                      boxShadow:
                        g.color && isNearWhite(g.color)
                          ? `inset 0 0 0 1px ${NEAR_WHITE_BORDER}`
                          : undefined,
                    }}
                  />
                  <span className="truncate">{g.name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {done}/{g.rows.length}
                  </span>
                  <ChevronDown
                    className={cn(
                      "ml-auto size-3.5 shrink-0 transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                </button>
                {!isCollapsed && (
                  <ul>
                    {g.rows.map((view) => (
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
                )}
              </div>
            );
          })}
        </section>
      )}
      <Button
        variant="outline"
        data-tour="release-new"
        className="mx-3 h-11 w-[calc(100%-1.5rem)] gap-2"
        disabled={disabled}
        onClick={onNewRelease}
      >
        <HandCoins className="size-4" />
        New release
      </Button>
      <p className="px-3 pt-2 text-center text-xs text-muted-foreground">
        Typed notes are read for you: amount, term and dates fill the form.
      </p>
      <Link
        href="/releases"
        className="mx-auto flex w-fit items-center gap-1.5 rounded-full px-3
          py-1.5 text-xs font-semibold text-primary active:bg-primary/10"
      >
        <CalendarRange className="size-3.5" />
        Plan releases for the month
      </Link>
    </div>
  );
}

/**
 * Where a created release's account is. The item never stored which account it
 * made, so this finds it again: the borrower's account with the same
 * principal (the one on the release date if several). No match, or offline:
 * the borrower's page.
 */
async function createdAccountPath(view: ReleaseRowView): Promise<string> {
  const fallback = view.borrowerId ? `/borrowers/${view.borrowerId}` : "/";
  const values = view.parsed?.initialValues;
  if (!view.borrowerId || !values?.principal_amount) return fallback;
  const { data } = await supabase
    .from("accounts")
    .select("id, release_date")
    .eq("borrower_id", view.borrowerId)
    .eq("principal_amount", values.principal_amount)
    .order("created_at", { ascending: false })
    .limit(10);
  const accounts = (data ?? []) as { id: string; release_date: string }[];
  const match =
    accounts.find((a) => a.release_date === values.release_date) ?? accounts[0];
  return match ? `/accounts/${match.id}` : fallback;
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
  const router = useRouter();
  // A created release opens the account it made.
  const openAccount = (event: React.MouseEvent) => {
    if (state !== "created") return;
    if ((event.target as Element).closest("button, a")) return;
    void createdAccountPath(view).then(
      (path) => router.push(path),
      () => view.borrowerId && router.push(`/borrowers/${view.borrowerId}`),
    );
  };

  return (
    <li
      data-tour={state === "created" ? "release-created-row" : undefined}
      onClick={openAccount}
      className={cn(
        state === "created" && "cursor-pointer",
        `flex items-center gap-3 border-b border-border px-4 py-3
        transition-colors duration-700 motion-reduce:transition-none
        last:border-b-0`,
        highlight && "bg-primary/5",
      )}
    >
      <div className="min-w-0 flex-1" data-tour="release-row">
        <p
          className={cn(
            "truncate text-[15px] font-bold lowercase",
            plainDone && "text-muted-foreground line-through",
          )}
        >
          {view.borrowerId && view.name ? (
            <Link
              href={`/borrowers/${view.borrowerId}`}
              className={cn(namePillClass, "active:opacity-70")}
            >
              {title}
            </Link>
          ) : (
            title
          )}
          {waiting && (
            <CloudUpload
              className="ml-1.5 inline size-3.5 text-sky-500"
              aria-label="Waiting to sync"
            />
          )}
        </p>
        {summary && (
          <p
            className="text-xs font-semibold text-muted-foreground tabular-nums"
          >
            {summary}
          </p>
        )}
        {view.name && note && (
          <p
            className="text-[11px] font-semibold break-words
              text-muted-foreground/70 lowercase"
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
