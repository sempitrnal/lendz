"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreVertical } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { revalidateBorrowersPage } from "@/lib/actions/borrowers";
import { triggerHaptic } from "@/lib/haptics";
import { toast } from "sonner";
import NeobrutButton from "../neobrut-button";
import BorrowerEditForm from "@/components/borrower/borrower-edit-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type BorrowerEditData = {
  initial: {
    first_name: string;
    last_name: string;
    contact: string | null;
  };
  initialCategoryIds: string[];
};

type BorrowerDetailMenuProps = {
  borrowerId: string;
  /** Hide Edit when already on the edit screen */
  hideEditLink?: boolean;
  /** After delete: refresh list without navigating (e.g. borrowers list) */
  onDeleted?: () => void | Promise<void>;
  /** Borrower data for inline edit dialog */
  editBorrower?: BorrowerEditData;
};

export default function BorrowerDetailMenu({
  borrowerId,
  hideEditLink = false,
  onDeleted,
  editBorrower,
}: BorrowerDetailMenuProps) {
  const router = useRouter();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  function openDeleteModal() {
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    if (isDeleting) return;
    setDeleteModalOpen(false);
  }

  async function confirmDelete() {
    setIsDeleting(true);
    try {
      const now = new Date().toISOString();

      // Cascade soft-delete all active accounts first
      const { error: accountsError } = await supabase
        .from("accounts")
        .update({ deleted_at: now })
        .eq("borrower_id", borrowerId)
        .is("deleted_at", null);

      if (accountsError) {
        triggerHaptic("error");
        toast.error("Failed to delete accounts: " + accountsError.message);
        return;
      }

      // Soft-delete the borrower
      const { error } = await supabase
        .from("borrowers")
        .update({ deleted_at: now })
        .eq("id", borrowerId);

      if (error) {
        triggerHaptic("error");
        toast.error("Failed to delete borrower: " + error.message);
        return;
      }

      triggerHaptic("success");
      toast.success("Borrower moved to deleted");
      await revalidateBorrowersPage();
      setDeleteModalOpen(false);
      if (onDeleted) {
        await Promise.resolve(onDeleted());
      } else {
        router.push("/borrowers");
      }
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Borrower actions"
            className="rounded-md p-1 text-gray-700 transition-colors
              outline-none hover:bg-gray-100 hover:text-gray-500
              focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            <MoreVertical className="size-4 cursor-pointer" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!hideEditLink ? (
            editBorrower ? (
              <DropdownMenuItem onClick={() => setEditModalOpen(true)}>
                edit
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <Link href={`/borrowers/${borrowerId}/edit`}>edit</Link>
              </DropdownMenuItem>
            )
          ) : null}
          <DropdownMenuItem variant="destructive" onClick={openDeleteModal}>
            delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete borrower</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            This borrower (and all their accounts) will be moved to deleted. You
            can restore them later if needed.
          </DialogDescription>
          <DialogFooter>
            <div className="flex justify-end gap-4">
              <NeobrutButton
                variant="white"
                disabled={isDeleting}
                onClick={closeDeleteModal}
                className=""
              >
                cancel
              </NeobrutButton>
              <NeobrutButton
                variant="red"
                disabled={isDeleting}
                onClick={confirmDelete}
                className=""
              >
                {isDeleting ? "deleting..." : "delete"}
              </NeobrutButton>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editBorrower && (
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit borrower</DialogTitle>
            </DialogHeader>
            <BorrowerEditForm
              borrowerId={borrowerId}
              initial={editBorrower.initial}
              initialCategoryIds={editBorrower.initialCategoryIds}
              onCancel={() => setEditModalOpen(false)}
              onSuccess={() => setEditModalOpen(false)}
              hideMenu
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
