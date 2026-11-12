"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Sheet } from "@/components/dashboard/checklist-v2/sheet";
import {
  AccountForm,
  loadAccountForm,
} from "@/components/forms/account-form-loader";
import { BorrowerPicker } from "@/components/quick-actions";
import { useInvalidateBorrowerDetails } from "@/lib/hooks/use-borrower-details";

type Picked = { id: string; name: string };

/**
 * "New loan" from the dashboard: pick a borrower, then the account sheet
 * opens for them. `children` gets the function that starts it (the form's
 * code is fetched ahead, so the sheet never opens empty).
 */
export function NewLoanFlow({
  children,
}: {
  children(start: { open(): void; warm(): void }): ReactNode;
}) {
  const router = useRouter();
  const invalidateBorrowerDetails = useInvalidateBorrowerDetails();
  const [picking, setPicking] = useState(false);
  const [borrower, setBorrower] = useState<Picked | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const warm = () => void loadAccountForm().catch(() => {});

  function pick(b: Picked) {
    setPicking(false);
    setBorrower(b);
    loadAccountForm()
      .then(() => {
        setSheetOpen(true);
      })
      .catch(() => {
        toast.error("couldn't open the form. check your connection.");
      });
  }

  function closeSheet() {
    setSheetOpen(false);
  }

  return (
    <>
      {children({ open: () => setPicking(true), warm })}
      <BorrowerPicker
        open={picking}
        title="New loan for…"
        onClose={() => setPicking(false)}
        onPick={pick}
      />
      <Sheet open={sheetOpen} onClose={closeSheet} label="Add account">
        {borrower && (
          <AccountForm
            key={borrower.id}
            borrowerId={borrower.id}
            borrowerName={borrower.name}
            onSuccess={async () => {
              closeSheet();
              await invalidateBorrowerDetails(borrower.id);
              router.refresh();
            }}
          />
        )}
      </Sheet>
    </>
  );
}
