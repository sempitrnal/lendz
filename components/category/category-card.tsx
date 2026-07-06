import { useState } from "react";
import { useRouter } from "next/navigation";
import { Category } from "./category-list";
import Modal from "../modal";
import NeobrutButton from "../neobrut-button";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type CategoryCardProps = {
  category: Category;
  openEditModal: (e: Category) => void;
  deleteCategory: (e: string) => void;
  openMenuId: string | null;
  setOpenMenuId: (e: string | null) => void;
};

export default function CategoryCard({
  category,
  openEditModal,
  deleteCategory,
}: CategoryCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const borrower_count = category.borrower_categories[0].count;
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const openDeleteModal = () => setIsDeleteModalOpen(true);
  const closeDeleteModal = () => setIsDeleteModalOpen(false);

  return (
    <div
      key={category.id}
      onClick={() => {
        setIsLoading(true);
        router.push(`/categories/${category.id}`);
      }}
      className="group relative flex cursor-pointer flex-col overflow-hidden
        rounded-xl border-2 border-slate-900 bg-white transition
        hover:-translate-y-0.5 dark:border-border dark:bg-card"
    >
      {/* Color accent bar */}
      <div
        className="h-2"
        style={{ backgroundColor: category.color ?? "#cbd5e1" }}
      />

      {isLoading && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center
            bg-white/70 backdrop-blur-sm dark:bg-card/70"
        >
          <div
            className="h-5 w-5 animate-spin rounded-full border-2
              border-stone-900 border-t-transparent dark:border-foreground
              dark:border-t-transparent"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="shrink-0 rounded-full border-2 border-slate-900 p-1.5
                dark:border-border"
              style={{ backgroundColor: category.color ?? "#cbd5e1" }}
            >
              <span className="block size-3 rounded-full bg-white/90" />
            </span>
            <p
              className="truncate text-base font-black lowercase text-slate-600
                dark:text-foreground"
            >
              {category.name}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="flex size-8 shrink-0 items-center justify-center
                  rounded-lg border-2 border-slate-900 text-sm font-bold
                  transition active:bg-slate-100 dark:border-border
                  dark:text-foreground dark:active:bg-muted"
              >
                <MoreVertical />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(category);
                }}
              >
                edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  openDeleteModal();
                }}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Borrower count */}
        <div className="mt-3 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-md border-2
              border-slate-900 bg-slate-50 px-2 py-1 text-[10px] font-bold
              uppercase dark:border-border dark:bg-muted"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: category.color ?? "#cbd5e1" }}
            />
            {borrower_count === 1
              ? "1 borrower"
              : borrower_count > 1
                ? `${borrower_count} borrowers`
                : "no borrowers"}
          </span>
        </div>
      </div>

      {/* Arrow hint */}
      <div
        className="flex items-center justify-between border-t-2 border-slate-100
          bg-slate-50/60 px-4 py-2 dark:border-border/50 dark:bg-muted/30"
      >
        <span
          className="text-[10px] font-bold uppercase tracking-wide
            text-slate-400 dark:text-muted-foreground"
        >
          view details
        </span>
        <svg
          className="size-3.5 text-slate-400 transition-transform
            group-hover:translate-x-0.5 dark:text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>

      <Modal
        size="xs"
        isOpen={isDeleteModalOpen}
        closeOnEscape
        closeOnOverlayClick
        onClose={closeDeleteModal}
      >
        <div className="mb-4">
          <p>Are you sure you want to delete this category?</p>
        </div>
        <div className="flex justify-end gap-2">
          <NeobrutButton
            variant="white"
            onClick={() => deleteCategory(category.id)}
          >
            Yes
          </NeobrutButton>
          <NeobrutButton variant="red" onClick={closeDeleteModal}>
            No
          </NeobrutButton>
        </div>
      </Modal>
    </div>
  );
}
