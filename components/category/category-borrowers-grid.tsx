"use client";

import { useState } from "react";
import { BorrowerCard } from "@/components/borrower/borrower-card";
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
        className="w-full rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm shadow-[2px_2px_0px_0px_#0f172a] placeholder:text-slate-400 focus:outline-none"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No borrowers match &ldquo;{query}&rdquo;</p>
      ) : null}
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 *:min-w-0">
        {filtered.map((borrower) => {
          const nextMeta = borrowerNextCollectionById[borrower.id] ?? {
            next_collection_date: null,
            next_collection_amount: 0,
          };
          const hasAccounts = (borrowerAccountCountById[borrower.id] ?? 0) > 0;
          return (
            <BorrowerCard
              key={borrower.id}
              borrower={
                {
                  ...borrower,
                  borrower_categories: borrower.borrower_categories ?? [],
                  has_accounts: hasAccounts,
                  next_collection_date: nextMeta.next_collection_date,
                  next_collection_amount: nextMeta.next_collection_amount,
                  next_collection_status: nextMeta.next_collection_status,
                  overdue_count: nextMeta.overdue_count,
                  overdue_total: nextMeta.overdue_total,
                  accounts_count: nextMeta.accounts_count,
                  account_schedules: nextMeta.account_schedules,
                  overdue_schedules: nextMeta.overdue_schedules,
                } as Borrower
              }
              showScheduleSummary
            />
          );
        })}
      </div>
    </div>
  );
}
