import { Suspense } from "react";

import BorrowerAccountsAsync from "@/components/borrower/borrower-accounts-async";
import BorrowerAccountsSectionSkeleton from "@/components/borrower/borrower-accounts-section-skeleton";
import BorrowerEditForm, {
  type BorrowerEditFormProps,
} from "@/components/borrower/borrower-edit-form";

type BorrowerEditViewProps = BorrowerEditFormProps;

export default function BorrowerEditView({
  borrowerId,
  initial,
  initialCategoryIds,
}: BorrowerEditViewProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <BorrowerEditForm
        borrowerId={borrowerId}
        initial={initial}
        initialCategoryIds={initialCategoryIds}
      />

      <Suspense fallback={<BorrowerAccountsSectionSkeleton />}>
        <BorrowerAccountsAsync borrowerId={borrowerId} />
      </Suspense>
    </div>
  );
}
