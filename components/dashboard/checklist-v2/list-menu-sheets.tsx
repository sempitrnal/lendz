"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  Plus,
  Settings2,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  celebrationSoundEnabled,
  setCelebrationSound,
} from "@/lib/checklist/celebrate";
import { playChaChing, primeAudio } from "@/lib/sound/cha-ching";
import { SheetFooter } from "@/components/dashboard/checklist-v2/sheet";
import { SheetListSkeleton } from "@/components/dashboard/checklist-v2/sheet-parts";
import { peso } from "@/components/dashboard/checklist-v2/header";
import { useLiveSchedules } from "@/components/dashboard/checklist-v2/use-live-schedules";
import {
  buildBulkPaid,
  bulkScheduleIds,
  type BulkPaid,
} from "@/lib/checklist/bulk-paid";
import { CARRY_OVER_DAYS } from "@/lib/checklist/list-menu";
import { overdueCutoffDateValue, todayDateValue } from "@/lib/checklist/dates";
import type { RowView } from "@/lib/checklist/row-state";

const ENTRY_CLASS = `flex w-full items-center gap-3 rounded-xl border
  border-border bg-background p-3 text-left active:bg-muted
  disabled:opacity-50`;

function EntryBody({
  icon,
  title,
  hint,
  danger,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <>
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
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm font-semibold",
            danger && "text-destructive",
          )}
        >
          {title}
        </span>
        {hint && (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        )}
      </span>
    </>
  );
}

function MenuButton({
  onClick,
  disabled,
  ...body
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  danger?: boolean;
  onClick(): void;
  disabled?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={ENTRY_CLASS}
      >
        <EntryBody {...body} />
      </button>
    </li>
  );
}

/**
 * The Collect list menu ("⋯"): Populate due, Mark all paid (n), Undo
 * populate (only right after a populate), Clear all (n) and a link to Manage
 * categories. Each entry is taken once per open.
 *
 * Render it inside `Sheet`, keyed per open.
 */
export function ListMenuSheet({
  isToday,
  unpaidCount,
  total,
  canUndoPopulate,
  disabled,
  populating,
  onPopulate,
  onMarkAll,
  onUndoPopulate,
  onClear,
  onManageCategories,
  onGuide,
}: {
  isToday: boolean;
  /** Rows Mark all paid is for (`bulkPaidRows`). */
  unpaidCount: number;
  /** Items Clear all removes (the Collect tab's). */
  total: number;
  canUndoPopulate: boolean;
  /** The day is still loading: nothing here may write. */
  disabled: boolean;
  /** A populate is still under way. */
  populating: boolean;
  onPopulate(): void;
  onMarkAll(): void;
  onUndoPopulate(): void;
  onClear(): void;
  onManageCategories(): void;
  /** Starts the checklist guide tour. */
  onGuide(): void;
}) {
  const [soundOn, setSoundOn] = useState(() => celebrationSoundEnabled());
  const taken = useRef(false);
  const once = (fn: () => void) => () => {
    if (taken.current) return;
    taken.current = true;
    fn();
  };
  return (
    <div className="px-5 pt-2 pb-4">
      <h2 className="text-lg font-semibold">
        {isToday ? "Today's list" : "This day's list"}
      </h2>
      <ul data-tour="list-menu-entries" className="mt-3 space-y-2">
        <MenuButton
          icon={<Plus className="size-4" />}
          title={populating ? "Populating…" : "Populate due"}
          hint={`Everyone due ${
            isToday ? "today" : "this day"
          } or up to ${CARRY_OVER_DAYS} days late who isn't listed yet`}
          disabled={disabled || populating}
          onClick={once(onPopulate)}
        />
        {unpaidCount > 0 && (
          <MenuButton
            icon={<Check className="size-4" />}
            title={`Mark all paid (${unpaidCount})`}
            disabled={disabled}
            onClick={once(onMarkAll)}
          />
        )}
        {canUndoPopulate && (
          <MenuButton
            icon={<Undo2 className="size-4" />}
            title="Undo populate"
            hint="Removes the rows it added that you haven't changed or ticked"
            danger
            disabled={disabled}
            onClick={once(onUndoPopulate)}
          />
        )}
        {total > 0 && (
          <MenuButton
            icon={<Trash2 className="size-4" />}
            title={`Clear all (${total})`}
            hint="Removes the items, never the payments"
            danger
            disabled={disabled}
            onClick={once(onClear)}
          />
        )}
        <MenuButton
          icon={
            soundOn ? (
              <Volume2 className="size-4" />
            ) : (
              <VolumeX className="size-4" />
            )
          }
          title={`Cha-ching sound: ${soundOn ? "on" : "off"}`}
          hint="Plays when a payment earns profit"
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            setCelebrationSound(next);
            // This tap unlocks audio, and turning it on plays a preview.
            primeAudio();
            if (next) playChaChing();
          }}
        />
        <MenuButton
          icon={<BookOpen className="size-4" />}
          title="Checklist guide"
          hint="A walkthrough of everything on this screen"
          onClick={once(onGuide)}
        />
        <li>
          <Link
            href="/daily-checklist/categories"
            onClick={onManageCategories}
            className={ENTRY_CLASS}
          >
            <EntryBody
              icon={<Settings2 className="size-4" />}
              title="Manage categories"
            />
          </Link>
        </li>
      </ul>
    </div>
  );
}

