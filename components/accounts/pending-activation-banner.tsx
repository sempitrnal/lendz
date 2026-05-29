"use client";

import { useState } from "react";
import ActivateAccountDialog from "@/components/borrower/activate-account-dialog";
import type { ActivateAccountData } from "@/app/actions/accounts";

export default function PendingActivationBanner({
  releaseDate,
  principal,
  accountId,
  initialValues,
}: {
  releaseDate: string | null;
  principal: number;
  accountId: string;
  initialValues: Partial<ActivateAccountData>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const formattedDate = releaseDate
    ? new Date(releaseDate).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <>
      <div className="rounded-xl border-2 border-amber-600 bg-amber-50 p-4 shadow-[4px_4px_0px_0px_#d97706]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-amber-900">
              pending activation
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Release date: <span className="font-bold">{formattedDate}</span>
              {" · "}Principal: <span className="font-bold">₱{principal.toLocaleString()}</span>
            </p>
            <p className="mt-1 text-[10px] text-amber-700">
              Payment schedules will be created once this account is activated.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="rounded-lg border-2 border-slate-900 bg-emerald-400 px-4 py-2 text-sm font-black uppercase tracking-wide text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
          >
            activate account
          </button>
        </div>
      </div>

      <ActivateAccountDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        accountId={accountId}
        initialValues={initialValues}
      />
    </>
  );
}
