"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useBorrowersSearch } from "@/hooks/use-borrowers-search";
import { useCachedSchedules } from "@/components/dashboard/checklist/use-cached-schedules";
import { useChecklistItems } from "@/components/dashboard/checklist-v2/use-checklist-items";
import { Header } from "@/components/dashboard/checklist-v2/header";
import { CollectList } from "@/components/dashboard/checklist-v2/collect-list";
import { todayDateValue } from "@/lib/checklist/dates";
import { extractScheduleRefs, NO_BORROWERS } from "@/lib/checklist/labels";
import { buildRowView } from "@/lib/checklist/row-state";
import {
  filterCounts,
  summarizeRows,
  type ChecklistFilter,
} from "@/lib/checklist/list-view";
import { tabOf, type ChecklistTab } from "@/lib/checklist/categories";

const noopSubscribe = () => () => {};

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

  const { items, loading, releasedId } = useChecklistItems(date);
  const { data: borrowers = NO_BORROWERS } = useBorrowersSearch();

  const changeDate = (next: string) => {
    if (next === date) return;
    // Toasts (and their Undo) belong to the day they came from.
    toast.dismiss();
    setFilter("all");
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
      />

      {loading ? (
        <ListSkeleton />
      ) : tab === "collect" ? (
        <CollectList
          rows={rows}
          filter={filter}
          borrowers={borrowers}
          isToday={date === today}
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
