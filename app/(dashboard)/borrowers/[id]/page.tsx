import BorrowerDetailView from "@/components/borrower/borrower-detail-view";
import { getBorrowerById, getBorrowerAccountsWithSchedules } from "@/lib/cache/borrowers";
import { notFound } from "next/navigation";

type BorrowerPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BorrowerPage({
  params,
}: BorrowerPageProps) {
  const { id } = await params;

  try {
    const [borrower, { accountList, initialMetrics }] = await Promise.all([
      getBorrowerById(id),
      getBorrowerAccountsWithSchedules(id),
    ]);

    if (!borrower) {
      notFound();
    }

    return (
      <BorrowerDetailView borrower={borrower} accounts={accountList} initialMetrics={initialMetrics} />
    );
  } catch {
    notFound();
  }
}
