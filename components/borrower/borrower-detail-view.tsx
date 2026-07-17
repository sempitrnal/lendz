"use client";

import BorrowerAccountsSection from "@/components/borrower/borrower-accounts-section";
import type {
  AccountRow,
  AccountComputedMetrics,
} from "@/components/borrower/borrower-accounts-section";

type Category = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

export type BorrowerSummary = {
  id: string;
  first_name: string;
  last_name: string;
  contact: string | null;
  category: Category[];
  notes_canvas: any;
};

type BorrowerDetailViewProps = {
  borrower: BorrowerSummary;
  accounts: AccountRow[];
  initialMetrics: Record<string, AccountComputedMetrics>;
  deletedAccounts?: AccountRow[];
};

export default function BorrowerDetailView({
  borrower,
  accounts,
  initialMetrics,
  deletedAccounts = [],
}: BorrowerDetailViewProps) {
  return (
    <BorrowerAccountsSection
      borrower={borrower}
      borrowerId={borrower.id}
      accounts={accounts}
      initialMetrics={initialMetrics}
      deletedAccounts={deletedAccounts}
    />
  );
}
