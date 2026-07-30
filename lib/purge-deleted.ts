import { createSupabaseAdmin } from "@/lib/supabase/admin";

const DAYS_TO_KEEP = 30;

export type PurgeDeletedResult = {
  accountsDeleted: number;
  borrowersDeleted: number;
};

export async function purgeOldDeletedItems(): Promise<PurgeDeletedResult> {
  const supabase = createSupabaseAdmin();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_TO_KEEP);
  const cutoffIso = cutoff.toISOString();

  // Delete accounts first to avoid FK issues when deleting borrowers.
  const { error: accountsError, count: accountsCount } = await supabase
    .from("accounts")
    .delete({ count: "exact" })
    .lt("deleted_at", cutoffIso);

  if (accountsError) {
    throw new Error(`Failed to purge accounts: ${accountsError.message}`);
  }

  const { error: borrowersError, count: borrowersCount } = await supabase
    .from("borrowers")
    .delete({ count: "exact" })
    .lt("deleted_at", cutoffIso);

  if (borrowersError) {
    throw new Error(`Failed to purge borrowers: ${borrowersError.message}`);
  }

  return {
    accountsDeleted: accountsCount ?? 0,
    borrowersDeleted: borrowersCount ?? 0,
  };
}
