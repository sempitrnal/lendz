import { createSupabaseServer } from "@/lib/supabase/server";

import BorrowerAccountsSection, {
  type AccountRow,
} from "@/components/borrower/borrower-accounts-section";

type BorrowerAccountsAsyncProps = {
  borrowerId: string;
};

export default async function BorrowerAccountsAsync({
  borrowerId,
}: BorrowerAccountsAsyncProps) {
  const supabase = await createSupabaseServer();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("borrower_id", borrowerId)
    .order("created_at", { ascending: false });

  return (
    <BorrowerAccountsSection
      borrowerId={borrowerId}
      accounts={accounts as AccountRow[] | null}
    />
  );
}
