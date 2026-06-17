"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formFieldInputClassName } from "@/lib/form-field-classes";
import { isDarkColor } from "@/lib/utils";

export type PaymentProgress = {
  paid: number;
  total: number;
  pct: number;
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

function formatPrincipal(n: number | null) {
  return `₱${Number(n ?? 0).toLocaleString()}`;
}

function AccountCatalogCard({ account }: { account: AccountListItem }) {
  const name = borrowerLabel(account);
  const freq = account.payment_frequency ?? "—";
  const rate = Number(account.interest_rate ?? 0);
  const prog = account.payment_progress;
  const categories = [...(account.borrower?.borrower_categories ?? [])].sort(
    (a, b) => (a.category?.name ?? "").localeCompare(b.category?.name ?? ""),
  );

  return (
    <Link
      href={`/accounts/${account.id}`}
      className="group block w-full min-w-0 rounded-lg border-2 border-slate-900
        bg-white p-4 text-left transition hover:-translate-y-0.5
        focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-slate-900 dark:border-border dark:bg-card
        dark:focus-visible:outline-border"
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.14em]
          text-slate-500 dark:text-muted-foreground"
      >
        Borrower
      </p>
      <p
        className="mt-0.5 truncate text-lg font-bold lowercase text-slate-700
          dark:text-foreground"
      >
        {name}
      </p>
      {categories.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {categories.map(({ category }) => {
            const { id, color, name: catName } = category;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border
                  border-slate-900/15 px-2.5 py-0.5 text-[10px] font-bold
                  uppercase dark:border-border/40"
              >
                <span
                  className="size-2 shrink-0 rounded-full border
                    border-slate-900/15"
                  style={{ backgroundColor: color ?? "#cbd5e1" }}
                />
                {catName}
              </span>
            );
          })}
        </div>
      ) : null}
      <p
        className="mt-2 text-xs font-medium uppercase tracking-wide
          text-slate-500 dark:text-muted-foreground"
      >
        {account.type.replace("_", " ")}
        <span className="mx-1.5 text-slate-300 dark:text-border">·</span>
        <span className="capitalize">{account.status}</span>
      </p>
      {prog.total > 0 ? (
        <div className="mt-3">
          <div
            className="flex justify-between text-[10px] font-black uppercase
              tracking-wide text-slate-600 dark:text-muted-foreground"
          >
            <span>Schedule progress</span>
            <span className="tabular-nums text-slate-600 dark:text-foreground">
              {prog.pct}%
            </span>
          </div>
          <div
            className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100
              dark:bg-slate-800"
            role="progressbar"
            aria-valuenow={prog.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${prog.paid} of ${prog.total} installments paid`}
          >
            <div
              className="h-full bg-emerald-400 transition-[width]"
              style={{ width: `${prog.pct}%` }}
            />
          </div>
          <p
            className="mt-1 text-[10px] font-semibold text-slate-600
              dark:text-muted-foreground"
          >
            <span className="tabular-nums">{prog.paid}</span> of{" "}
            <span className="tabular-nums">{prog.total}</span> installments paid
          </p>
        </div>
      ) : (
        <p
          className="mt-2 text-[10px] font-bold uppercase tracking-wide
            text-slate-500 dark:text-muted-foreground"
        >
          No payment schedule
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        <div>
          <p
            className="text-[9px] font-bold uppercase tracking-wide
              text-slate-500 dark:text-muted-foreground"
          >
            Principal
          </p>
          <p
            className="font-bold tabular-nums text-slate-600
              dark:text-foreground"
          >
            {formatPrincipal(account.principal_amount)}
          </p>
        </div>
        <div>
          <p
            className="text-[9px] font-bold uppercase tracking-wide
              text-slate-500 dark:text-muted-foreground"
          >
            Interest
          </p>
          <p
            className="font-bold tabular-nums text-slate-600
              dark:text-foreground"
          >
            {rate}%
          </p>
        </div>
        <div>
          <p
            className="text-[9px] font-bold uppercase tracking-wide
              text-slate-500 dark:text-muted-foreground"
          >
            Frequency
          </p>
          <p
            className="font-bold capitalize text-slate-600 dark:text-foreground"
          >
            {freq}
          </p>
        </div>
      </div>
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
        className="rounded-xl border-2 border-slate-900/90 bg-slate-50/50 px-4
          py-3 shadow-[2px_2px_0px_0px_rgb(15_23_42/0.85)] dark:border-border
          dark:bg-muted/50 dark:shadow-none"
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
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs
                      font-black uppercase tracking-wide transition ${
                        selected
                          ? `border-slate-900 bg-slate-900 text-white
                            shadow-[2px_2px_0px_0px_#0f172a] dark:border-border
                            dark:bg-foreground dark:text-background
                            dark:shadow-none`
                          : `border-slate-900/25 bg-white text-slate-800
                            shadow-[1px_1px_0px_0px_rgb(15_23_42/0.12)]
                            hover:border-slate-900/50 dark:border-border/50
                            dark:bg-card dark:text-foreground dark:shadow-none`
                      }`}
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
                    className={`rounded-lg border-2 px-3 py-1.5 text-xs
                      font-black tabular-nums transition ${
                        selected
                          ? `border-slate-900 bg-slate-900 text-white
                            shadow-[2px_2px_0px_0px_#0f172a] dark:border-border
                            dark:bg-foreground dark:text-background
                            dark:shadow-none`
                          : `border-slate-900/25 bg-white text-slate-800
                            shadow-[1px_1px_0px_0px_rgb(15_23_42/0.12)]
                            hover:border-slate-900/50 dark:border-border/50
                            dark:bg-card dark:text-foreground dark:shadow-none`
                      }`}
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
            className="rounded-lg border-2 border-rose-800/35 bg-rose-50 px-3
              py-2 text-xs font-black uppercase tracking-wide text-rose-900
              shadow-[1px_1px_0px_0px_rgb(190_18_60/0.25)] transition
              hover:bg-rose-100/90 dark:border-rose-500/30 dark:bg-rose-950/20
              dark:text-rose-200 dark:shadow-none dark:hover:bg-rose-950/30"
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
