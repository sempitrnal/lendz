"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { logAuditAction } from "@/app/actions/audit";
import { revalidateBorrowerDetailPage } from "@/lib/actions/borrowers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

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
            <MoreVertical className="size-5 cursor-pointer" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          {onEdit ? (
            <DropdownMenuItem
              className="cursor-pointer focus:bg-slate-100 focus:text-slate-900"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit();
              }}
            >
              Edit
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              openDeleteModal();
            }}
          >
            Delete
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
          <DialogDescription>
            This account will be moved to "recently deleted" and hidden from the
            main list. You can restore it anytime.
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={closeDeleteModal}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={confirmDelete}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
