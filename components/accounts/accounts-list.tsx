"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formFieldInputClassName } from "@/lib/form-field-classes";
import { cn, formatDate, formatMoney } from "@/lib/utils";

export type PaymentProgress = {
  paid: number;
  total: number;
  pct: number;
};

export type AccountListMetrics = {
  total_paid: number;
  total_remaining: number;
  next_due: string | null;
  next_amount: number;
  next_status: "pending" | "overdue" | null;
  overdue_count: number;
};

export type AccountListItem = {
  id: string;
  borrower_id: string;
  type: string;
  status: string;
  principal_amount: number | null;
  interest_rate: number | null;
  payment_frequency: string | null;
  release_date: string | null;
  payment_progress: PaymentProgress;
  metrics: AccountListMetrics;
  borrower: {
    id: string;
    first_name: string;
    last_name: string;
    borrower_categories?: {
      category: { id: string; name: string; color: string | null };
    }[];
  } | null;
};

function borrowerLabel(a: AccountListItem) {
  const b = a.borrower;
  if (!b) return "Unknown borrower";
  return `${b.first_name} ${b.last_name}`;
}

function categorySearchBlob(a: AccountListItem) {
  const cats = a.borrower?.borrower_categories ?? [];
  return cats.map((bc) => (bc.category?.name ?? "").toLowerCase()).join(" ");
}

