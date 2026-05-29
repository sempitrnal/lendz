import { getBorrowersPageData } from "@/lib/cache/borrowers";
import BorrowersList from "@/components/borrower/borrower-list";

type BorrowersPageProps = {
  searchParams: Promise<{ page?: string; q?: string; categories?: string }>;
};

export default async function BorrowersPage({ searchParams }: BorrowersPageProps) {
  const sp = await searchParams;
  const searchQuery = (sp.q ?? "").trim();
  const categoryIds = (sp.categories ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const currentPage = Math.max(1, Number(sp.page ?? 1));

  try {
    const { borrowers, totalCount, totalPages } = await getBorrowersPageData(
      currentPage,
      searchQuery,
      categoryIds
    );

    return (
      <div className="flex flex-col">
        <BorrowersList
          initialBorrowers={borrowers}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          initialSearchQuery={searchQuery}
          initialCategoryIds={categoryIds}
        />
      </div>
    );
  } catch (error) {
    console.error(error);
    return (
      <div className="flex flex-col">
        <p>Error loading borrowers.</p>
      </div>
    );
  }
}