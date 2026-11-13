"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Check, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/checklist/labels";
import { lateLabel } from "@/lib/checklist/late-label";
import { summarizeRows } from "@/lib/checklist/list-view";
import { groupColorStyle, headerStyle } from "@/lib/checklist/group-color";
import type { RowView } from "@/lib/checklist/row-state";
import { peso } from "@/components/dashboard/checklist-v2/header";
import {
  openLines,
  rowName,
  KindBadge,
} from "@/components/dashboard/checklist-v2/collect-row";
import type {
  CollectRowsApi,
  RowGroup,
} from "@/components/dashboard/checklist-v2/collect-list";

/**
 * The Collect list as a table, for a laptop: one line per borrower with the
 * columns to scan and sort (name, late, amount, profit) and a pay button.
 * The row opens the same pay sheet the phone's row does, and every swipe
 * action is a button or a click here. Arrow keys (or j and k) move the
 * highlight, Enter opens the row and p pays it.
 *
 * `groups` is the phone's grouping; a sorted table drops it and lists every
 * row in one run.
 */

type SortKey = "name" | "late" | "amount" | "profit";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="rounded-md border border-border bg-muted px-1.5 py-0.5
        font-sans text-[10px] font-bold text-muted-foreground"
    >
      {children}
    </kbd>
  );
}

