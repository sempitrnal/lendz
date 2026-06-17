"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BsThreeDotsVertical } from "react-icons/bs";

import NeobrutButton from "@/components/neobrut-button";
import { supabase } from "@/lib/supabase/client";
import { logAuditAction } from "@/app/actions/audit";
import { revalidateBorrowerDetailPage } from "@/lib/actions/borrowers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { DialogContent, DialogTitle, DialogHeader, Dialog } from "../ui/dialog";

type AccountCardMenuProps = {
  accountId: string;
  borrowerId: string;
  onEdit?: () => void;
};

export default function AccountCardMenu({
  accountId,
  borrowerId,
  onEdit,
}: AccountCardMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (!open) return;
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function openDeleteModal() {
    setOpen(false);
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
        .from("accounts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", accountId);

      if (error) {
        alert(error.message);
        return;
      }

      await logAuditAction(
        "account.deleted",
        "account",
        accountId,
        "Account soft-deleted",
        { accountId },
        accountId,
      );
      await revalidateBorrowerDetailPage(borrowerId);
      setDeleteModalOpen(false);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-prevent-account-open
            aria-label="Account actions"
            className="absolute right-[-10px] text-slate-400 rounded p-0.5
              outline-none hover:bg-black/5 focus-visible:ring-2
              focus-visible:ring-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <BsThreeDotsVertical className="size-5 cursor-pointer" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          {onEdit ? (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit();
              }}
            >
              Edit
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem className="cursor-pointer hover:bg-red-100">
            <button
              type="button"
              className="w-full text-left text-red-400 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                openDeleteModal();
              }}
            >
              Delete
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account actions"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded-md p-1 text-gray-700 outline-none transition-colors hover:bg-gray-100 hover:text-gray-500 focus-visible:ring-2 focus-visible:ring-gray-400"
      >
        <BsThreeDotsVertical className="size-4 cursor-pointer" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="w-full cursor-pointer px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              openDeleteModal();
            }}
          >
            delete
          </button>
        </div>
      ) : null} */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
          </DialogHeader>
          <p className="text-stone-700">
            This account will be moved to "recently deleted" and hidden from the
            main list. You can restore it anytime.
          </p>
          <div className="flex justify-end gap-4">
            <NeobrutButton
              variant="white"
              disabled={isDeleting}
              onClick={closeDeleteModal}
              className="mt-5"
            >
              cancel
            </NeobrutButton>
            <NeobrutButton
              variant="red"
              disabled={isDeleting}
              onClick={confirmDelete}
              className="mt-5"
            >
              {isDeleting ? "deleting..." : "delete"}
            </NeobrutButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