function AccountCatalogCard({ account }: { account: AccountListItem }) {
  const name = borrowerLabel(account);
  const freq =
    account.payment_frequency === "bisag kanus-a"
      ? "manual"
      : (account.payment_frequency ?? "—");
  const rate = Number(account.interest_rate ?? 0);
  const prog = account.payment_progress;
  const metrics = account.metrics;
  const categories = [...(account.borrower?.borrower_categories ?? [])].sort(
    (a, b) => (a.category?.name ?? "").localeCompare(b.category?.name ?? ""),
  );

  const statusConfig: Record<string, { bg: string; text: string }> = {
    active: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-300",
    },
    pending: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-300",
    },
    overdue: {
      bg: "bg-rose-100 dark:bg-rose-900/30",
      text: "text-rose-700 dark:text-rose-300",
    },
  };
  const status = statusConfig[account.status] ?? {
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-600 dark:text-slate-300",
  };

  const typeLabel =
    account.type === "cash_advance" ? "cash advance" : account.type;
  const typeBg =
    account.type === "cash_advance"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
      : "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300";

  return (
    <Link
      href={`/accounts/${account.id}`}
      className="group block w-full min-w-0 rounded-xl border bg-white p-4
        text-left shadow-sm transition hover:shadow-md focus-visible:outline-2
        focus-visible:outline-offset-2 focus-visible:outline-slate-300
        dark:border-border dark:bg-card dark:focus-visible:outline-border"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-black",
                "tracking-wide uppercase",
                typeBg,
              )}
            >
              {typeLabel}
            </span>
            {account.status !== "pending" && rate > 0 && (
              <span
                className="text-[11px] font-bold text-slate-500
                  dark:text-slate-400"
              >
                {rate}%
              </span>
            )}
          </div>
          <p
            className="mt-1 truncate text-lg font-black lowercase tracking-tight
              text-slate-800 dark:text-foreground"
          >
            {name}
          </p>
          {categories.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {categories.map(({ category }) => {
                const { id, color, name: catName } = category;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-full
                      border border-slate-900/10 px-2 py-0.5 text-[10px]
                      font-bold uppercase dark:border-border/40"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full border
                        border-slate-900/10"
                      style={{ backgroundColor: color ?? "#cbd5e1" }}
                    />
                    {catName}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-black",
            "uppercase tracking-wide",
            status.bg,
            status.text,
          )}
        >
          {account.status}
        </span>
      </div>
      <div className="mt-3">
        <span
          className="text-2xl font-black tracking-tight tabular-nums
            text-slate-700 dark:text-foreground"
        >
          {formatMoney(account.principal_amount ?? 0)}
        </span>
        <span
          className="ml-1.5 text-[11px] font-medium text-slate-500
            dark:text-muted-foreground"
        >
          {account.status === "pending" ? "pending" : freq}
        </span>
      </div>

      {account.release_date && account.status !== "pending" && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span
            className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-bold
              tracking-wide text-sky-800 dark:bg-sky-900/30 dark:text-sky-300"
          >
            {formatDate(account.release_date)}
          </span>
        </div>
      )}

      {account.status !== "pending" && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div
            className="flex flex-col items-center justify-center rounded-xl
              border border-rose-100/70 bg-linear-to-br from-rose-50/60
              to-rose-100/70 p-3 dark:border-rose-900/20 dark:from-rose-950/30
              dark:to-rose-900/20"
          >
            <p
              className="text-[14px] font-bold tracking-wide text-rose-700/60
                lowercase dark:text-rose-200/70"
            >
              Remaining
            </p>
            <p
              className="text-sm font-black tracking-tight text-rose-400
                tabular-nums dark:text-rose-300/80"
            >
              {formatMoney(metrics.total_remaining)}
            </p>
          </div>
          <div
            className="flex flex-col items-center justify-center rounded-xl
              border border-emerald-100 bg-linear-to-br from-[#f2fffa]
              to-emerald-100 p-3 dark:border-emerald-900/30
              dark:from-emerald-950/30 dark:to-emerald-900/30"
          >
            <p
              className="text-[14px] font-bold tracking-wide text-emerald-700/80
                lowercase dark:text-emerald-200/70"
            >
              Collected
            </p>
            <p
              className="text-sm font-black tracking-tight text-[#599c82]
                dark:text-emerald-200/80 tabular-nums"
            >
              {formatMoney(metrics.total_paid)}
            </p>
          </div>
          <div
            className="flex flex-col items-center justify-center rounded-xl
              border border-violet-100 bg-linear-to-br from-violet-50/60
              to-violet-100/70 p-3 dark:border-violet-900/20
              dark:from-violet-950/30 dark:to-violet-900/20"
          >
            <p
              className="text-[14px] font-bold tracking-wide text-[#6f537b]
                dark:text-[#996bac] lowercase"
            >
              Progress
            </p>
            <p
              className="text-sm font-black tracking-tight text-[#6f537b]
                dark:text-[#996bac] tabular-nums"
            >
              {prog.total > 0 ? `${prog.pct}%` : "—"}
            </p>
          </div>
        </div>
      )}

      {prog.total > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-medium text-slate-400 dark:text-slate-500">
              Schedule progress
            </span>
            <span
              className="font-bold text-slate-700 tabular-nums
                dark:text-slate-300"
            >
              {prog.paid} of {prog.total}
            </span>
          </div>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100
              dark:bg-slate-800"
            role="progressbar"
            aria-valuenow={prog.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${prog.paid} of ${prog.total} installments paid`}
          >
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${prog.pct}%` }}
            />
          </div>
        </div>
      )}

      {metrics.next_due && (
        <div
          className="mt-3 flex items-center justify-between rounded-lg border
            border-slate-200 bg-white p-2 dark:border-border/50 dark:bg-card"
        >
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-semibold tracking-wider text-slate-400
                uppercase dark:text-muted-foreground"
            >
              next
            </span>
            <span
              className="text-[11px] font-bold text-slate-700
                dark:text-slate-200"
            >
              {formatDate(metrics.next_due)}
            </span>
            <span
              className="text-[11px] font-bold text-slate-600 tabular-nums
                dark:text-slate-100"
            >
              {formatMoney(metrics.next_amount)}
            </span>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[8px] font-black uppercase",
              metrics.next_status === "overdue"
                ? `bg-rose-100 text-rose-700 dark:bg-rose-900/30
                  dark:text-rose-300`
                : `bg-amber-100 text-amber-700 dark:bg-amber-900/30
                  dark:text-amber-300`,
            )}
          >
            {metrics.next_status}
          </span>
        </div>
      )}

      {metrics.overdue_count > 0 && (
        <div
          className="mt-2 flex items-center gap-2 rounded-lg border
            border-rose-200 bg-rose-50 p-2 dark:border-rose-900/30
            dark:bg-rose-950/20"
        >
          <span
            className="text-[10px] font-black uppercase text-rose-700
              dark:text-rose-300"
          >
            {metrics.overdue_count} overdue
          </span>
        </div>
      )}

      {account.status === "pending" && (
        <p
          className="mt-3 text-[10px] font-bold uppercase tracking-wide
            text-slate-500 dark:text-muted-foreground"
        >
          No payment schedule yet
        </p>
      )}
    </Link>
  );
}

