"use client";

import { useState } from "react";
import BorrowerScheduleCard, {
  buildBorrowerScheduleCardProps,
} from "@/components/borrower/borrower-schedule-card";
import type { Borrower } from "@/components/borrower/borrower-list";
import type { BorrowerNextCollection } from "@/lib/compute-borrower-next-collection";

type CategoryBorrower = Pick<
  Borrower,
  "id" | "first_name" | "last_name" | "contact" | "created_at"
> & {
  borrower_categories?: Borrower["borrower_categories"];
};

type CategoryBorrowersGridProps = {
  borrowers: CategoryBorrower[];
  borrowerAccountCountById: Record<string, number>;
  borrowerNextCollectionById: Record<string, BorrowerNextCollection>;
};

export default function CategoryBorrowersGrid({
  borrowers,
  borrowerAccountCountById,
  borrowerNextCollectionById,
}: CategoryBorrowersGridProps) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? borrowers.filter((b) => {
        const q = query.toLowerCase();
        return (
          b.first_name.toLowerCase().includes(q) ||
          b.last_name.toLowerCase().includes(q) ||
          (b.contact ?? "").toLowerCase().includes(q)
        );
      })
    : borrowers;

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search borrowers..."
        className="w-full rounded-xl border border-slate-200/80 bg-white px-4
          py-2.5 text-sm text-slate-700 placeholder:text-slate-400
          focus:border-slate-300 focus:outline-none dark:border-slate-800
          dark:bg-card dark:text-foreground dark:placeholder:text-slate-500
          dark:focus:border-slate-700"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">
          No borrowers match &ldquo;{query}&rdquo;
        </p>
      ) : null}
      <div className="columns-1 md:columns-2 xl:columns-3 gap-4 w-full">
        {filtered.map((borrower) => {
          const nextMeta = borrowerNextCollectionById[borrower.id] ?? {
            next_collection_date: null,
            next_collection_amount: 0,
          };
          const borrowerWithSchedules = {
            ...borrower,
            all_schedules: nextMeta.all_schedules,
            account_schedules: nextMeta.account_schedules,
          } as Borrower;
          return (
            <div key={borrower.id} className="break-inside-avoid mb-4">
              <BorrowerScheduleCard
                displayCategory={false}
                {...buildBorrowerScheduleCardProps(borrowerWithSchedules)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
