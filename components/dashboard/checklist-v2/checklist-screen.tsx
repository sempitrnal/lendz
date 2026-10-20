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
import {
  NoteSheet,
  RowMenuSheet,
  rowBorrower,
} from "@/components/dashboard/checklist-v2/row-sheets";
import type { AddMode } from "@/lib/checklist/add-sheet";
import type { DailyChecklistItem } from "@/lib/checklist/types";
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

/** The remove toast and its Undo (Global Constraints: 6000 ms for remove). */
const REMOVE_TOAST_MS = 6000;

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
   * The row sheet asked for (pay, edit payments, partial, note, row menu);
   * each renders from it below.
   */
  const [rowSheet, setRowSheet] = useState<RowSheetRequest | null>(null);
  const [addSheet, setAddSheet] = useState<AddSheetRequest | null>(null);
  const sheetSeq = useRef(0);
  /** Rows whose Remove is under way, so a double tap removes (and toasts) once. */
  const removingRef = useRef(new Set<string>());
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
    removeItems,
    restoreItems,
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
  const moreOpen = !!sheetRow && rowSheet?.kind === "more";
  const noteOpen = !!sheetRow && rowSheet?.kind === "note";
  /**
   * Opens the add sheet. With `editItemId` it is Edit item on that row (from
   * the row menu); otherwise it is the header's "+".
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
    const id = rowBorrower(row)?.id;
    if (!id) return;
    closeSheet();
    closeAdd();
    router.push(`/borrowers/${id}`);
  };

  /**
   * Remove from list: deletes the checklist item only (never its payments)
   * and offers Undo, which puts the same row back (same id) on the day it
   * came from. The toast tells the truth about the delete: if it fails the
   * row returns and the toast goes; if it is queued offline the toast says so.
   */
  const removeRow = (row: RowView) => {
    const id = row.item.id;
    if (loading || removingRef.current.has(id)) return;
    removingRef.current.add(id);
    // By then the row has left the list, so it can't be tapped again.
    const release = () => removingRef.current.delete(id);
    const timer = window.setTimeout(release, 1000);
    closeSheet();
    const name = rowName(row);

    let settle: (outcome: "saved" | "queued" | "failed") => void = () => {};
    const settled = new Promise<"saved" | "queued" | "failed">((resolve) => {
      settle = resolve;
    });
    const toastId = `remove-${id}-${Date.now()}`;
    let undone = false;
    const undo = async (rows: DailyChecklistItem[]) => {
      // Once only, and never ahead of the delete it takes back: a failed
      // delete already put the row back.
      if (undone) return;
      undone = true;
      if ((await settled) === "failed") return;
      release();
      await restoreItems(rows);
    };
    const removed = removeItems([id], (outcome) => {
      if (outcome === "failed") {
        window.clearTimeout(timer);
        release();
        toast.dismiss(toastId);
      } else if (outcome === "queued" && !undone) {
        toast(`${name} removed from the list · will sync when online`, {
          id: toastId,
          duration: REMOVE_TOAST_MS,
          action: { label: "Undo", onClick: () => void undo(removed) },
        });
      }
      settle(outcome);
    });
    if (removed.length === 0) {
      window.clearTimeout(timer);
      release();
      return;
    }
    toast(`${name} removed from the list`, {
      id: toastId,
      duration: REMOVE_TOAST_MS,
      action: { label: "Undo", onClick: () => void undo(removed) },
    });
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
            // The gesture-free path to the row menu (Edit item, Open
            // borrower page, Remove; the spec's open question 2).
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
      <Sheet open={moreOpen} onClose={closeSheet} label="Row menu">
        {moreOpen && sheetRow && rowSheet && (
          <RowMenuSheet
            key={rowSheet.seq}
            row={sheetRow}
            disabled={loading}
            onEditItem={() => openAdd("collect", sheetRow.item.id)}
            onEditNote={() => requestSheet("note", sheetRow.item.id)}
            onOpenBorrower={() => openBorrower(sheetRow)}
            onRemove={() => removeRow(sheetRow)}
          />
        )}
      </Sheet>
      <Sheet
        open={noteOpen}
        onClose={closeSheet}
        label={sheetRow?.model ? "Note" : "Edit note"}
      >
        {noteOpen && sheetRow && rowSheet && (
          <NoteSheet
            key={rowSheet.seq}
            row={sheetRow}
            date={date}
            disabled={loading}
            setLabel={setLabel}
            onOpenBorrower={() => openBorrower(sheetRow)}
            onClose={closeSheet}
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
            onOpenBorrower={() => {
              if (editRow) openBorrower(editRow);
            }}
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
