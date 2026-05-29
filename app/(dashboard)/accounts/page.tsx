import AccountsList from "@/components/accounts/accounts-list";
import { getAccountsPageData } from "@/lib/cache/accounts-page";

export default async function AccountsIndexPage() {
  const { rows } = await getAccountsPageData();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <AccountsList accounts={rows} />
    </div>
  );
}
