import { getAllBorrowersData } from "@/lib/cache/borrowers";
import BorrowersList from "@/components/borrower/borrower-list";
import { logPageView } from "@/lib/audit";

type BorrowersPageProps = {
  searchParams: Promise<{ q?: string; categories?: string }>;
};

export default async function BorrowersPage({
  searchParams,
}: BorrowersPageProps) {
  const sp = await searchParams;
  const categoryIds = (sp.categories ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const [allBorrowers] = await Promise.all([
      getAllBorrowersData(),
      logPageView("/borrowers"),
    ]);

    return (
      <div className="mx-auto max-w-7xl md:max-w-full px-4 pb-16 md:px-6">
        <BorrowersList
          allBorrowers={allBorrowers}
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
