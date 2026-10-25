"use client";

import { useMonthProfit } from "@/components/dashboard/checklist-v2/use-month-profit";
import { cn } from "@/lib/utils";
import { useWideScreen } from "@/lib/hooks/use-wide-screen";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useBorrowersSearch } from "@/hooks/use-borrowers-search";
import { useCachedSchedules } from "@/components/dashboard/checklist/use-cached-schedules";
import { useChecklistItems } from "@/components/dashboard/checklist-v2/use-checklist-items";
import { Header } from "@/components/dashboard/checklist-v2/header";
import { OfflineBanner } from "@/components/dashboard/checklist-v2/offline-banner";
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
import { ScheduleCheckDialog } from "@/components/dashboard/checklist/payment-dialogs";
import { EditPaymentsSheet } from "@/components/dashboard/checklist-v2/edit-payments-sheet";
import { AddSheet } from "@/components/dashboard/checklist-v2/add-sheet";
import {
  NoteSheet,
  RowMenuSheet,
  rowBorrower,
} from "@/components/dashboard/checklist-v2/row-sheets";
import {
  BulkPaidSheet,
  ListMenuSheet,
} from "@/components/dashboard/checklist-v2/list-menu-sheets";
import { useBulkPaid } from "@/components/dashboard/checklist-v2/use-bulk-paid";
import {
  dismissUndoToasts,
  undoToast,
} from "@/components/dashboard/checklist-v2/undo-toasts";
import { ReleaseList } from "@/components/dashboard/checklist-v2/release-list";
import {
  ReleaseEditSheet,
  ReleaseMenuSheet,
} from "@/components/dashboard/checklist-v2/release-sheets";
import { releaseDisplayName } from "@/lib/checklist/release-edit";
import { extractBorrowerMention } from "@/lib/checklist/labels";
import { CreateAccountSheet } from "@/components/dashboard/checklist-v2/create-account-sheet";
import { useInvalidateBorrowerDetails } from "@/lib/hooks/use-borrower-details";
import { isConnectionGood } from "@/lib/offline/connection";
import {
  buildReleaseView,
  type ReleaseRowView,
} from "@/lib/checklist/release-items";
import {
  canLeaveCreate,
  checkedOffWithoutAccountText,
  reduceCreateMarks,
  releaseRowState,
  releaseProgress,
  releaseTotal,
  tickAfterCreateText,
  type CreateEvent,
  type CreateMarks,
} from "@/lib/checklist/release-list";
import type { AddMode } from "@/lib/checklist/add-sheet";
import type {
  DailyChecklistItem,
  DueChecklistGroup,
} from "@/lib/checklist/types";
import { selectPopulateLabels } from "@/lib/checklist/populate";
import {
  autoPopulateLabel,
  summarizeAutoPopulate,
  summarySeenKey,
} from "@/lib/checklist/populate-summary";
import { GUIDE_TOUR_ID } from "@/lib/tours/tours";
import { CelebrationHost } from "@/components/dashboard/checklist-v2/celebration";
import { PopulateSummarySheet } from "@/components/dashboard/checklist-v2/populate-summary-sheet";
import { bulkPaidRows } from "@/lib/checklist/bulk-paid";
import {
  addedBorrowersText,
  clearedItemsText,
  dueGroupsErrorText,
  dueGroupsUrl,
  NOTHING_NEW_TO_ADD,
  NOTHING_TO_UNDO_POPULATE,
  planUndoPopulate,
  QUEUED_SUFFIX,
  undoPopulateText,
} from "@/lib/checklist/list-menu";
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

/** The remove and clear toasts and their Undo (Global Constraints: 6000 ms). */
const REMOVE_TOAST_MS = 6000;
/** The populate toast and its Undo (Global Constraints: 8000 ms). */
const POPULATE_TOAST_MS = 8000;

/**
 * The due collections for a day and the 7 days before (read only). A failed
 * load says what the old widget said.
 */
