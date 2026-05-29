"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BsThreeDotsVertical } from "react-icons/bs";

import { supabase } from "@/lib/supabase/client";
import NeobrutButton from "../neobrut-button";
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

type BorrowerDetailMenuProps = {
  borrowerId: string;
  /** Hide Edit when already on the edit screen */
  hideEditLink?: boolean;
  /** After delete: refresh list without navigating (e.g. borrowers list) */
  onDeleted?: () => void | Promise<void>;
};

export default function BorrowerDetailMenu({
  borrowerId,
  hideEditLink = false,
  onDeleted,
}: BorrowerDetailMenuProps) {
  const router = useRouter();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
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
      const { error } = await supabase
        .from("borrowers")
        .delete()
        .eq("id", borrowerId);

      if (error) {
        alert(error.message);
        return;
      }

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
            className="rounded-md p-1 text-gray-700 outline-none transition-colors hover:bg-gray-100 hover:text-gray-500 focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            <BsThreeDotsVertical className="size-4 cursor-pointer" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!hideEditLink ? (
            <DropdownMenuItem asChild>
              <Link href={`/borrowers/${borrowerId}/edit`}>edit</Link>
            </DropdownMenuItem>
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
            This will permanently remove this borrower. This cannot be undone.
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
    </div>
  );
}
