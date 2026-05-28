import { Suspense } from "react";

import BorrowerAccountsAsync from "@/components/borrower/borrower-accounts-async";
import BorrowerAccountsSectionSkeleton from "@/components/borrower/borrower-accounts-section-skeleton";
type Category = {
  id: string;
  name: string;
  color: string;
  created_at: string
}
export type BorrowerSummary = {
  id: string;
  first_name: string;
  last_name: string;
  contact: string | null;
  category: Category[]
  notes_canvas: any
};

type BorrowerDetailViewProps = {
  borrower: BorrowerSummary;
};

export default function BorrowerDetailView({
  borrower,
}: BorrowerDetailViewProps) {
  return (
    <>   <div className="flex w-full flex-col gap-6">

        <Suspense fallback={<BorrowerAccountsSectionSkeleton />}>
          <BorrowerAccountsAsync borrower={borrower} borrowerId={borrower.id} />

        </Suspense>
      </div></>

  );
}
