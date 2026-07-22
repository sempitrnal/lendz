import { getAllBorrowersData } from "@/lib/cache/borrowers";
import BorrowersList from "@/components/borrower/borrower-list";
import { createSupabaseServer } from "@/lib/supabase/server";
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
    const supabase = await createSupabaseServer();
    await logPageView("/borrowers");
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
          last_name,
          borrower_categories (
            category:categories (
              id,
              name,
              color
            )
          )
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
      // Only fetch actionable schedule actions — excludes unrelated audit events.
      .in("action", [
        "schedule.status_changed",
        "schedule.payment_applied",
        "schedule.batch_paid",
      ])
      // Exclude schedule.status_changed entries where status was reverted to
      // pending: these are non-actionable (undone payments) and add noise.
      // Logic: include if action is NOT status_changed OR if the status is not
      // pending — covering payment_applied/batch_paid unconditionally.
      .or("action.neq.schedule.status_changed,metadata->>status.neq.pending")
      .gte("created_at", "2026-06-13")
      .order("created_at", { ascending: false })
      .limit(9);
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
        .in("id", auditAccountIds)
        // Exclude soft-deleted accounts — deleted accounts should never appear
        // in payment updates even if historical audit logs reference them.
        .is("deleted_at", null);
      if (auditAccountsQuery.error)
        console.error("auditAccountsQuery error:", auditAccountsQuery.error);
      auditAccountsData = (auditAccountsQuery.data ?? []) as any[];
    }

    // Set of non-deleted account IDs returned by the filtered accounts query.
    // Any audit log referencing an ID absent from this set belongs to a deleted
    // account and will be excluded from the enriched results.
    const nonDeletedAccountIdSet = new Set<string>(
      auditAccountsData.map((a: any) => a.id),
    );

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

    // Enrich audit logs with borrower info; apply residual safety-net filters.
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
        // Exclude logs for deleted accounts: the accounts query already filters
        // deleted_at IS NULL, so any account_id missing from nonDeletedAccountIdSet
        // belongs to a soft-deleted account.
        if (log.account_id && !nonDeletedAccountIdSet.has(log.account_id)) {
          return false;
        }
        // Safety net: keep only paid-related status changes (the audit query
        // already excludes pending via or() at the DB level, but guard here too).
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
