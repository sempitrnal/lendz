"use client";

import { Search } from "lucide-react";
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


    </section>
  );
}
