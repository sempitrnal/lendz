"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BsThreeDotsVertical } from "react-icons/bs";

import Modal from "@/components/modal";
import { supabase } from "@/lib/supabase/client";
import NeobrutButton from "../neobrut-button";

type BorrowerDetailMenuProps = {
  borrowerId: string;
  /** Hide Edit when already on the edit screen */
  hideEditLink?: boolean;
};

export default function BorrowerDetailMenu({
  borrowerId,
  hideEditLink = false,
}: BorrowerDetailMenuProps) {
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
        .from("borrowers")
        .delete()
        .eq("id", borrowerId);

      if (error) {
        alert(error.message);
        return;
      }

      setDeleteModalOpen(false);
      router.push("/borrowers");
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Borrower actions"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md p-1 text-gray-700 outline-none transition-colors hover:bg-gray-100 hover:text-gray-500 focus-visible:ring-2 focus-visible:ring-gray-400"
      >
        <BsThreeDotsVertical className="size-4 cursor-pointer" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {!hideEditLink ? (
            <Link
              role="menuitem"
              href={`/borrowers/${borrowerId}/edit`}
              className="block px-4 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              edit
            </Link>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="w-full px-4 py-2 text-left text-sm text-red-600 transition-colors cursor-pointer hover:bg-red-50"
            onClick={openDeleteModal}
          >
            delete
          </button>
        </div>
      ) : null}

      <Modal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        title="Delete borrower"
        size="sm"
        closeOnOverlayClick={!isDeleting}
        closeOnEscape={!isDeleting}
        footer={
          <div className="flex justify-end gap-4">

            <NeobrutButton variant="white" disabled={isDeleting} onClick={closeDeleteModal} className="mt-5">cancel</NeobrutButton>
            <NeobrutButton variant="red" disabled={isDeleting} onClick={confirmDelete} className="mt-5">
              {isDeleting ? "deleting..." : "delete"}
            </NeobrutButton>

          </div>
        }
      >
        <p className="text-stone-700">
          This will permanently remove this borrower. This cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
