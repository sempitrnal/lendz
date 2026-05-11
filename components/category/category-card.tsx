import { useState } from "react";
import { useRouter } from "next/navigation";
import { Category } from "./category-list";
import Modal from "../modal";
import NeobrutButton from "../neobrut-button";
import { BsThreeDotsVertical } from "react-icons/bs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

type CategoryCardProps = {
    category: Category
    openEditModal: (e: Category) => void
    deleteCategory: (e: string) => void
    openMenuId: string | null
    setOpenMenuId: (e: string | null) => void
}

export default function CategoryCard({ category, openEditModal, deleteCategory, openMenuId, setOpenMenuId }: CategoryCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const borrower_count = category.borrower_categories[0].count;
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const openDeleteModal = () => setIsDeleteModalOpen(true);
  const closeDeleteModal = () => setIsDeleteModalOpen(false);

  return (
    <div
      key={category.id}
      onClick={(e) => {
        e.stopPropagation();
        setIsLoading(true);
        router.push(`/categories/${category.id}`);
      }}
      className="relative h-24 cursor-pointer rounded-xl border-2 border-slate-900 bg-linear-to-br from-indigo-50 via-white to-orange-50 px-4 py-3 transition shadow-[4px_4px_0px_0px_#0f172a] hover:-translate-y-0.5"
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-stone-900 border-t-transparent" />
        </div>
      )}
      <div className="flex justify-between">
        <div className="flex items-center gap-3">
          <span
            className="h-4 w-4 translate-y-[0.6px] rounded-full border-2 border-slate-900"
            style={{ backgroundColor: category.color ?? "#cbd5e1" }}
          />
          <p className="font-black lowercase text-slate-900">{category.name}</p>
        </div>
        <div className="relative">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md border-2 border-slate-900  text-sm font-bold"
              >
                <BsThreeDotsVertical />
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
      </div>
      <div className="mt-2 flex items-center gap-3">
        <p className="text-sm text-stone-500">
          {borrower_count === 1
            ? borrower_count + " borrower"
            : borrower_count > 1
              ? borrower_count + " borrowers"
              : "no borrowers yet"}
        </p>
      </div>
      <Modal size="xs" isOpen={isDeleteModalOpen} closeOnEscape closeOnOverlayClick onClose={closeDeleteModal}>
        <div className="mb-4 "><p>Are you sure you want to delete this category?</p></div>
        <div className="flex justify-end gap-2">
          <NeobrutButton variant="white" onClick={() => {
            deleteCategory(category.id);
          }}>Yes</NeobrutButton>
          <NeobrutButton variant="red" onClick={closeDeleteModal}>No</NeobrutButton>

        </div>
      </Modal>
    </div>
  );
}