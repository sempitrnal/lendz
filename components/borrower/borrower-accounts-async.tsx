import { createSupabaseServer } from "@/lib/supabase/server";

import BorrowerAccountsSection, {
  type AccountRow,
} from "@/components/borrower/borrower-accounts-section";
import { BorrowerSummary } from "./borrower-detail-view";

type BorrowerAccountsAsyncProps = {
  borrowerId: string;
  borrower?: BorrowerSummary
};

export default async function BorrowerAccountsAsync({
  borrowerId,
  borrower
}: BorrowerAccountsAsyncProps) {
  const supabase = await createSupabaseServer();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("borrower_id", borrowerId)
    .order("created_at", { ascending: false });

  return (
    <BorrowerAccountsSection
      borrower={borrower}
      borrowerId={borrowerId}
      accounts={accounts as AccountRow[] | null}
    />
  );
}