/**
 * The bulk sheet ("Mark all paid"): loads the live schedules of every unpaid
 * row, shows the old `BulkPaidDialog`'s summary (borrowers, collections to
 * mark paid, already paid when any, total) and a payment date. Nothing can be
 * marked until every linked schedule has loaded.
 *
 * Render it inside `Sheet`, keyed per open.
 */
export function BulkPaidSheet({
  rows,
  date,
  disabled,
  onClose,
  onConfirm,
}: {
  /** The rows to mark (`bulkPaidRows`). */
  rows: RowView[];
  /** The day shown (the payment date still starts on today). */
  date: string;
  /** The day is still loading: nothing here may write. */
  disabled: boolean;
  onClose(): void;
  onConfirm(bulk: BulkPaid, paymentDate: string): void;
}) {
  // Today, like every other way of paying (and the old dialog): opening an
  // earlier day's list must not back-date what is collected now.
  const [paidDate, setPaidDate] = useState(todayDateValue);
  const submitted = useRef(false);
  const ids = useMemo(() => bulkScheduleIds(rows), [rows]);
  const live = useLiveSchedules(ids);
  const bulk = useMemo(
    () => buildBulkPaid(rows, live.rows, overdueCutoffDateValue()),
    [rows, live.rows],
  );
  const ready = live.status === "ready" && bulk.missing.length === 0;
  const { summary } = bulk;
  const canConfirm =
    ready &&
    !disabled &&
    (summary.collections > 0 || bulk.tickIds.length > 0) &&
    /^\d{4}-\d{2}-\d{2}$/.test(paidDate);

  const confirm = () => {
    if (!canConfirm || submitted.current) return;
    submitted.current = true;
    onClose();
    onConfirm(bulk, paidDate);
  };

  const line = (label: string, value: ReactNode, strong = false) => (
    <div
      className={cn(
        "flex justify-between",
        strong && "mt-1 border-t border-border pt-1",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );

  return (
    <>
      <div className="px-5 pt-2 pb-3">
        <div
          className="flex size-10 items-center justify-center rounded-full
            bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40
            dark:text-emerald-300"
        >
          <Check className="size-5" />
        </div>
        <h2 className="mt-3 text-xl font-semibold tracking-tight">
          Mark all as paid
        </h2>
        <p className="text-sm text-muted-foreground">
          Records the full amount as paid for every unticked collection in
          Collect and ticks them off.
        </p>

        <div className="mt-3">
          {live.status === "loading" ? (
            <SheetListSkeleton />
          ) : live.status === "error" ? (
            <p
              className="rounded-lg bg-destructive/10 p-3 text-sm
                text-destructive"
            >
              Couldn&apos;t load these collections. Try again when online.
            </p>
          ) : bulk.missing.length > 0 ? (
            <p
              className="rounded-lg bg-destructive/10 p-3 text-sm
                text-destructive"
            >
              Couldn&apos;t load {bulk.missing.length} of these collections, so
              nothing can be marked. Try again when online.
            </p>
          ) : (
            <div className="rounded-lg border border-border bg-card p-3 text-sm">
              {line("Borrowers", summary.borrowers)}
              {line("Collections to mark paid", summary.collections)}
              {summary.alreadyPaid > 0 &&
                line("Already paid", summary.alreadyPaid)}
              {line("Total", peso(summary.total), true)}
            </div>
          )}
        </div>

        <label className="mt-3 block text-xs font-medium text-muted-foreground">
          Payment date
          <Input
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            className="mt-1.5 h-10 font-semibold"
          />
        </label>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Recorded as the paid date on every payment
          {date !== todayDateValue() && paidDate === todayDateValue()
            ? " — today, not the day this list is for"
            : ""}
          .
        </p>
      </div>
      <SheetFooter className="flex gap-2">
        <Button
          variant="outline"
          size="lg"
          className="h-12 flex-1 text-base"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          size="lg"
          className="h-12 flex-1 text-base"
          disabled={!canConfirm}
          onClick={confirm}
        >
          Mark all paid
        </Button>
      </SheetFooter>
    </>
  );
}
