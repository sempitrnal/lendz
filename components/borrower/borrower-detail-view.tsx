import BorrowerAccountsSection, {
  type AccountRow,
} from "@/components/borrower/borrower-accounts-section";
import BorrowerDetailMenu from "@/components/borrower/borrower-detail-menu";
import BackButton from "../back-button";

type BorrowerSummary = {
  id: string;
  first_name: string;
  last_name: string;
  contact: string | null;
};

type BorrowerDetailViewProps = {
  borrower: BorrowerSummary;
  accounts: AccountRow[] | null;
};

export default function BorrowerDetailView({
  borrower,
  accounts,
}: BorrowerDetailViewProps) {
  return (
    <> <BackButton
      fallbackHref={`/borrowers`}
      className="mb-10"
    />   <div className="flex w-full flex-col gap-6">

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <h1 className="text-3xl font-semibold">
                {borrower.first_name} {borrower.last_name}
              </h1>
              <p className="text-gray-500">
                {borrower.contact || "No contact"}
              </p>
            </div>
            <BorrowerDetailMenu borrowerId={borrower.id} />
          </div>
        </div>

        <BorrowerAccountsSection
          borrowerId={borrower.id}
          accounts={accounts}
        />
      </div></>

  );
}