export function CollectTable({
  todayGroups,
  carriedGroups,
  api,
}: {
  todayGroups: RowGroup[];
  carriedGroups: RowGroup[];
  api: CollectRowsApi;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const all = useMemo(
    () => [...todayGroups, ...carriedGroups].flatMap((g) => g.rows),
    [todayGroups, carriedGroups],
  );
  const sorted = useMemo(() => {
    if (!sort) return null;
    const value = (r: RowView) =>
      sort.key === "name"
        ? rowName(r).toLowerCase()
        : sort.key === "late"
          ? r.lateDays
          : sort.key === "amount"
            ? r.left
            : r.profit;
    return [...all].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [all, sort]);

  // The rows in the order they are on screen, for the keyboard.
  const order = sorted ?? all;

  const open = (row: RowView) => {
    if (row.model === null) return api.onRequest(row, "more");
    const lines = openLines(row);
    const hasPayments = row.lines.some(
      (l) => l.state === "paid" || l.recorded > 0,
    );
    if (row.status === "paid" || lines.length > 1 || hasPayments) {
      api.onRequest(row, "payRow");
    } else {
      api.onRequest(row, "openPay");
    }
  };
  const pay = (row: RowView) => {
    if (row.model === null) return api.onTick(row);
    if (row.status === "paid") return api.onRequest(row, "payRow");
    if (openLines(row).length > 1) return api.onRequest(row, "payRow");
    api.onPayAll(row);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [role=dialog], button, a"))
        return;
      const i = order.findIndex((r) => r.item.id === selected);
      const move = (to: number) => {
        const next = order[Math.max(0, Math.min(order.length - 1, to))];
        if (!next) return;
        setSelected(next.item.id);
        document
          .getElementById(`row-${next.item.id}`)
          ?.scrollIntoView({ block: "nearest" });
      };
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        move(i + 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        move(i < 0 ? 0 : i - 1);
      } else if (i >= 0 && e.key === "Enter") {
        e.preventDefault();
        open(order[i]);
      } else if (i >= 0 && e.key === "p") {
        e.preventDefault();
        pay(order[i]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, selected, api]);

  const sortBy = (key: SortKey) =>
    setSort((prev) =>
      prev?.key === key
        ? prev.dir === 1
          ? { key, dir: -1 }
          : null
        : { key, dir: 1 },
    );
  const th = (label: string, key: SortKey, align = "text-left") => (
    <th className={cn("px-3 py-2 font-semibold", align)}>
      <button
        type="button"
        onClick={() => sortBy(key)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          sort?.key === key && "text-foreground",
        )}
      >
        {label}
        <ArrowUpDown className="size-3" aria-hidden="true" />
      </button>
    </th>
  );

  const renderRow = (row: RowView, group?: RowGroup) => {
    const id = row.item.id;
    const isNote = row.model === null;
    const done = isNote ? row.item.is_checked : row.status === "paid";
    const lines = openLines(row);
    const multi = !isNote && lines.length > 1;
    const first = lines[0] ?? row.lines[0];
    const name = rowName(row);
    const borrowerId = row.model?.borrower?.id ?? null;
    const active = id === selected;
    const kinds = [...new Set(row.lines.map((l) => l.type))];
    const partial = row.status === "partial";
    return (
      <tr
        key={id}
        id={`row-${id}`}
        style={groupColorStyle(group?.color)}
        aria-selected={active}
        onClick={() => {
          setSelected(id);
          open(row);
        }}
        className={cn(
          "cursor-pointer border-b transition-colors",
          active ? "bg-emerald-500/10" : "hover:bg-muted/50",
          api.flashIds.has(id) && "bg-primary/10",
        )}
      >
        <td className="relative px-3 py-2.5">
          {active && (
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1 bg-emerald-500"
            />
          )}
          <div className={cn("flex items-center gap-2", done && "opacity-55")}>
            {borrowerId ? (
              <Link
                href={`/borrowers/${borrowerId}`}
                onClick={(e) => e.stopPropagation()}
                className="font-bold text-card-foreground/80 hover:underline"
              >
                {name}
              </Link>
            ) : (
              <span className="font-bold text-card-foreground/80">{name}</span>
            )}
            {multi && (
              <span
                className="rounded-full bg-muted px-1.5 text-[10px] font-bold
                  text-muted-foreground"
              >
                {lines.length} due
              </span>
            )}
            {row.model?.note && (
              <NotebookPen
                className="size-3.5 text-amber-500"
                aria-label="Has a note"
              />
            )}
            {api.waitingIds.has(id) && (
              <span className="text-[10px] font-bold text-sky-600">
                syncing…
              </span>
            )}
          </div>
        </td>
        <td
          className="px-3 py-2.5 text-xs font-semibold whitespace-nowrap
            text-muted-foreground"
        >
          {!isNote && first
            ? formatShortDate(first.due_date).toLowerCase()
            : ""}
        </td>
        <td className="px-3 py-2.5 text-xs font-bold whitespace-nowrap">
          {row.lateDays > 0 && !done ? (
            <span className="text-rose-600 dark:text-rose-400">
              {lateLabel(row.lateDays).short} late
            </span>
          ) : (
            <span className="text-muted-foreground/50">–</span>
          )}
        </td>
        <td
          className="hidden px-3 py-2.5 text-xs font-semibold whitespace-nowrap
            text-muted-foreground xl:table-cell"
        >
          <span className="flex gap-x-2 whitespace-nowrap">
            {kinds.map((t) => (
              <KindBadge key={t} type={t} compact />
            ))}
          </span>
        </td>
        <td className="px-3 py-2.5 text-right">
          {partial && (
            <span
              className="block text-[11px] text-muted-foreground tabular-nums
                line-through"
            >
              {peso(row.total)}
            </span>
          )}
          <span
            className={cn(
              "font-bold text-zinc-600 tabular-nums",
              done && "text-muted-foreground opacity-55",
            )}
          >
            {peso(done ? row.total : row.left)}
          </span>
        </td>
        <td
          className={cn(
            "px-3 py-2.5 text-right text-xs font-bold tabular-nums",
            row.profit > 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-muted-foreground/50",
          )}
        >
          {row.profit > 0 ? `+${peso(row.profit)}` : "–"}
        </td>
        <td className="px-3 py-2.5 text-right">
          <button
            type="button"
            aria-label={
              done
                ? `Payments for ${name}`
                : multi
                  ? `Pay ${lines.length} installments for ${name}`
                  : `Mark ${name} paid, ${peso(row.left)}`
            }
            onClick={(e) => {
              e.stopPropagation();
              pay(row);
            }}
            className={cn(
              `inline-flex size-7 items-center justify-center rounded-full
              text-[11px] font-bold transition-colors`,
              done
                ? "bg-primary text-primary-foreground"
                : partial
                  ? "border border-primary/50 text-primary hover:bg-primary/10"
                  : `border border-muted-foreground/40 text-muted-foreground
                    hover:border-primary hover:bg-primary/10 hover:text-primary`,
            )}
          >
            {multi && !done ? (
              lines.length
            ) : (
              <Check className="size-4" strokeWidth={3} aria-hidden="true" />
            )}
          </button>
        </td>
      </tr>
    );
  };

  const groupHeader = (g: RowGroup) => {
    const t = summarizeRows(g.rows, api.paidIds);
    return (
      <tr key={`h-${g.key}`} style={groupColorStyle(g.color)}>
        <td
          colSpan={7}
          className={cn(
            "px-3 py-2 text-xs font-black",
            g.color
              ? `bg-[color-mix(in_oklch,var(--hdr)_55%,var(--card))]
                text-(--hdr-name) dark:text-(--hdr-name-dark)`
              : "bg-muted/60",
          )}
          style={headerStyle(g.color)}
        >
          {g.name}
          <span className="ml-2 font-semibold tabular-nums opacity-70">
            {t.done}/{t.count}
          </span>
          {t.left > 0 && (
            <span className="float-right tabular-nums">{peso(t.left)}</span>
          )}
        </td>
      </tr>
    );
  };

  const section = (label: string, groups: RowGroup[], tone?: "carry") =>
    groups.length > 0 && (
      <tbody key={label}>
        {tone === "carry" && (
          <tr aria-hidden="true">
            <td colSpan={7} className="h-4 bg-card p-0" />
          </tr>
        )}
        {tone === "carry" && (
          <tr>
            <td
              colSpan={7}
              className="bg-amber-500/10 px-3 py-2 text-xs font-bold
                text-amber-800 dark:text-amber-300"
            >
              carried over
              <span className="ml-2 tabular-nums">
                {peso(
                  summarizeRows(
                    groups.flatMap((g) => g.rows),
                    api.paidIds,
                  ).left,
                )}
              </span>
            </td>
          </tr>
        )}
        {groups.flatMap((g) => [
          groupHeader(g),
          ...g.rows.map((r) => renderRow(r, g)),
        ])}
      </tbody>
    );

  return (
    <div
      className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1
        ring-black/5 lowercase dark:ring-white/10"
    >
      <table className="w-full text-sm">
        <thead className="border-b bg-card text-[11px] text-muted-foreground">
          <tr>
            {th("borrower", "name")}
            <th className="px-3 py-2 text-left font-semibold">due</th>
            {th("late", "late")}
            <th
              className="hidden px-3 py-2 text-left font-semibold xl:table-cell"
            >
              type
            </th>
            {th("amount", "amount", "text-right")}
            {th("profit", "profit", "text-right")}
            <th className="w-12 px-3 py-2" />
          </tr>
        </thead>
        {sorted ? (
          <tbody>{sorted.map((r) => renderRow(r))}</tbody>
        ) : (
          <>
            {section("today", todayGroups)}
            {section("carried", carriedGroups, "carry")}
          </>
        )}
      </table>
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5
          text-[11px] font-semibold text-muted-foreground"
      >
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> move
        </span>
        <span className="flex items-center gap-1">
          <Kbd>enter</Kbd> open
        </span>
        <span className="flex items-center gap-1">
          <Kbd>p</Kbd> mark paid
        </span>
        <span className="ml-auto">
          {sort
            ? "sorted · click the column again to go back to groups"
            : "grouped by category · click a column to sort"}
        </span>
      </div>
    </div>
  );
}