async function fetchDueGroups(date: string): Promise<DueChecklistGroup[]> {
  const fail = () => new Error(dueGroupsErrorText(navigator.onLine));
  let res: Response;
  try {
    res = await fetch(dueGroupsUrl(date));
  } catch {
    throw fail();
  }
  if (!res.ok) throw fail();
  try {
    const { groups } = (await res.json()) as { groups?: DueChecklistGroup[] };
    if (!Array.isArray(groups)) throw fail();
    return groups;
  } catch {
    throw fail();
  }
}

/**
 * The last populate on the day, for its Undo (the toast's and the menu's
 * share it, so it runs once).
 */
type PopulateRun = {
  date: string;
  rows: { id: string; label: string }[];
  used: boolean;
};

/** A release row's menu or edit sheet; `seq` keys each open. */
type ReleaseSheetRequest = {
  kind: "menu" | "edit";
  itemId: string;
  seq: number;
};

/** The create-account sheet for a release item; `seq` keys each open. */
type CreateSheetRequest = { itemId: string; seq: number };

/** The "Check off without account" toast and its Undo (6000 ms). */
const CHECK_OFF_TOAST_MS = 6000;

/** The list menu ("⋯") or the bulk sheet; `seq` keys each open. */
type ListSheetRequest = { kind: "menu" | "bulk"; seq: number };

/**
 * A sheet a row asked for. `seq` grows on every request so the sheet can key
 * its content on it and open clean each time.
 */
