import { getBorrowerAccountsWithSchedules } from "@/lib/cache/borrowers";
import BorrowerAccountsSection from "@/components/borrower/borrower-accounts-section";
import type { BorrowerSummary } from "./borrower-detail-view";

type BorrowerAccountsAsyncProps = {
  borrowerId: string;
  borrower?: BorrowerSummary;
};

export default async function BorrowerAccountsAsync({
  borrowerId,
  borrower,
}: BorrowerAccountsAsyncProps) {
  const { accountList, initialMetrics } =
    await getBorrowerAccountsWithSchedules(borrowerId);

  return (
    <BorrowerAccountsSection
      borrower={borrower}
      borrowerId={borrowerId}
      accounts={accountList}
      initialMetrics={initialMetrics}
    />
  );
}
