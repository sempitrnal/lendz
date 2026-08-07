import AccountsList from "@/components/accounts/accounts-list";
import { getAccountsPageData } from "@/lib/cache/accounts-page";

export default async function AccountsIndexPage() {
  const { rows } = await getAccountsPageData();

  return (
    <div className="mx-auto max-w-7xl md:max-w-full px-4 pb-16 md:px-6">
      <AccountsList accounts={rows} />
    </div>
  );
}
