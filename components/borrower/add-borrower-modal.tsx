import { UserRoundPlus } from "lucide-react";

import BorrowerForm from "@/components/forms/borrower-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddBorrowerModalProps {
  isOpen: boolean;
  onClose: () => void;
  getBorrowers: () => void;
}

export default function AddBorrowerModal({
  isOpen,
  onClose,
  getBorrowers,
}: AddBorrowerModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md overflow-visible!">
        <DialogHeader className="gap-3 pb-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full
              bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40
              dark:text-emerald-300"
          >
            <UserRoundPlus className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Add Borrower
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Fill in the borrower details and assign categories.
            </DialogDescription>
          </div>
        </DialogHeader>

        <BorrowerForm
          onSuccess={() => {
            onClose();
            getBorrowers?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
