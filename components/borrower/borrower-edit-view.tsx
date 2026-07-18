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
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm
          dark:border-slate-700 dark:bg-card"
      >
        <BorrowerEditForm
          borrowerId={borrowerId}
          initial={initial}
          initialCategoryIds={initialCategoryIds}
        />
      </div>

      <BorrowerAccountsAsync borrowerId={borrowerId} />
    </div>
  );
}
