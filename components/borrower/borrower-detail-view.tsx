import { Suspense } from "react";

import BorrowerAccountsAsync from "@/components/borrower/borrower-accounts-async";
import BorrowerAccountsSectionSkeleton from "@/components/borrower/borrower-accounts-section-skeleton";
import BorrowerDetailMenu from "@/components/borrower/borrower-detail-menu";
import BackButton from "../back-button";
import { isDarkColor } from "@/lib/utils";
type Category = {
  id: string;
  name: string;
  color: string;
  created_at: string
}
type BorrowerSummary = {
  id: string;
  first_name: string;
  last_name: string;
  contact: string | null;
  category: Category[]
};

type BorrowerDetailViewProps = {
  borrower: BorrowerSummary;
};

export default function BorrowerDetailView({
  borrower,
}: BorrowerDetailViewProps) {
  return (
    <> <BackButton
      fallbackHref={`/borrowers`}
      className="mb-10"
    />   <div className="flex w-full flex-col gap-6">

        <div className="">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <h1 className="text-3xl font-semibold">
                {borrower.first_name} {borrower.last_name}
              </h1>
              <p className="text-gray-500">
                {borrower.contact || "No contact"}
              </p>
              <div className="flex flex-wrap gap-2">
                {borrower.category?.map((e) => {
                  return (
                    <div
                      key={e.id}
                      style={{ backgroundColor: e.color }}
                      className={`rounded px-2 py-1 text-sm font-medium shadow-[4px_4px_0px_#1e1a4d] ${isDarkColor(e.color) ? "text-white" : "text-indigo-950"
                        }`}
                    >
                      {e.name}
                    </div>
                  );
                })}
              </div>
            </div>
            <BorrowerDetailMenu borrowerId={borrower.id} />
          </div>
        </div>

        <Suspense fallback={<BorrowerAccountsSectionSkeleton />}>
          <BorrowerAccountsAsync borrowerId={borrower.id} />
        </Suspense>
      </div></>

  );
}
