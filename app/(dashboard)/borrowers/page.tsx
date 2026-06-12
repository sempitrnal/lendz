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
    const allBorrowers = await getAllBorrowersData();

    const borrowersQuery = await supabase
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
      .not(
        "id",
        "in",
        "(394b274c-8b5f-4f9a-8391-02d9354f7ba0,544fc7fc-ee37-4988-be88-7757287f5fb5,44807c06-e653-4e8b-9a55-1536d3ba8309)",
      )
      .order("created_at", { ascending: false })
      .limit(5);
    if (borrowersQuery.error)
      console.error("borrowersQuery error:", borrowersQuery.error);

    const accountsQuery = await supabase
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
      .limit(5);
    if (accountsQuery.error)
      console.error("accountsQuery error:", accountsQuery.error);

    const auditQuery = await supabase
      .from("audit_logs")
      .select(
        `
        id,
        action,
        description,
        account_id,
        created_at,
        metadata
      `,
      )
      .like("action", "schedule.%")
      .order("created_at", { ascending: false })
      .limit(6);
    if (auditQuery.error) console.error("auditQuery error:", auditQuery.error);

    // Fetch accounts + borrowers for ALL audit log account_ids so names resolve
    const auditAccountIds = (auditQuery.data ?? [])
      .map((log: any) => log.account_id)
      .filter(Boolean);
    let auditAccountsData: any[] = [];
    if (auditAccountIds.length > 0) {
      const auditAccountsQuery = await supabase
        .from("accounts")
        .select(
          `
          id,
          borrower_id,
          borrower:borrowers (id, first_name, last_name)
        `,
        )
        .in("id", auditAccountIds);
      if (auditAccountsQuery.error)
        console.error("auditAccountsQuery error:", auditAccountsQuery.error);
      auditAccountsData = (auditAccountsQuery.data ?? []) as any[];
    }

    // Build borrower lookup
    const borrowerByAccountId = new Map<
      string,
      { first_name: string; last_name: string }
    >();
    const borrowerIdByAccountId = new Map<string, string>();
    for (const acct of auditAccountsData) {
      const b = acct.borrower
        ? Array.isArray(acct.borrower)
          ? acct.borrower[0]
          : acct.borrower
        : null;
      if (b?.first_name && acct.id) {
        borrowerByAccountId.set(acct.id, {
          first_name: b.first_name,
          last_name: b.last_name,
        });
      }
      if (acct.borrower_id && acct.id) {
        borrowerIdByAccountId.set(acct.id, acct.borrower_id);
      }
    }

    const EXCLUDED_TEST_BORROWER_IDS = new Set([
      "394b274c-8b5f-4f9a-8391-02d9354f7ba0",
      "544fc7fc-ee37-4988-be88-7757287f5fb5",
      "44807c06-e653-4e8b-9a55-1536d3ba8309",
    ]);

    // Enrich audit logs with borrower info and filter out pending/test-borrower entries
    const enrichedAuditLogs = (auditQuery.data ?? [])
      .map((log: any) => {
        const borrower = log.account_id
          ? borrowerByAccountId.get(log.account_id)
          : null;
        return {
          ...log,
          account: log.account_id
            ? { id: log.account_id, borrower: borrower ?? null }
            : null,
        };
      })
      .filter((log: any) => {
        // Only include paid-related entries
        if (log.action === "schedule.status_changed") {
          const s = log.metadata?.status;
          return s === "paid" || s === "partial";
        }
        if (
          log.action === "schedule.payment_applied" ||
          log.action === "schedule.batch_paid"
        ) {
          return true;
        }
        return false;
      })
      .filter((log: any) => {
        // Exclude test borrowers
        const borrowerId = log.account_id
          ? borrowerIdByAccountId.get(log.account_id)
          : null;
        if (borrowerId && EXCLUDED_TEST_BORROWER_IDS.has(borrowerId)) {
          return false;
        }
        return true;
      });

    return (
      <div className="flex flex-col">
        <BorrowersList
          allBorrowers={allBorrowers}
          initialSearchQuery={searchQuery}
          initialCategoryIds={categoryIds}
          newlyCreatedBorrowers={(borrowersQuery.data ?? []) as any}
          newlyCreatedAccounts={(accountsQuery.data ?? []) as any}
          recentAccountUpdates={(enrichedAuditLogs ?? []) as any}
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
