import DeletedPageClient from "@/components/deleted/deleted-page-client";
import { getDeletedBorrowers, getAllDeletedAccounts } from "@/lib/cache/borrowers";

export default async function DeletedPage() {
  const [borrowers, accounts] = await Promise.all([
    getDeletedBorrowers(),
    getAllDeletedAccounts(),
  ]);

  return <DeletedPageClient initialBorrowers={borrowers} initialAccounts={accounts} />;
}
