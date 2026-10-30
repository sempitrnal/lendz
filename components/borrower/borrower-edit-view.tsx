import { Suspense } from "react";
import BorrowerAccountsAsync from "@/components/borrower/borrower-accounts-async";
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="rounded-3xl border border-border bg-card pt-3 shadow-sm">
        <BorrowerEditForm
          borrowerId={borrowerId}
          initial={initial}
          initialCategoryIds={initialCategoryIds}
        />
      </div>

      <Suspense
        fallback={
          <div
            className="h-40 animate-pulse rounded-2xl bg-slate-100
              dark:bg-slate-800/50"
          />
        }
      >
        <BorrowerAccountsAsync borrowerId={borrowerId} />
      </Suspense>
    </div>
  );
}
