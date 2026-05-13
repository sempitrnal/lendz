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
  return (
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 *:min-w-0">
      {borrowers.map((borrower) => {
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
              } as Borrower
            }
            showScheduleSummary
          />
        );
      })}
    </div>
  );
}
