"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useBorrowersSearch } from "@/hooks/use-borrowers-search";
import { useCachedSchedules } from "@/components/dashboard/checklist/use-cached-schedules";
import { useChecklistItems } from "@/components/dashboard/checklist-v2/use-checklist-items";
import { Header } from "@/components/dashboard/checklist-v2/header";
import {
  CollectList,
  type CollectRowsApi,
  type RowRequest,
} from "@/components/dashboard/checklist-v2/collect-list";
import {
  kindLabel,
  openLines,
  rowName,
} from "@/components/dashboard/checklist-v2/collect-row";
import { useQuickPay } from "@/components/dashboard/checklist-v2/use-quick-pay";
import { todayDateValue } from "@/lib/checklist/dates";
import { extractScheduleRefs, NO_BORROWERS } from "@/lib/checklist/labels";
import { buildRowView, type RowView } from "@/lib/checklist/row-state";
import {
  filterCounts,
  summarizeRows,
  type ChecklistFilter,
} from "@/lib/checklist/list-view";
import { tabOf, type ChecklistTab } from "@/lib/checklist/categories";

const noopSubscribe = () => () => {};

/**
 * A sheet a row asked for. `seq` grows on every request so the sheet can key
 * its content on it and open clean each time.
 */
export type RowSheetRequest = {
  kind: RowRequest;
  itemId: string;
  seq: number;
};

/**
 * The mobile checklist. On wide screens it is a centred phone-width column.
 *
 * "Today" is only known on the device (its time zone), so the server render
 * shows the skeleton and the day loads once the screen is on the client.
 */
export default function ChecklistScreen() {
  const today = useSyncExternalStore(noopSubscribe, todayDateValue, () => null);
  if (today === null) {
    return (
      <div className="mx-auto max-w-md pb-32">
        <ListSkeleton />
      </div>
    );
  }
  return <ChecklistDay today={today} />;
}

function ChecklistDay({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [tab, setTab] = useState<ChecklistTab>("collect");
  const [filter, setFilter] = useState<ChecklistFilter>("all");
  /** The one row whose swipe actions are showing. */
  const [swipedId, setSwipedId] = useState<string | null>(null);
  /** Rows with several open installments shown expanded. */
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  /**
   * The row sheet asked for (pay, edit payments, partial, note, row menu).
   * Only recorded here for now: Task 12 renders the pay and edit-payments
   * sheets from it and Task 14 the note and row-menu sheets, so until then
   * those taps open nothing.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- read by the sheets Tasks 12 and 14 add
  const [rowSheet, setRowSheet] = useState<RowSheetRequest | null>(null);
  const sheetSeq = useRef(0);

  const { items, loading, releasedId, waitingIds, flashIds, setChecked } =
    useChecklistItems(date);
  const quickPay = useQuickPay(setChecked);
  const { data: borrowers = NO_BORROWERS } = useBorrowersSearch();

  const changeDate = (next: string) => {
    if (next === date) return;
    // Toasts (and their Undo) belong to the day they came from.
    toast.dismiss();
    setFilter("all");
    setSwipedId(null);
    setExpandedIds(new Set());
    setRowSheet(null);
    setDate(next);
  };

  const { collectItems, releaseItems } = useMemo(
    () => ({
      collectItems: items.filter((i) => tabOf(i, releasedId) === "collect"),
      releaseItems: items.filter((i) => tabOf(i, releasedId) === "release"),
    }),
    [items, releasedId],
  );

  const scheduleIds = useMemo(
    () =>
      collectItems
        .flatMap((i) => extractScheduleRefs(i.label).map((r) => r.id))
        .sort(),
    [collectItems],
  );
  const schedules = useCachedSchedules(scheduleIds);
  const rows = useMemo(
    () => collectItems.map((item) => buildRowView(item, schedules)),
    [collectItems, schedules],
  );
  const summary = useMemo(() => summarizeRows(rows), [rows]);
  const counts = useMemo(() => filterCounts(rows), [rows]);

  const rowsApi: CollectRowsApi = {
    swipedId,
    onSwiped: (itemId, open) =>
      // Opening one row closes the other; closing only clears its own.
      setSwipedId((prev) => (open ? itemId : prev === itemId ? null : prev)),
    expandedIds,
    onExpandToggle: (itemId) =>
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(itemId)) next.delete(itemId);
        else next.add(itemId);
        return next;
      }),
    waitingIds,
    flashIds,
    onRequest: (row, kind) => {
      setSwipedId(null);
      sheetSeq.current += 1;
      setRowSheet({ kind, itemId: row.item.id, seq: sheetSeq.current });
    },
    onPayAll: (row: RowView) =>
      void quickPay(
        row,
        openLines(row).map((l) => l.id),
        (amount) => `${rowName(row)} · ${amount} paid`,
      ),
    onPayLine: (row, lineId) => {
      const line = row.lines.find((l) => l.id === lineId);
      if (!line) return;
      void quickPay(
        row,
        [lineId],
        (amount) => `${rowName(row)} · ${kindLabel(line.type)} ${amount} paid`,
      );
    },
    onTick: (row) => setChecked([row.item.id], !row.item.is_checked),
  };

  return (
    <div className="mx-auto max-w-md pb-32">
      <Header
        date={date}
        today={today}
        onDateChange={changeDate}
        tab={tab}
        onTabChange={setTab}
        collectCount={collectItems.length}
        releaseCount={releaseItems.length}
        summary={summary}
        filter={filter}
        onFilterChange={setFilter}
        counts={counts}
        loading={loading}
      />

      {loading ? (
        <ListSkeleton />
      ) : tab === "collect" ? (
        <CollectList
          rows={rows}
          filter={filter}
          borrowers={borrowers}
          isToday={date === today}
          api={rowsApi}
        />
      ) : (
        <div className="mt-3 px-3">
          <div
            className="rounded-2xl border border-dashed border-border bg-card
              px-6 py-10 text-center"
          >
            <p className="text-base font-semibold">Releases are coming here</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Until then, create accounts from the{" "}
              <Link href="/daily-checklist" className="text-primary underline">
                classic checklist
              </Link>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="mt-3 space-y-3 px-3" aria-busy="true">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="h-8 animate-pulse bg-muted/60" />
          {[1, 2, 3].map((j) => (
            <div
              key={j}
              className="flex items-center gap-3 border-t border-border px-4
                py-3"
            >
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted/70" />
              </div>
              <div className="size-8 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
