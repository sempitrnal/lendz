import BackButton from "@/components/back-button";
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
    <div className="space-y-6">
      <BackButton fallbackHref="/categories" />

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
        <h2 className="mb-3 text-lg font-black lowercase">Borrowers</h2>

        {typedBorrowers.length === 0 ? (
          <p className="text-sm text-gray-500">No borrowers assigned yet</p>
        ) : (
          <CategoryBorrowersGrid
            borrowers={typedBorrowers}
            borrowerAccountCountById={borrowerAccountCountById}
            borrowerNextCollectionById={borrowerNextCollectionById}
          />
        )}
      </div>
      <AssignBorrower
        initialAssigned={typedBorrowers}
        categoryId={categoryId}
        key={categoryId}
      />
    </div>
  );
}