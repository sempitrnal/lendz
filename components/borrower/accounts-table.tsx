"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import AccountCardMenu from "./account-card-menu";
import { GROUP_STYLES } from "./group-styles";
import type {
  AccountComputedMetrics,
  AccountRow,
} from "./borrower-accounts-section";
import {
  formatAmount,
  payoffPercent,
  releaseDateLabel,
  shortDate,
} from "@/lib/account-card/summary";
import { HIDDEN_AMOUNT } from "@/lib/hide-amounts";

/**
 * The borrower page's accounts as a table, for a tablet or a laptop: one row
 * per account with its terms, progress, what is left and what is next. The
 * whole row opens the account; the menu on the right edits, reverts or
 * deletes it, the same flows as the phone's swipe buttons. Rows come grouped
 * as on the phone ("loans", "cash advances", ...), one heading per group.
 */
export function AccountsTable({
  groups,
  metrics,
  hide,
  openingId,
  onOpen,
  onPrefetch,
  onEdit,
  onActivate,
}: {
  groups: { label: string; accounts: AccountRow[] }[];
  metrics: Record<string, AccountComputedMetrics | undefined>;
  hide: boolean;
  openingId: string | null;
  onOpen(id: string): void;
  onPrefetch(id: string): void;
  onEdit(account: AccountRow): void;
  onActivate(account: AccountRow): void;
}) {
  const mask = (text: string) => (hide ? HIDDEN_AMOUNT : text);
  const year = new Date().getFullYear();

  return (
    <table className="w-full text-sm lowercase">
      <thead className="border-y text-[11px] text-muted-foreground">
        <tr>
          <th className="px-4 py-2 text-left font-semibold">account</th>
          <th className="hidden px-3 py-2 text-left font-semibold lg:table-cell">
            released
          </th>
          <th className="px-3 py-2 text-left font-semibold">progress</th>
          <th className="px-3 py-2 text-right font-semibold">left</th>
          <th className="px-3 py-2 text-right font-semibold">next</th>
          <th className="px-3 py-2 text-left font-semibold">status</th>
          <th className="w-12" />
        </tr>
      </thead>
      {groups.map(({ label, accounts }) => {
        const style = GROUP_STYLES[label];
        return (
          <tbody key={label}>
            <tr>
              <td
                colSpan={7}
                className={cn("px-4 py-1.5 text-xs font-bold", style?.badge)}
              >
                {label}
                <span className="ml-2 opacity-70 tabular-nums">
                  {accounts.length}
                </span>
              </td>
            </tr>
            {accounts.map((account) => {
              const m = metrics[account.id];
              const principal = Number(account.principal_amount ?? 0);
              const isManual = account.schedule_mode === "manual";
              const isRolling = isManual && account.interest_type === "rolling";
              const isPending = account.status === "pending";
              const showCollections = !isPending && (!isManual || isRolling);
              const termMonths = Number(m?.term_months) || 1;
              const pct = payoffPercent(m?.totalPaid ?? 0, m?.totalDue ?? 0);
              const nextPending =
                m?.nextCollections?.find((nc) => nc.status === "pending") ??
                null;
              const overdue = m?.overdueCount ?? 0;
              const terms = isPending
                ? "pending"
                : [
                    account.interest_rate != null
                      ? `${account.interest_rate}%`
                      : null,
                    isManual
                      ? isRolling
                        ? "manual rolling"
                        : "manual flat"
                      : account.payment_frequency,
                    isManual ? null : `${termMonths}mo`,
                  ]
                    .filter(Boolean)
                    .join(" · ");
              const nextAmount =
                showCollections && (m?.nextCollectionAmount ?? 0) > 0
                  ? m!.nextCollectionAmount
                  : 0;
              return (
                <tr
                  key={account.id}
                  onClick={() => onOpen(account.id)}
                  onPointerEnter={() => onPrefetch(account.id)}
                  className={cn(
                    `cursor-pointer border-b transition-colors
                    hover:bg-muted/50`,
                    openingId === account.id && "opacity-60",
                  )}
                >
                  <td className="px-4 py-3">
                    <p
                      className="text-base font-black text-card-foreground/80
                        tabular-nums"
                    >
                      {mask(`₱${formatAmount(principal)}`)}
                    </p>
                    <p
                      className="text-[11px] font-semibold
                        text-muted-foreground"
                    >
                      {terms}
                    </p>
                  </td>
                  <td
                    className="hidden px-3 py-3 text-xs font-semibold
                      whitespace-nowrap text-muted-foreground lg:table-cell"
                  >
                    {account.release_date
                      ? releaseDateLabel(account.release_date, year)
                      : "–"}
                  </td>
                  <td className="px-3 py-3">
                    <span className="block h-2 w-24 rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span
                      className="text-[11px] font-bold text-muted-foreground
                        tabular-nums"
                    >
                      {Math.round(pct)}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums">
                    {mask(`₱${formatAmount(m?.amountLeftToPay ?? 0)}`)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="block text-xs font-bold tabular-nums">
                      {nextAmount > 0
                        ? mask(`₱${formatAmount(nextAmount)}`)
                        : "–"}
                    </span>
                    {showCollections && nextPending && (
                      <span
                        className="text-[11px] font-semibold whitespace-nowrap
                          text-muted-foreground"
                      >
                        {shortDate(nextPending.due_date)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {account.pendingSync ? (
                      <span
                        className="text-[11px] font-bold text-sky-600
                          dark:text-sky-300"
                      >
                        syncing…
                      </span>
                    ) : isPending ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onActivate(account);
                        }}
                        className="rounded-full bg-emerald-100 px-3 py-1
                          text-[11px] font-bold text-emerald-700
                          hover:bg-emerald-200 dark:bg-emerald-500/20
                          dark:text-emerald-300"
                      >
                        activate
                      </button>
                    ) : overdue > 0 ? (
                      <span
                        className="rounded-full bg-rose-100 px-2 py-0.5
                          text-[11px] font-bold text-rose-700
                          dark:bg-rose-500/15 dark:text-rose-300"
                      >
                        {overdue} overdue
                      </span>
                    ) : (
                      <span
                        className="rounded-full bg-muted px-2 py-0.5 text-[11px]
                          font-bold text-muted-foreground"
                      >
                        {account.status}
                      </span>
                    )}
                  </td>
                  <td
                    className="pr-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="inline-flex items-center">
                      <AccountCardMenu
                        accountId={account.id}
                        borrowerId={account.borrower_id}
                        onEdit={() => onEdit(account)}
                      />
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 text-muted-foreground"
                      />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        );
      })}
    </table>
  );
}
