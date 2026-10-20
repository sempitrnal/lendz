"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Sheet } from "@/components/dashboard/checklist-v2/sheet";
import { PaySheet } from "@/components/dashboard/checklist-v2/pay-sheet";
import { EditPaymentsSheet } from "@/components/dashboard/checklist-v2/edit-payments-sheet";
import { AddSheet } from "@/components/dashboard/checklist-v2/add-sheet";
import type { AddMode } from "@/lib/checklist/add-sheet";
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
 * The add sheet asked for: the "+" (Collect or Release), or Edit item on a
 * collection row (`editItemId`). `seq` keys the content so each open is clean.
 */
export type AddSheetRequest = {
  mode: AddMode;
  editItemId: string | null;
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
   * The pay and edit-payments sheets render from it below; "note" and "more"
   * are only recorded for now: Task 14 renders the note and row-menu sheets,
   * so until then those requests open nothing.
   */
  const [rowSheet, setRowSheet] = useState<RowSheetRequest | null>(null);
  const [addSheet, setAddSheet] = useState<AddSheetRequest | null>(null);
  const sheetSeq = useRef(0);
  const router = useRouter();

  const {
    items,
    loading,
    releasedId,
    collectId,
    waitingIds,
    flashIds,
    setChecked,
    addItems,
    setLabel,
  } = useChecklistItems(date);
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
    setAddSheet(null);
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

  const requestSheet = (kind: RowRequest, itemId: string) => {
    sheetSeq.current += 1;
    setRowSheet({ kind, itemId, seq: sheetSeq.current });
  };
  const closeSheet = () => setRowSheet(null);
  /** The row the open sheet is about, kept live as payments land. */
  const sheetRow = rowSheet
    ? (rows.find((r) => r.item.id === rowSheet.itemId) ?? null)
    : null;
  const payOpen =
    !!sheetRow?.model &&
    (rowSheet?.kind === "openPay" ||
      rowSheet?.kind === "payRow" ||
      rowSheet?.kind === "partial");
  const editOpen = !!sheetRow?.model && rowSheet?.kind === "editPayments";
  /**
   * Opens the add sheet. With `editItemId` it is Edit item on that row: the
   * row menu (Task 14) calls `openAdd("collect", itemId)`; until then only
   * the header's "+" opens it.
   */
  const openAdd = (mode: AddMode, editItemId: string | null = null) => {
    if (loading) return;
    sheetSeq.current += 1;
    setRowSheet(null);
    setAddSheet({ mode, editItemId, seq: sheetSeq.current });
  };
  const closeAdd = () => setAddSheet(null);
  const editRow = addSheet?.editItemId
    ? (rows.find((r) => r.item.id === addSheet.editItemId) ?? null)
    : null;
  // Edit item is for collection rows; a row removed meanwhile closes it.
  const addOpen = !!addSheet && (!addSheet.editItemId || !!editRow?.model);
  const openBorrower = (row: RowView) => {
    const id = row.model?.borrower?.id;
    if (!id) return;
    closeSheet();
    router.push(`/borrowers/${id}`);
  };

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
      requestSheet(kind, row.item.id);
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
        onAdd={() => openAdd(tab)}
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

      <Sheet open={payOpen} onClose={closeSheet} label="Record payment">
        {payOpen && sheetRow && rowSheet && (
          <PaySheet
            key={rowSheet.seq}
            row={sheetRow}
            startPartial={rowSheet.kind === "partial"}
            setChecked={setChecked}
            onClose={closeSheet}
            onEditRecorded={() =>
              requestSheet("editPayments", sheetRow.item.id)
            }
            onOpenBorrower={() => openBorrower(sheetRow)}
            // The gesture-free path to the row menu (Note, Edit item,
            // Remove; the spec's open question 2). Only recorded here:
            // Task 14 renders the row-menu sheet from this request.
            onMore={() => requestSheet("more", sheetRow.item.id)}
          />
        )}
      </Sheet>
      <Sheet
        open={editOpen}
        onClose={closeSheet}
        label="Edit recorded payments"
      >
        {editOpen && sheetRow && rowSheet && (
          <EditPaymentsSheet
            key={rowSheet.seq}
            row={sheetRow}
            setChecked={setChecked}
            onClose={closeSheet}
            onOpenBorrower={() => openBorrower(sheetRow)}
          />
        )}
      </Sheet>
      <Sheet
        open={addOpen}
        onClose={closeAdd}
        label={editRow ? "Edit item" : "Add to the list"}
      >
        {addOpen && addSheet && (
          <AddSheet
            key={addSheet.seq}
            mode={editRow ? "collect" : addSheet.mode}
            date={date}
            edit={editRow ?? undefined}
            api={{ items, loading, collectId, releasedId, addItems, setLabel }}
            onClose={closeAdd}
          />
        )}
      </Sheet>
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
