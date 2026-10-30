"use client";

import { useState } from "react";
import { buildBorrowerScheduleCardProps } from "@/components/borrower/borrower-schedule-card";
import BorrowerRowCard from "@/components/borrower/borrower-row-card";
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
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search this category…"
        className="w-full rounded-2xl border border-border bg-card px-4 py-3
          text-sm font-medium shadow-sm placeholder:text-muted-foreground
          focus:border-primary/50 focus:outline-none"
      />
      {filtered.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">
          No borrowers match &ldquo;{query}&rdquo;
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
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
            <BorrowerRowCard
              key={borrower.id}
              displayCategory={false}
              {...buildBorrowerScheduleCardProps(borrowerWithSchedules)}
            />
          );
        })}
      </div>
    </div>
  );
}
