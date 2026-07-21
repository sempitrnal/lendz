"use client";

import { ChevronDown, Search } from "lucide-react";
import { useState, useMemo } from "react";
import BorrowerScheduleCard from "@/components/borrower/borrower-schedule-card";

interface ScheduleRow {
  id: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  remaining: number;
  status: string;
}

interface BorrowerWithSchedules {
  borrowerId?: string | null;
  name: string;
  category: string;
  categoryColor: string | null;
  schedules: ScheduleRow[];
}

interface CategoryData {
  label: string;
  color: string | null;
  pending: BorrowerWithSchedules[];
  paid: BorrowerWithSchedules[];
  pendingTotal: number;
  paidTotal: number;
  pendingProfit: number;
  paidProfit: number;
}

function slugify(label: string) {
  return label
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export default function CategorySection({
  cat,
  tz,
}: {
  cat: CategoryData;
  tz: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const scrollToCategory = () => {
    const el = document.getElementById(`cat-${slugify(cat.label)}`);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  const paidFromPending = useMemo(
    () =>
      cat.pending.filter((b) => b.schedules.some((s) => s.status === "paid")),
    [cat.pending],
  );
  const allPaidBorrowers = useMemo(
    () => [...cat.paid, ...paidFromPending],
    [cat.paid, paidFromPending],
  );

  const totalPaidInCategory = useMemo(
    () =>
      cat.paidTotal +
      paidFromPending.reduce(
        (sum, b) =>
          sum +
          b.schedules
            .filter((s) => s.status === "paid")
            .reduce((s, sch) => s + sch.amountDue, 0),
        0,
      ),
    [cat.paidTotal, paidFromPending],
  );

  const pendingData = useMemo(
    () =>
      cat.pending.map((b) => {
        const totalRemaining = b.schedules.reduce(
          (sum, s) => sum + s.remaining,
          0,
        );
        const totalPaid = b.schedules.reduce((sum, s) => sum + s.amountPaid, 0);
        return {
          ...b,
          totalRemaining,
          totalPaid,
          totalExpected: totalPaid + totalRemaining,
        };
      }),
    [cat.pending],
  );

  const paidData = useMemo(
    () =>
      cat.paid.map((b) => {
        const totalPaid = b.schedules.reduce((sum, s) => sum + s.amountDue, 0);
        return { ...b, totalPaid };
      }),
    [cat.paid],
  );

  const filteredPending = useMemo(
    () =>
      q
        ? pendingData.filter((b) => b.name.toLowerCase().includes(q))
        : pendingData,
    [q, pendingData],
  );
  const filteredPaid = useMemo(
    () =>
      q ? paidData.filter((b) => b.name.toLowerCase().includes(q)) : paidData,
    [q, paidData],
  );

  return (
    <section id={`cat-${slugify(cat.label)}`} className="mb-6">
      <div
        className="sticky top-16 sm:top-16 z-30 -mx-4 md:-mx-6 mb-3 flex
          flex-col gap-1.5 border-b border-slate-200 bg-background px-4 md:px-6
          py-2 dark:border-border/50"
      >
        <div className="flex flex-col items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full border border-slate-900/25"
              style={{
                backgroundColor: cat.color ?? "#cbd5e1",
              }}
            />
            <h2
              className="text-sm font-bold uppercase tracking-wider
                text-slate-500 dark:text-foreground"
            >
              {cat.label}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <span
              className="text-xs font-semibold text-slate-400
                dark:text-muted-foreground"
            >
              {cat.pending.length} pending · {allPaidBorrowers.length} paid
            </span>
            {cat.pendingTotal > 0 && (
              <span className="text-xs font-semibold text-slate-400">
                ₱{cat.pendingTotal.toLocaleString()} remaining
              </span>
            )}
            <span className="text-xs font-semibold text-slate-400">
              ₱{totalPaidInCategory.toLocaleString()} paid
            </span>
            <span className="text-xs font-semibold text-amber-500">
              ₱{(cat.pendingProfit + cat.paidProfit).toLocaleString()} profit
            </span>
          </div>
        </div>
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2
              text-slate-400"
          />
          <input
            type="search"
            placeholder={`search ${cat.label}…`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              scrollToCategory();
            }}
            onFocus={scrollToCategory}
            className="w-full rounded-md border border-slate-200 bg-white py-1.5
              pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400
              focus:border-slate-400 focus:outline-none dark:border-border
              dark:bg-muted dark:text-foreground
              dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Pending */}
      {cat.pending.length > 0 && (
        <div className="mb-3">
          <details open className="group">
            <summary
              className="dark:border-border sticky top-[183px] sm:top-[179px]
                z-20 -mx-4 md:-mx-6 flex cursor-pointer list-none items-center
                justify-between border-slate-300 bg-orange-50 px-4 md:px-6 py-2
                dark:bg-[#170e08]"
            >
              <div className="flex items-center gap-2">
                <span
                  className="dark:text-foreground text-xs font-bold
                    tracking-wide text-slate-600 uppercase"
                >
                  pending
                </span>
                <span
                  className="dark:bg-card dark:text-muted-foreground rounded-md
                    border border-slate-900/20 bg-white px-1 py-0.5 text-[10px]
                    font-bold text-slate-600 tabular-nums"
                >
                  {cat.pending.length}
                </span>
              </div>
              <ChevronDown
                className="size-4 shrink-0 text-slate-600 transition-transform
                  group-open:rotate-180"
              />
            </summary>
            <div className="mt-3 grid gap-3 px-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPending.length === 0 && q ? (
                <p
                  className="col-span-full py-4 text-center text-xs
                    text-slate-400 dark:text-muted-foreground"
                >
                  no results for &ldquo;{query}&rdquo;
                </p>
              ) : (
                filteredPending.map((b) => {
                  const schedules = b.schedules.map((s) => ({
                    dueDate: s.dueDate,
                    amount: s.status === "paid" ? s.amountDue : s.remaining,
                    amountPaid:
                      s.status === "paid" ? s.amountDue : s.amountPaid,
                    remaining: s.remaining,
                    status: s.status,
                  }));
                  return (
                    <BorrowerScheduleCard
                      displayCategory={false}
                      key={b.borrowerId ?? b.name}
                      borrowerId={b.borrowerId}
                      name={b.name}
                      category={b.category}
                      categoryColor={b.categoryColor}
                      schedules={schedules}
                      totalPaid={b.totalPaid}
                      totalRemaining={b.totalRemaining}
                      totalExpected={b.totalExpected}
                      tz={tz}
                    />
                  );
                })
              )}
            </div>
          </details>
        </div>
      )}
      {/* Paid */}
      {cat.paid.length > 0 && (
        <div>
          <details open className="group">
            <summary
              className="dark:border-border sticky top-[183px] sm:top-[179px]
                z-20 -mx-4 md:-mx-6 flex cursor-pointer list-none items-center
                justify-between border-slate-400 bg-emerald-50 px-4 md:px-6 py-2
                dark:bg-[#06180b]"
            >
              <div className="flex items-center gap-2">
                <span
                  className="dark:text-foreground text-sm font-bold
                    tracking-wide text-slate-600 uppercase"
                >
                  paid
                </span>
                <span
                  className="dark:bg-card dark:text-muted-foreground rounded-md
                    border border-slate-900/20 bg-white px-2 py-0.5 text-[10px]
                    font-bold text-slate-600 tabular-nums"
                >
                  {cat.paid.length}
                </span>
                {cat.paidTotal > 0 && (
                  <span
                    className="text-[10px] font-bold text-slate-500
                      tabular-nums"
                  >
                    ₱{cat.paidTotal.toLocaleString()}
                  </span>
                )}
              </div>
              <ChevronDown
                className="size-4 shrink-0 text-slate-600 transition-transform
                  group-open:rotate-180"
              />
            </summary>
            <div className="mt-3 grid gap-3 px-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPaid.length === 0 && q ? (
                <p
                  className="col-span-full py-4 text-center text-xs
                    text-slate-400 dark:text-muted-foreground"
                >
                  no results for &ldquo;{query}&rdquo;
                </p>
              ) : (
                filteredPaid.map((b) => {
                  const schedules = b.schedules.map((s) => ({
                    dueDate: s.dueDate,
                    amount: s.amountDue,
                    amountPaid: s.amountDue,
                    remaining: 0,
                    status: "paid" as const,
                  }));
                  return (
                    <BorrowerScheduleCard
                      displayCategory={false}
                      key={b.borrowerId ?? b.name}
                      borrowerId={b.borrowerId}
                      name={b.name}
                      category={b.category}
                      categoryColor={b.categoryColor}
                      schedules={schedules}
                      totalPaid={b.totalPaid}
                      totalRemaining={0}
                      totalExpected={b.totalPaid}
                      variant="paid"
                      tz={tz}
                    />
                  );
                })
              )}
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
