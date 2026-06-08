"use client";

import BorrowerAccountsSection from "@/components/borrower/borrower-accounts-section";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type {
  AccountRow,
  AccountComputedMetrics,
} from "@/components/borrower/borrower-accounts-section";

type Category = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

export type BorrowerSummary = {
  id: string;
  first_name: string;
  last_name: string;
  contact: string | null;
  category: Category[];
  notes_canvas: any;
};

type BorrowerDetailViewProps = {
  borrower: BorrowerSummary;
  accounts: AccountRow[];
  initialMetrics: Record<string, AccountComputedMetrics>;
  deletedAccounts?: AccountRow[];
};

export default function BorrowerDetailView({
  borrower,
  accounts,
  initialMetrics,
  deletedAccounts = [],
}: BorrowerDetailViewProps) {
  const router = useRouter();
  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      router.push("/borrowers");
    }
  }
  return (
    <div className="flex w-full flex-col gap-6">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex items-center gap-1.5 text-xs font-black tracking-wider text-slate-500 uppercase transition hover:text-slate-900 sm:hidden dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft className="size-3.5" />
        back to borrowers
      </button>
      <BorrowerAccountsSection
        borrower={borrower}
        borrowerId={borrower.id}
        accounts={accounts}
        initialMetrics={initialMetrics}
        deletedAccounts={deletedAccounts}
      />
    </div>
  );
}
