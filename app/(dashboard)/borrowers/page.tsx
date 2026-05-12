import { createSupabaseServer } from "@/lib/supabase/server";
import { computeBorrowerNextCollectionById } from "@/lib/compute-borrower-next-collection";
import BorrowersList from "@/components/borrower/borrower-list";
import type { Borrower } from "@/components/borrower/borrower-list";

const PAGE_SIZE = 20;

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
  const from = (currentPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createSupabaseServer();

  // 1. Fetch paginated borrowers with categories
  let query = supabase
    .from("borrowers")
    .select(
      `*, borrower_categories ( category:categories ( id, name, color ) )`,
      { count: "exact" }
    );

  if (searchQuery) {
    const pattern = `%${searchQuery}%`;
    query = query.or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},contact.ilike.${pattern}`
    );
  }

  if (categoryIds.length > 0) {
    const { data: bcRows } = await supabase
      .from("borrower_categories")
      .select("borrower_id")
      .in("category_id", categoryIds);
    const matchingIds = [...new Set((bcRows ?? []).map((r) => r.borrower_id))];
    if (matchingIds.length > 0) {
      query = query.in("id", matchingIds);
    } else {
      query = query.in("id", ["00000000-0000-0000-0000-000000000000"]);
    }
  }

  const { data: borrowerRows, error: borrowerError, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (borrowerError) {
    console.error(borrowerError);
    return (
      <div className="flex flex-col">
        <p>Error loading borrowers.</p>
      </div>
    );
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rawBorrowers = (borrowerRows ?? []) as Borrower[];
  const borrowerIds = rawBorrowers.map((b) => b.id);

  // 2. Fetch accounts for this page's borrowers
  let enrichedBorrowers: Borrower[] = rawBorrowers.map((b) => ({
    ...b,
    has_accounts: false,
    next_collection_date: null,
    next_collection_amount: 0,
  }));

  if (borrowerIds.length > 0) {
    const { data: accountRows } = await supabase
      .from("accounts")
      .select("id, borrower_id")
      .in("borrower_id", borrowerIds);

    const accounts = (accountRows ?? []) as Array<{
      id: string;
      borrower_id: string;
    }>;
    const allAccountIds = accounts.map((a) => a.id);
    const accountIdsByBorrower = new Map<string, string[]>();
    for (const a of accounts) {
      const list = accountIdsByBorrower.get(a.borrower_id) ?? [];
      list.push(a.id);
      accountIdsByBorrower.set(a.borrower_id, list);
    }

    // 3. Fetch payment schedules for those accounts (server-side, no chunking needed)
    if (allAccountIds.length > 0) {
      const { data: scheduleRows } = await supabase
        .from("payment_schedules")
        .select(
          "id, account_id, due_date, amount_due, amount_paid, remaining_amount, status"
        )
        .in("account_id", allAccountIds)
        .order("due_date", { ascending: true })
        .order("id", { ascending: true });

      const schedules = (scheduleRows ?? []) as Array<{
        account_id: string;
        due_date: string;
        amount_due: number | null;
        amount_paid: number | null;
        remaining_amount: number | null;
        status: string;
      }>;

      const nextById = computeBorrowerNextCollectionById(
        borrowerIds,
        accounts,
        schedules
      );

      enrichedBorrowers = rawBorrowers.map((b) => {
        const accIds = accountIdsByBorrower.get(b.id) ?? [];
        const n = nextById[b.id] ?? {
          next_collection_date: null,
          next_collection_amount: 0,
        };
        return {
          ...b,
          has_accounts: accIds.length > 0,
          next_collection_date: n.next_collection_date,
          next_collection_amount: n.next_collection_amount,
          next_collection_amounts: n.next_collection_amounts,
        };
      });
    } else {
      enrichedBorrowers = rawBorrowers.map((b) => ({
        ...b,
        has_accounts: false,
        next_collection_date: null,
        next_collection_amount: 0,
      }));
    }
  }

  return (
    <div className="flex flex-col">
      <BorrowersList
        initialBorrowers={enrichedBorrowers}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        initialSearchQuery={searchQuery}
        initialCategoryIds={categoryIds}
      />
    </div>
  );
}