import AssignBorrower from "@/components/category/assign-borrower";
import CategoryBorrowersGrid from "@/components/category/category-borrowers-grid";
import CategoryDetailStrip from "@/components/category/category-detail-strip";
import { getCategoryDetailPageData } from "@/lib/cache/category-detail";
import type { Borrower } from "@/components/borrower/borrower-list";

export default async function CategoryDetailView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: categoryId } = await params;
  const {
    category,
    borrowers,
    borrowersWithAccountsCount,
    moneyToCollect,
    nextCollectionDate,
    nextCollectionTotal,
    overdueCount,
    overdueTotal,
    borrowerAccountCountById,
    borrowerNextCollectionById,
  } = await getCategoryDetailPageData(categoryId);

  const typedBorrowers = borrowers as unknown as Borrower[];

  return (
    <div className="mx-auto max-w-7xl md:max-w-full px-4 pb-16 md:px-6">
      <CategoryDetailStrip
        name={category?.name ?? "Category"}
        color={category?.color ?? null}
        borrowerCount={typedBorrowers.length}
        borrowersWithAccountsCount={borrowersWithAccountsCount}
        moneyToCollect={moneyToCollect}
        nextCollectionDate={nextCollectionDate}
        nextCollectionTotal={nextCollectionTotal}
        overdueCount={overdueCount}
        overdueTotal={overdueTotal}
      />

      <div>
        <div className="mb-4 mt-5 flex items-center justify-between">
          <h2
            className="text-lg font-bold tracking-tight text-slate-700
              dark:text-foreground"
          >
            Borrowers
          </h2>
          <AssignBorrower
            initialAssigned={typedBorrowers}
            categoryId={categoryId}
            key={categoryId}
          />
        </div>

        {typedBorrowers.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-3
              rounded-2xl border border-dashed border-slate-200 bg-slate-50/30
              py-16 dark:border-slate-800 dark:bg-slate-900/20"
          >
            <p
              className="text-sm font-medium text-slate-400
                dark:text-muted-foreground"
            >
              No borrowers assigned yet
            </p>
          </div>
        ) : (
          <CategoryBorrowersGrid
            borrowers={typedBorrowers}
            borrowerAccountCountById={borrowerAccountCountById}
            borrowerNextCollectionById={borrowerNextCollectionById}
          />
        )}
      </div>
    </div>
  );
}
