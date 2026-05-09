 "use client";

import { FaPlus } from "react-icons/fa6";
import { useState } from "react";
import Modal from "@/components/modal";
import AccountForm from "@/components/forms/account-form";

export type AccountRow = {
  id: string;
  type: string;
  status: string;
  principal_amount: number | string | null;
  interest_rate: number | string | null;
};

type BorrowerAccountsSectionProps = {
  borrowerId: string;
  accounts: AccountRow[] | null;
};

export default function BorrowerAccountsSection({
  borrowerId,
  accounts,
}: BorrowerAccountsSectionProps) {
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Accounts</h2>

          <p className="text-sm text-gray-500">
            Loans and cash advances
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddAccountOpen(true)}
          className="rounded-full"
          aria-label="Add account"
        >
          <FaPlus className="bg-green-400 rounded-full text-indigo-950 hover:opacity-90 transition w-6 h-6 p-1 shadow-[2px_2px_0px_0px_#1e293b] cursor-pointer hover:-translate-y-0.5 hover:translate-x-0.5 hover:shadow-[4px_4px_0px_0px_#1e293b]" />
        </button>
      </div>

      {!accounts || accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-gray-500">No accounts yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-xl border p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium capitalize">
                    {account.type.replace("_", " ")}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Status: {account.status}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-semibold">
                    ₱
                    {Number(
                      account.principal_amount
                    ).toLocaleString()}
                  </p>

                  <p className="text-sm text-gray-500">
                    {account.interest_rate}% interest
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
        closeOnEscape
        closeOnOverlayClick
        title="add account"
        size="lg"
      >
        <AccountForm
          borrowerId={borrowerId}
          onSuccess={() => setIsAddAccountOpen(false)}
        />
      </Modal>
    </div>
  );
}
