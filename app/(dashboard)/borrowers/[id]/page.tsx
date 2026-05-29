import BorrowerDetailView from "@/components/borrower/borrower-detail-view";
import { getBorrowerById } from "@/lib/cache/borrowers";
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
    const borrower = await getBorrowerById(id);

    if (!borrower) {
      notFound();
    }

    return (
      <BorrowerDetailView borrower={borrower} />
    );
  } catch {
    notFound();
  }
}