export default function AccountsList({
  accounts,
}: {
  accounts: AccountListItem[];
}) {
  const [search, setSearch] = useState("");
  const [frequencySet, setFrequencySet] = useState<Set<string>>(new Set());
  const [interestSet, setInterestSet] = useState<Set<string>>(new Set());

  const distinctFrequencies = useMemo(() => {
    const s = new Set<string>();
    accounts.forEach((a) => {
      if (a.payment_frequency) s.add(a.payment_frequency);
    });
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [accounts]);

  const distinctInterests = useMemo(() => {
    const s = new Set<number>();
    accounts.forEach((a) => {
      const n = Number(a.interest_rate);
      if (!Number.isNaN(n)) s.add(n);
    });
    return Array.from(s).sort((a, b) => a - b);
  }, [accounts]);

  const frequencyCounts = useMemo(() => {
    const m = new Map<string, number>();
    accounts.forEach((a) => {
      const f = a.payment_frequency ?? "—";
      m.set(f, (m.get(f) ?? 0) + 1);
    });
    return m;
  }, [accounts]);

  const interestCounts = useMemo(() => {
    const m = new Map<string, number>();
    accounts.forEach((a) => {
      const k = String(Number(a.interest_rate ?? NaN));
      if (k === "NaN") return;
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return m;
  }, [accounts]);

  const normalizedSearch = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const name = borrowerLabel(a).toLowerCase();
      const catBlob = categorySearchBlob(a);
      if (
        normalizedSearch &&
        !name.includes(normalizedSearch) &&
        !catBlob.includes(normalizedSearch)
      ) {
        return false;
      }
      if (frequencySet.size > 0) {
        const f = a.payment_frequency ?? "";
        if (!frequencySet.has(f)) return false;
      }
      if (interestSet.size > 0) {
        const key = String(Number(a.interest_rate ?? NaN));
        if (key === "NaN" || !interestSet.has(key)) return false;
      }
      return true;
    });
  }, [accounts, normalizedSearch, frequencySet, interestSet]);

  function toggleFrequency(f: string) {
    setFrequencySet((prev) => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });
  }

  function toggleInterest(rate: number) {
    const key = String(rate);
    setInterestSet((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  function clearFilters() {
    setFrequencySet(new Set());
    setInterestSet(new Set());
    setSearch("");
  }

  const hasActiveFilters =
    frequencySet.size > 0 ||
    interestSet.size > 0 ||
    normalizedSearch.length > 0;

  const total = accounts.length;
  const shown = filtered.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-600 dark:text-foreground">
          Accounts
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-muted-foreground">
          All loans and cash advances
        </p>
      </div>

      <div
        className="rounded-xl border bg-white px-4 py-3 shadow-sm
          dark:border-border dark:bg-card"
      >
        <p className="text-sm font-bold text-slate-600 dark:text-foreground">
          <span className="tabular-nums">{shown}</span>
          <span
            className="font-normal text-slate-600 dark:text-muted-foreground"
          >
            {" "}
            of <span className="tabular-nums font-semibold">{total}</span>{" "}
            accounts
            {hasActiveFilters ? " match filters" : ""}
          </span>
        </p>
        <p
          className="mt-2 text-xs font-semibold uppercase tracking-wide
            text-slate-500 dark:text-muted-foreground"
        >
          By frequency
          {distinctFrequencies.map((f) => (
            <span key={f} className="ml-2 normal-case">
              <span className="capitalize text-slate-800 dark:text-foreground">
                {f}
              </span>{" "}
              <span
                className="tabular-nums text-slate-600
                  dark:text-muted-foreground"
              >
                ({frequencyCounts.get(f) ?? 0})
              </span>
            </span>
          ))}
        </p>
        {distinctInterests.length > 0 ? (
          <p
            className="mt-1 text-xs font-semibold uppercase tracking-wide
              text-slate-500 dark:text-muted-foreground"
          >
            By interest
            {distinctInterests.map((r) => (
              <span key={r} className="ml-2 normal-case">
                <span className="text-slate-800 dark:text-foreground">
                  {r}%
                </span>{" "}
                <span
                  className="tabular-nums text-slate-600
                    dark:text-muted-foreground"
                >
                  ({interestCounts.get(String(r)) ?? 0})
                </span>
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="accounts-search"
            className="mb-1.5 block text-[10px] font-bold uppercase
              tracking-[0.14em] text-slate-500 dark:text-muted-foreground"
          >
            Search by borrower name
          </label>
          <input
            id="accounts-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type part of first or last name"
            className={formFieldInputClassName}
            aria-label="Search accounts by borrower name"
          />
        </div>

        {distinctFrequencies.length > 0 ? (
          <div>
            <p
              className="mb-1.5 text-[10px] font-bold uppercase
                tracking-[0.14em] text-slate-500 dark:text-muted-foreground"
            >
              Payment frequency
            </p>
            <div className="flex flex-wrap gap-2">
              {distinctFrequencies.map((f) => {
                const selected = frequencySet.has(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFrequency(f)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold",
                      "uppercase tracking-wide transition",
                      selected
                        ? `border-slate-900 bg-slate-900 text-white
                          dark:border-border dark:bg-foreground
                          dark:text-background`
                        : `border-slate-200 bg-white text-slate-700
                          hover:border-slate-300 dark:border-border/50
                          dark:bg-card dark:text-foreground`,
                    )}
                  >
                    <span className="capitalize">{f}</span>{" "}
                    <span className="tabular-nums opacity-80">
                      ({frequencyCounts.get(f) ?? 0})
                    </span>
                  </button>
                );
              })}
            </div>
            <p
              className="mt-1 text-[10px] text-slate-500
                dark:text-muted-foreground"
            >
              Tap to include; multiple selected = match any of them. None
              selected = all frequencies.
            </p>
          </div>
        ) : null}

        {distinctInterests.length > 0 ? (
          <div>
            <p
              className="mb-1.5 text-[10px] font-bold uppercase
                tracking-[0.14em] text-slate-500 dark:text-muted-foreground"
            >
              Interest rate
            </p>
            <div className="flex flex-wrap gap-2">
              {distinctInterests.map((r) => {
                const key = String(r);
                const selected = interestSet.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleInterest(r)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold",
                      "tabular-nums transition",
                      selected
                        ? `border-slate-900 bg-slate-900 text-white
                          dark:border-border dark:bg-foreground
                          dark:text-background`
                        : `border-slate-200 bg-white text-slate-700
                          hover:border-slate-300 dark:border-border/50
                          dark:bg-card dark:text-foreground`,
                    )}
                  >
                    {r}%{" "}
                    <span className="text-[10px] font-bold opacity-80">
                      ({interestCounts.get(key) ?? 0})
                    </span>
                  </button>
                );
              })}
            </div>
            <p
              className="mt-1 text-[10px] text-slate-500
                dark:text-muted-foreground"
            >
              None selected = all rates. Multiple = match any selected rate.
            </p>
          </div>
        ) : null}

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2
              text-xs font-semibold uppercase tracking-wide text-rose-700
              transition hover:bg-rose-100 dark:border-rose-900/30
              dark:bg-rose-950/20 dark:text-rose-200 dark:hover:bg-rose-950/30"
          >
            Clear search & filters
          </button>
        ) : null}
      </div>

      {total === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-slate-300 p-10
            text-center text-slate-500 dark:border-border
            dark:text-muted-foreground"
        >
          No accounts yet.
        </div>
      ) : shown === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-slate-300 p-10
            text-center text-slate-500 dark:border-border
            dark:text-muted-foreground"
        >
          No accounts match the current search and filters.
        </div>
      ) : (
        <div
          className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3
            *:min-w-0"
        >
          {filtered.map((account) => (
            <AccountCatalogCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