export type RowSheetRequest = {
  kind: RowRequest;
  itemId: string;
  /** A pay request for one schedule of the row, not all of them. */
  lineId?: string;
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

/** Whether this device has already shown the day's morning summary. */
function summarySeen(date: string): boolean {
  try {
    return localStorage.getItem(summarySeenKey(date)) !== null;
  } catch {
    return false;
  }
}

/** Sets (or, with null, removes) one query param without a navigation. */
function setUrlParam(key: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  window.history.replaceState(null, "", url);
}

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
  const reduceMotion = useReducedMotion();
  // The day lives in the URL too (`?date=2026-10-20`); today has no param, so
  // a reload on a later day opens on that day, not the old one.
  const [date, setDate] = useState(() => {
    const value = new URLSearchParams(window.location.search).get("date");
    return value &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !isNaN(Date.parse(value))
      ? value
      : today;
  });
  // The tab lives in the URL (`?tab=collect` or `?tab=release`) so a reload or
  // a shared link opens on it. This only mounts on the client, so reading the
  // address here is safe.
  const [tab, setTabState] = useState<ChecklistTab>(() =>
    new URLSearchParams(window.location.search).get("tab") === "release"
      ? "release"
      : "collect",
  );
  // Desktop width shows both lists at once, so neither tab is ever "left".
  const wide = useWideScreen();
  const collectShown = wide || tab === "collect";
  const releaseShown = wide || tab === "release";
  const setTab = (next: ChecklistTab) => {
    setTabState(next);
    setUrlParam("tab", next);
  };
  const [filter, setFilter] = useState<ChecklistFilter>("all");
  /** The one row whose swipe actions are showing. */
  const [swipedId, setSwipedId] = useState<string | null>(null);
  /**
   * The row sheet asked for (pay, edit payments, partial, note, row menu);
   * each renders from it below.
   */
  const [rowSheet, setRowSheet] = useState<RowSheetRequest | null>(null);
  const [addSheet, setAddSheet] = useState<AddSheetRequest | null>(null);
  const [listSheet, setListSheet] = useState<ListSheetRequest | null>(null);
  const [releaseSheet, setReleaseSheet] = useState<ReleaseSheetRequest | null>(
    null,
  );
  const [createSheet, setCreateSheet] = useState<CreateSheetRequest | null>(
    null,
  );
  /**
   * Where creating an account stands per release item on this screen
   * ("creating" while the form's Create runs, then "created"). A created
   * item is never offered "Create account" again, even if ticking it failed.
   * The ref is the same marks for handlers that run after an await.
   */
  const [createMarks, setCreateMarks] = useState<CreateMarks>(() => new Map());
  const createMarksRef = useRef<CreateMarks>(createMarks);
  /** Items whose account was only queued offline, for truthful toasts. */
  const accountQueuedRef = useRef(new Map<string, boolean>());
  /** The populate the menu's "Undo populate" takes back (this day only). */
  const [lastPopulate, setLastPopulate] = useState<PopulateRun | null>(null);
  const [populating, setPopulating] = useState(false);
  /** A populate under way, so a double tap fetches and inserts once. */
  const populatingRef = useRef(false);
  const sheetSeq = useRef(0);
  /** The row a pay just ticked, so a refused pay can untick it. */
  const tickedByPayRef = useRef<string | null>(null);
  /** Rows whose Remove is under way, so a double tap removes (and toasts) once. */
  const removingRef = useRef(new Set<string>());
  const router = useRouter();
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();

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
  const bulkPay = useBulkPaid(setChecked);
  /**
   * The day and its rows as they are now, for work that finishes after an
   * await or from a toast (whose closure is from an earlier render).
   */
  const dateRef = useRef(date);
  const itemsRef = useRef(items);
  useEffect(() => {
    dateRef.current = date;
    itemsRef.current = items;
  }, [date, items]);
  const { data: borrowers = NO_BORROWERS } = useBorrowersSearch();

  /**
   * The create sheet's Create is busy: nothing may close or replace it (the
   * form stays mounted until it says how the run ended). Behind the sheet's
   * backdrop the header and rows can't be reached anyway; this is the guard
   * if they ever are.
   */
  const createBusy = () =>
    !!createSheet &&
    !canLeaveCreate(createMarksRef.current.get(createSheet.itemId));

  const changeDate = (next: string) => {
    if (next === date || createBusy()) return;
    // Undo toasts belong to the day they came from; error toasts that tell
    // the owner to act stay.
    dismissUndoToasts();
    setFilter("all");
    setSwipedId(null);
    setRowSheet(null);
    setAddSheet(null);
    setListSheet(null);
    setCreateSheet(null);
    setReleaseSheet(null);
    // "Undo populate" is for the day it was populated on.
    setLastPopulate(null);
    setDate(next);
    setUrlParam("date", next === today ? null : next);
  };

  const { collectItems, releaseItems } = useMemo(
    () => ({
      collectItems: items.filter((i) => tabOf(i, releasedId) === "collect"),
      releaseItems: items.filter((i) => tabOf(i, releasedId) === "release"),
    }),
    [items, releasedId],
  );

  const releaseViews = useMemo(
    () => releaseItems.map(buildReleaseView),
    [releaseItems],
  );
  const releaseDone = useMemo(
    () => releaseProgress(releaseViews),
    [releaseViews],
  );
  const releasedTotal = useMemo(
    () => releaseTotal(releaseViews),
    [releaseViews],
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
  const monthProfit = useMonthProfit(date);
  // What the morning run added: shown once per device per day, in a sheet.
  const autoSummary = useMemo(
    () => (date === today ? summarizeAutoPopulate(rows, date) : null),
    [rows, date, today],
  );
  const [summaryClosed, setSummaryClosed] = useState<Set<string>>(
    () => new Set(),
  );
  // A beat after the screen is up: a sheet that opens while the page is still
  // hydrating dims it before React has finished (a hydration warning).
  const [summaryReady, setSummaryReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSummaryReady(true), 600);
    return () => clearTimeout(timer);
  }, []);
  const summaryOpen =
    summaryReady &&
    !!autoSummary &&
    !loading &&
    !summaryClosed.has(date) &&
    !summarySeen(date);
  const closeSummary = () => {
    try {
      localStorage.setItem(summarySeenKey(date), "1");
    } catch {
      // Storage blocked: it shows again next visit.
    }
    setSummaryClosed((prev) => new Set(prev).add(date));
  };
  /** What "Mark all paid" is for: the Collect rows not fully paid. */
  const bulkRows = useMemo(() => bulkPaidRows(rows), [rows]);
  const counts = useMemo(() => filterCounts(rows), [rows]);

  const requestSheet = (kind: RowRequest, itemId: string, lineId?: string) => {
    sheetSeq.current += 1;
    setReleaseSheet(null);
    setRowSheet({ kind, itemId, lineId, seq: sheetSeq.current });
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
    if (loading || createBusy()) return;
    sheetSeq.current += 1;
    setRowSheet(null);
    setListSheet(null);
    setCreateSheet(null);
    setReleaseSheet(null);
    setAddSheet({ mode, editItemId, seq: sheetSeq.current });
  };
  const closeAdd = () => setAddSheet(null);
  const editRow = addSheet?.editItemId
    ? (rows.find((r) => r.item.id === addSheet.editItemId) ?? null)
    : null;
  // Edit item is for collection rows; a row removed meanwhile closes it.
  const addOpen = !!addSheet && (!addSheet.editItemId || !!editRow?.model);
  const menuOpen = listSheet?.kind === "menu" && collectShown;
  // Closes by itself once nothing is left to mark.
  const bulkOpen =
    listSheet?.kind === "bulk" && collectShown && bulkRows.length > 0;
  const openBorrower = (row: RowView) => {
    const id = rowBorrower(row)?.id;
    if (!id) return;
    closeSheet();
    closeAdd();
    router.push(`/borrowers/${id}`);
  };

  /**
   * Deletes checklist items only (never their payments) and offers Undo,
   * which puts the same rows back (same ids) on the day they came from. The
   * toast tells the truth about the delete: if it fails the rows return and
   * the toast goes; if it is queued offline the toast says so. Rows already
   * being removed are skipped, so a double tap removes (and toasts) once.
   */
  const removeWithUndo = (ids: string[], text: (count: number) => string) => {
    const fresh = ids.filter((id) => !removingRef.current.has(id));
    if (loading || fresh.length === 0) return;
    for (const id of fresh) removingRef.current.add(id);
    // By then the rows have left the list, so they can't be tapped again.
    const release = () => {
      for (const id of fresh) removingRef.current.delete(id);
    };
    const timer = window.setTimeout(release, 1000);

    let settle: (outcome: "saved" | "queued" | "failed") => void = () => {};
    const settled = new Promise<"saved" | "queued" | "failed">((resolve) => {
      settle = resolve;
    });
    const toastId = `remove-${fresh[0]}-${Date.now()}`;
    let undone = false;
    const undo = async (rows: DailyChecklistItem[]) => {
      // Once only, and never ahead of the delete it takes back: a failed
      // delete already put the rows back.
      if (undone) return;
      undone = true;
      if ((await settled) === "failed") return;
      release();
      await restoreItems(rows);
    };
    const removed = removeItems(fresh, (outcome) => {
      if (outcome === "failed") {
        window.clearTimeout(timer);
        release();
        toast.dismiss(toastId);
      } else if (outcome === "queued" && !undone) {
        undoToast(`${text(removed.length)}${QUEUED_SUFFIX}`, {
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
    undoToast(text(removed.length), {
      id: toastId,
      duration: REMOVE_TOAST_MS,
      action: { label: "Undo", onClick: () => void undo(removed) },
    });
  };

  /** Remove from list (row menu): this row's item only. */
  const removeRow = (row: RowView) => {
    const id = row.item.id;
    if (loading || removingRef.current.has(id)) return;
    closeSheet();
    const name = rowName(row);
    removeWithUndo([id], () => `${name} removed from the list`);
  };

  const openList = (kind: ListSheetRequest["kind"]) => {
    if (loading || createBusy()) return;
    sheetSeq.current += 1;
    setRowSheet(null);
    setAddSheet(null);
    setCreateSheet(null);
    setReleaseSheet(null);
    setListSheet({ kind, seq: sheetSeq.current });
  };
  const closeList = () => setListSheet(null);

  /** A Release row's "⋯": its menu (Edit, Open borrower, Remove). */
  const openReleaseMenu = (view: ReleaseRowView) => {
    if (createBusy() || releaseState(view) === "creating") return;
    sheetSeq.current += 1;
    setRowSheet(null);
    setAddSheet(null);
    setListSheet(null);
    setCreateSheet(null);
    setReleaseSheet({
      kind: "menu",
      itemId: view.item.id,
      seq: sheetSeq.current,
    });
  };
  const closeRelease = () => setReleaseSheet(null);
  const editRelease = (view: ReleaseRowView) => {
    if (loading) return;
    sheetSeq.current += 1;
    setReleaseSheet({
      kind: "edit",
      itemId: view.item.id,
      seq: sheetSeq.current,
    });
  };
  /** Remove from list (release menu): this item only, never an account. */
  const removeRelease = (view: ReleaseRowView) => {
    const id = view.item.id;
    if (loading || removingRef.current.has(id)) return;
    closeRelease();
    const name = releaseDisplayName(view);
    removeWithUndo([id], () => `${name} removed from the list`);
  };

  const markCreate = (event: CreateEvent) => {
    const next = reduceCreateMarks(createMarksRef.current, event);
    if (next === createMarksRef.current) return;
    createMarksRef.current = next;
    setCreateMarks(next);
  };
  const releaseState = (view: ReleaseRowView) =>
    releaseRowState(view, createMarksRef.current.get(view.item.id));
  /**
   * Opens the create-account sheet for a release item not yet converted. On
   * an "attempted" item it opens on the warning, with no form until "Create
   * anyway".
   */
  const openCreate = (view: ReleaseRowView) => {
    const state = releaseState(view);
    if (loading || createBusy()) return;
    if (state !== "create" && state !== "attempted") return;
    sheetSeq.current += 1;
    setRowSheet(null);
    setAddSheet(null);
    setListSheet(null);
    setReleaseSheet(null);
    setCreateSheet({ itemId: view.item.id, seq: sheetSeq.current });
  };
  /**
   * Closes the create sheet, except while its Create runs: the form must stay
   * mounted (and the item marked) until it says how it ended, so a second
   * form can't create a second account. Covers the backdrop and Escape.
   */
  const closeCreate = () => {
    setCreateSheet((prev) =>
      prev && !canLeaveCreate(createMarksRef.current.get(prev.itemId))
        ? prev
        : null,
    );
  };
  const createView = createSheet
    ? (releaseViews.find((v) => v.item.id === createSheet.itemId) ?? null)
    : null;
  const createMark = createView
    ? createMarks.get(createView.item.id)
    : undefined;
  const releaseView = releaseSheet
    ? (releaseViews.find((v) => v.item.id === releaseSheet.itemId) ?? null)
    : null;
  // Closes by itself if the item is gone or the tab is left.
  const releaseMenuOpen =
    !!releaseView && releaseShown && releaseSheet?.kind === "menu";
  const releaseEditOpen =
    !!releaseView && releaseShown && releaseSheet?.kind === "edit";
  const openReleaseBorrower = (view: ReleaseRowView) => {
    const id = extractBorrowerMention(view.item.label)?.id;
    if (!id) return;
    closeRelease();
    router.push(`/borrowers/${id}`);
  };
  const createViewState = createView
    ? releaseRowState(createView, createMark)
    : null;
  // Closes by itself once the item is no longer creatable (ticked here or
  // elsewhere, removed, or its account made here), but never while Create is
  // busy, even if the item was ticked elsewhere meanwhile.
  const createOpen =
    !!createView &&
    (createMark === "creating" ||
      createViewState === "create" ||
      createViewState === "attempted");

  /**
   * Ticks a release item whose account was just created, saying plainly when
   * that fails (the row then offers "Check off", never a second account) or
   * is only queued offline.
   */
  const tickCreated = (itemId: string) =>
    setChecked([itemId], true, (outcome) => {
      const text = tickAfterCreateText(
        outcome,
        accountQueuedRef.current.get(itemId) ?? false,
      );
      if (!text) return;
      if (outcome === "failed") toast.error(text);
      else toast.info(text);
    });

  /**
   * The form created the account (as the old widget did: close, tick the
   * item, refresh the borrower's details, and the page when online). Once per
   * item, and it may arrive after the sheet or the day has changed: the tick
   * goes by item id.
   */
  const accountCreated = (view: ReleaseRowView) => {
    const id = view.item.id;
    if (createMarksRef.current.get(id) === "created") return;
    // The form queues the account when the connection isn't good; this is
    // the same check, at the moment it reports back.
    accountQueuedRef.current.set(id, !isConnectionGood());
    markCreate({ type: "success", id });
    setCreateSheet((prev) => (prev?.itemId === id ? null : prev));
    tickCreated(id);
    if (view.parsed) invalidateBorrowerDetails(view.parsed.borrowerId);
    if (isConnectionGood()) router.refresh();
  };

  /** "Check off without account": ticks it, with Undo on the toast. */
  const checkOffWithoutAccount = (view: ReleaseRowView) => {
    const id = view.item.id;
    // Not while Create is busy (the button is off then too).
    const state = releaseState(view);
    if (loading || (state !== "create" && state !== "attempted")) return;
    closeCreate();
    const forDate = date;
    const toastId = `check-off-${id}-${Date.now()}`;
    let undone = false;
    setChecked([id], true, (outcome) => {
      // The row is back unticked (the hook said why): nothing to undo.
      if (outcome === "failed") toast.dismiss(toastId);
    });
    undoToast(
      checkedOffWithoutAccountText((view.name || "release").toLowerCase()),
      {
        id: toastId,
        duration: CHECK_OFF_TOAST_MS,
        action: {
          label: "Undo",
          onClick: () => {
            if (undone || dateRef.current !== forDate) return;
            // An account made from it since: it stays checked off.
            if (createMarksRef.current.has(id)) return;
            undone = true;
            setChecked([id], false);
          },
        },
      },
    );
  };

  /**
   * Undo populate (the toast's or the menu's): deletes only the rows still
   * as populate left them (label unchanged, not ticked), on the day it ran.
   */
  const undoPopulate = (run: PopulateRun) => {
    if (run.used || dateRef.current !== run.date) return;
    run.used = true;
    setLastPopulate((prev) => (prev === run ? null : prev));
    const { removeIds, kept } = planUndoPopulate(run.rows, itemsRef.current);
    if (removeIds.length === 0) {
      toast.info(NOTHING_TO_UNDO_POPULATE);
      return;
    }
    const text = undoPopulateText(removeIds.length, kept);
    removeItems(removeIds, (outcome) => {
      if (outcome === "saved") toast.success(text);
      else if (outcome === "queued") toast.success(`${text}${QUEUED_SUFFIX}`);
      else if (dateRef.current === run.date) {
        // The rows are back (removeItems showed why): it can be tried again.
        run.used = false;
        setLastPopulate(run);
      }
    });
  };

  /**
   * Populate due: one row per borrower with something due on the day or up
   * to 7 days late who isn't listed yet, in the collect category.
   */
  const populate = async () => {
    if (loading || populatingRef.current) return;
    populatingRef.current = true;
    setPopulating(true);
    const forDate = date;
    try {
      let groups: DueChecklistGroup[];
      try {
        groups = await fetchDueGroups(forDate);
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : dueGroupsErrorText(navigator.onLine),
        );
        return;
      }
      // Another day is showing now: its rows aren't the ones to check.
      if (dateRef.current !== forDate) return;
      const labels = selectPopulateLabels(groups, itemsRef.current);
      if (labels.length === 0) {
        toast.info(NOTHING_NEW_TO_ADD);
        return;
      }
      let queued = false;
      let created: DailyChecklistItem[];
      try {
        created = await addItems(
          labels.map((label) => ({ label, categoryId: collectId })),
          (outcome) => {
            queued = outcome === "queued";
          },
        );
      } catch {
        toast.error("Couldn't add them — check the list");
        return;
      }
      // [] when the insert failed; addItems has said why.
      if (created.length === 0) return;
      const text = `${addedBorrowersText(created.length)}${
        queued ? QUEUED_SUFFIX : ""
      }`;
      if (dateRef.current !== forDate) {
        // Saved on the day it was asked for; no Undo from another day.
        toast.success(text);
        return;
      }
      const run: PopulateRun = {
        date: forDate,
        rows: created.map((c) => ({ id: c.id, label: c.label })),
        used: false,
      };
      setLastPopulate(run);
      undoToast(
        text,
        {
          duration: POPULATE_TOAST_MS,
          action: { label: "Undo", onClick: () => undoPopulate(run) },
        },
        "success",
      );
    } finally {
      populatingRef.current = false;
      setPopulating(false);
    }
  };

  /** Clear all: the Collect tab's items (never payments), with Undo. */
  const clearAll = () => {
    setLastPopulate(null);
    removeWithUndo(
      collectItems.map((i) => i.id),
      (count) => clearedItemsText(count),
    );
  };

  const rowsApi: CollectRowsApi = {
    swipedId,
    onSwiped: (itemId, open) =>
      // Opening one row closes the other; closing only clears its own.
      setSwipedId((prev) => (open ? itemId : prev === itemId ? null : prev)),
    waitingIds,
    flashIds,
    onRequest: (row, kind, lineId) => {
      setSwipedId(null);
      requestSheet(kind, row.item.id, lineId);
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
    <div className={cn("mx-auto pb-32", wide ? "max-w-5xl" : "max-w-md")}>
      <Header
        date={date}
        today={today}
        onDateChange={changeDate}
        tab={tab}
        onTabChange={setTab}
        collectCount={collectItems.length}
        releaseCount={releaseItems.length}
        summary={summary}
        releaseTotal={releasedTotal}
        filter={filter}
        onFilterChange={setFilter}
        counts={counts}
        loading={loading}
        onAdd={openAdd}
        wide={wide}
        monthProfit={monthProfit}
        releaseProgress={releaseDone}
        onMenu={() => openList("menu")}
      />

      <OfflineBanner />

      {loading ? (
        <ListSkeleton />
      ) : wide ? (
        // Side by side: no tab switch, each list scrolls with the page.
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="min-w-0">
            <CollectList
              rows={rows}
              filter={filter}
              borrowers={borrowers}
              isToday={date === today}
              api={rowsApi}
              populating={populating}
              onPopulate={() => void populate()}
            />
          </div>
          <div className="min-w-0">
            <ReleaseList
              views={releaseViews}
              borrowers={borrowers}
              createMarks={createMarks}
              waitingIds={waitingIds}
              flashIds={flashIds}
              disabled={loading}
              onCreate={openCreate}
              onCheckOff={(view) => {
                if (loading || releaseState(view) !== "check-off") return;
                tickCreated(view.item.id);
              }}
              onMenu={openReleaseMenu}
              onNewRelease={() => openAdd("release")}
            />
          </div>
        </div>
      ) : (
        // A short fade and slide from the side the other tab is on; the
        // content swaps at once, so nothing waits on the animation.
        <motion.div
          key={tab}
          initial={{
            opacity: 0,
            x: reduceMotion ? 0 : tab === "release" ? 14 : -14,
          }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
        >
          {tab === "collect" ? (
            <CollectList
              rows={rows}
              filter={filter}
              borrowers={borrowers}
              isToday={date === today}
              api={rowsApi}
              populating={populating}
              onPopulate={() => void populate()}
            />
          ) : (
            <ReleaseList
              views={releaseViews}
              borrowers={borrowers}
              createMarks={createMarks}
              waitingIds={waitingIds}
              flashIds={flashIds}
              disabled={loading}
              onCreate={openCreate}
              onCheckOff={(view) => {
                if (loading || releaseState(view) !== "check-off") return;
                tickCreated(view.item.id);
              }}
              onMenu={openReleaseMenu}
              onNewRelease={() => openAdd("release")}
            />
          )}
        </motion.div>
      )}

      <CelebrationHost />
      <Sheet
        open={summaryOpen}
        onClose={closeSummary}
        label={`${autoPopulateLabel()} update`}
      >
        {autoSummary && (
          <PopulateSummarySheet
            summary={autoSummary}
            borrowers={borrowers}
            onClose={closeSummary}
          />
        )}
      </Sheet>
      <ScheduleCheckDialog
        variant="drawer"
        item={payOpen && sheetRow ? sheetRow.item : null}
        lineIds={rowSheet?.lineId ? [rowSheet.lineId] : undefined}
        onClose={closeSheet}
        onConfirmed={({ settlesAll }) => {
          const row = sheetRow;
          const only = rowSheet?.lineId;
          closeSheet();
          if (!row || row.item.is_checked) return;
          // Tick only when this pay settles the whole row: the installments
          // the dialog showed, and any it didn't.
          const others = only ? row.lines.filter((l) => l.id !== only) : [];
          if (settlesAll && others.every((l) => l.state === "paid")) {
            tickedByPayRef.current = row.item.id;
            setChecked([row.item.id], true);
          }
        }}
        onFailed={() => {
          // The server refused it after the row was ticked: untick it again.
          const id = tickedByPayRef.current;
          tickedByPayRef.current = null;
          if (id) setChecked([id], false);
        }}
      />
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
            onMore={() => requestSheet("more", sheetRow.item.id)}
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
        open={menuOpen}
        onClose={closeList}
        label={date === today ? "Today's list" : "This day's list"}
      >
        {menuOpen && listSheet && (
          <ListMenuSheet
            key={listSheet.seq}
            isToday={date === today}
            unpaidCount={bulkRows.length}
            total={collectItems.length}
            canUndoPopulate={lastPopulate?.date === date}
            disabled={loading}
            populating={populating}
            onPopulate={() => {
              closeList();
              void populate();
            }}
            onMarkAll={() => openList("bulk")}
            onGuide={() => {
              closeList();
              setUrlParam("tour", GUIDE_TOUR_ID);
            }}
            onUndoPopulate={() => {
              closeList();
              if (lastPopulate) undoPopulate(lastPopulate);
            }}
            onClear={() => {
              closeList();
              clearAll();
            }}
            onManageCategories={closeList}
          />
        )}
      </Sheet>
      <Sheet open={bulkOpen} onClose={closeList} label="Mark all as paid">
        {bulkOpen && listSheet && (
          <BulkPaidSheet
            key={listSheet.seq}
            rows={bulkRows}
            date={date}
            disabled={loading}
            onClose={closeList}
            onConfirm={(bulk, paymentDate) => void bulkPay(bulk, paymentDate)}
          />
        )}
      </Sheet>
      <Sheet open={createOpen} onClose={closeCreate} label="Create account">
        {createOpen && createView && createSheet && (
          <CreateAccountSheet
            key={createSheet.seq}
            release={createView}
            date={date}
            mark={createMark}
            getMark={() => createMarksRef.current.get(createView.item.id)}
            onCreateEvent={(type) =>
              markCreate({ type, id: createView.item.id })
            }
            onOpenBorrower={() => {
              if (!createView.parsed) return;
              const id = createView.parsed.borrowerId;
              closeCreate();
              router.push(`/borrowers/${id}`);
            }}
            onCreated={() => accountCreated(createView)}
            onCheckOff={() => checkOffWithoutAccount(createView)}
          />
        )}
      </Sheet>
      <Sheet open={releaseMenuOpen} onClose={closeRelease} label="Release menu">
        {releaseMenuOpen && releaseView && releaseSheet && (
          <ReleaseMenuSheet
            key={releaseSheet.seq}
            view={releaseView}
            disabled={loading}
            onEdit={() => editRelease(releaseView)}
            onOpenBorrower={() => openReleaseBorrower(releaseView)}
            onRemove={() => removeRelease(releaseView)}
          />
        )}
      </Sheet>
      <Sheet open={releaseEditOpen} onClose={closeRelease} label="Edit release">
        {releaseEditOpen && releaseView && releaseSheet && (
          <ReleaseEditSheet
            key={releaseSheet.seq}
            view={releaseView}
            disabled={loading}
            setLabel={setLabel}
            onOpenBorrower={() => openReleaseBorrower(releaseView)}
            onClose={closeRelease}
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
    <div className="mt-3 space-y-3" aria-busy="true">
      {[1, 2].map((i) => (
        <div key={i} className="overflow-hidden border-y border-border bg-card">
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
