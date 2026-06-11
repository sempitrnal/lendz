import { getAllBorrowersData } from "@/lib/cache/borrowers";
import BorrowersList from "@/components/borrower/borrower-list";
import { createSupabaseServer } from "@/lib/supabase/server";

type BorrowersPageProps = {
  searchParams: Promise<{ q?: string; categories?: string }>;
};

export default async function BorrowersPage({
  searchParams,
}: BorrowersPageProps) {
  const sp = await searchParams;
  const searchQuery = (sp.q ?? "").trim();
  const categoryIds = (sp.categories ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const supabase = await createSupabaseServer();
    const [allBorrowers, { data: recentBorrowersData }, { data: recentAccountsData }] = await Promise.all([
      getAllBorrowersData(),
      supabase
        .from("borrowers")
        .select(
          `
          id,
          first_name,
          last_name,
          contact,
          created_at,
          borrower_categories (
            category:categories (
              id,
              name,
              color
            )
          )
        `,
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("accounts")
        .select(
          `
          id,
          borrower_id,
          type,
          principal_amount,
          created_at,
          release_date,
          schedule_mode,
          interest_type,
          borrower:borrowers (
            id,
            first_name,
            last_name
          )
        `,
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    return (
      <div className="flex flex-col">
        <BorrowersList
          allBorrowers={allBorrowers}
          initialSearchQuery={searchQuery}
          initialCategoryIds={categoryIds}
          newlyCreatedBorrowers={(recentBorrowersData ?? []) as any}
          newlyCreatedAccounts={(recentAccountsData ?? []) as any}
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
