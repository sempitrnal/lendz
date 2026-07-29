"use client";

import { ChevronDown, Search, AlertCircle, CheckCircle2 } from "lucide-react";
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

function getCategoryTextColor(bgColor: string | null): string {
  if (!bgColor) return "text-slate-600 dark:text-slate-300";
  const color = bgColor.toLowerCase();
  if (color.includes("orange") || color.includes("amber") || color.includes("yellow")) return "text-orange-600 dark:text-orange-400";
  if (color.includes("red") || color.includes("rose")) return "text-red-600 dark:text-red-400";
  if (color.includes("green") || color.includes("emerald")) return "text-green-600 dark:text-green-400";
  if (color.includes("blue") || color.includes("sky")) return "text-blue-600 dark:text-blue-400";
  if (color.includes("purple") || color.includes("violet")) return "text-purple-600 dark:text-purple-400";
  return "text-slate-600 dark:text-slate-300";
}

export default function CategorySection({
  cat,
  tz,
}: {
  cat: CategoryData;
  tz: string;
}) {
  const [query, setQuery] = useState("");
  const [expandedPending, setExpandedPending] = useState(true);
  const [expandedPaid, setExpandedPaid] = useState(true);
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
    <section id={`cat-${slugify(cat.label)}`} className="mb-8">
      {/* Category Header */}
      <div
        className="sticky top-16 z-30 -mx-3 sm:-mx-4 md:-mx-6 mb-6 border-b border-slate-200 bg-background px-3 sm:px-4 md:px-6 py-3 sm:py-4 dark:border-slate-800/50"
      >
        <div className="mb-4 flex items-start justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div
                className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full border-2 border-slate-200 dark:border-slate-700 shrink-0"
                style={{
                  backgroundColor: cat.color ?? "#cbd5e1",
                }}
              />
              <h2
                className={`text-base sm:text-lg font-bold tracking-tight ${getCategoryTextColor(cat.color)} uppercase truncate`}
              >
                {cat.label}
              </h2>
            </div>
            <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-4 text-[10px] sm:text-xs">
              <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900/30">
                <p className="text-slate-500 dark:text-slate-400 font-medium truncate">Pending</p>
                <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 mt-1">{cat.pending.length}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900/30">
                <p className="text-slate-500 dark:text-slate-400 font-medium truncate">Paid</p>
                <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 mt-1">{allPaidBorrowers.length}</p>
              </div>
              <div className="rounded-lg bg-orange-50 p-2 dark:bg-orange-950/20">
                <p className="text-orange-600 dark:text-orange-400 font-medium truncate">Remaining</p>
                <p className="text-sm sm:text-base font-bold text-orange-700 dark:text-orange-300 mt-1 truncate">₱{cat.pendingTotal.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/20">
                <p className="text-emerald-600 dark:text-emerald-400 font-medium truncate">Profit</p>
                <p className="text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-300 mt-1 truncate">₱{(cat.pendingProfit + cat.paidProfit).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            placeholder={`Search ${cat.label}…`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              scrollToCategory();
            }}
            onFocus={scrollToCategory}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 sm:py-2.5 pl-9 sm:pl-10 pr-3 sm:pr-4 text-xs sm:text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:ring-slate-800"
          />
        </div>
      </div>

      {/* Pending Section */}
      {cat.pending.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setExpandedPending(!expandedPending)}
            className="w-full flex items-center justify-between gap-2 sm:gap-3 rounded-lg border border-orange-200 bg-gradient-to-r from-orange-50 to-orange-50/50 p-3 sm:p-4 hover:bg-orange-100/50 transition-colors dark:border-orange-900/30 dark:from-orange-950/20 dark:to-orange-950/10 dark:hover:from-orange-950/30"
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400 shrink-0" />
              <div className="text-left min-w-0">
                <p className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">Pending Collection</p>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 truncate">{cat.pending.length} borrower{cat.pending.length !== 1 ? "s" : ""} awaiting</p>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 sm:h-5 sm:w-5 text-slate-600 dark:text-slate-400 shrink-0 transition-transform ${expandedPending ? "rotate-180" : ""}`}
            />
          </button>

          {expandedPending && (
            <div className="mt-4 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPending.length === 0 && q ? (
                <div className="col-span-full flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="h-8 w-8 text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No borrowers found for &ldquo;{query}&rdquo;
                  </p>
                </div>
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
          )}
        </div>
      )}
      {/* Paid Section */}
      {cat.paid.length > 0 && (
        <div>
          <button
            onClick={() => setExpandedPaid(!expandedPaid)}
            className="w-full flex items-center justify-between gap-2 sm:gap-3 rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-50/50 p-3 sm:p-4 hover:bg-emerald-100/50 transition-colors dark:border-emerald-900/30 dark:from-emerald-950/20 dark:to-emerald-950/10 dark:hover:from-emerald-950/30"
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-left min-w-0">
                <p className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 truncate">Fully Paid</p>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 truncate">{cat.paid.length} borrower{cat.paid.length !== 1 ? "s" : ""} • ₱{cat.paidTotal.toLocaleString()}</p>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 sm:h-5 sm:w-5 text-slate-600 dark:text-slate-400 shrink-0 transition-transform ${expandedPaid ? "rotate-180" : ""}`}
            />
          </button>

          {expandedPaid && (
            <div className="mt-4 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPaid.length === 0 && q ? (
                <div className="col-span-full flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No borrowers found for &ldquo;{query}&rdquo;
                  </p>
                </div>
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
          )}
        </div>
      )}
    </section>
  );
}
