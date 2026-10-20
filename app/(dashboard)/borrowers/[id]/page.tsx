import BorrowerDetailView from "@/components/borrower/borrower-detail-view";
import {
  getBorrowerById,
  getBorrowerAccountsWithSchedules,
  getDeletedAccountsForBorrower,
  getBorrowerNotes,
} from "@/lib/cache/borrowers";
import { notFound } from "next/navigation";

type BorrowerPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BorrowerPage({ params }: BorrowerPageProps) {
  const { id } = await params;

  try {
    const [borrower, { accountList, initialMetrics }, deletedAccounts, notes] =
      await Promise.all([
        getBorrowerById(id),
        getBorrowerAccountsWithSchedules(id),
        getDeletedAccountsForBorrower(id),
        // The client loads them itself if this comes back null.
        getBorrowerNotes(id).catch(() => null),
      ]);

    if (!borrower) {
      notFound();
    }

    return (
      <BorrowerDetailView
        borrower={borrower}
        accounts={accountList}
        initialMetrics={initialMetrics}
        deletedAccounts={deletedAccounts}
        initialNotes={notes}
      />
    );
  } catch {
    notFound();
  }
}
