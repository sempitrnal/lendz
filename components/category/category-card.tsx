import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, ChevronRight } from "lucide-react";
import { Category } from "./category-list";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const borrower_count = category.borrower_categories[0]?.count ?? 0;
  const color = category.color ?? "#94a3b8";

  return (
    <>
      <div
        onClick={() => {
          setIsLoading(true);
          router.push(`/categories/${category.id}`);
        }}
        className="group relative flex cursor-pointer flex-col rounded-2xl
          border border-slate-200/70 bg-white p-5 transition-all duration-200
          ease-out hover:border-slate-300 hover:shadow-md
          hover:shadow-slate-200/40 active:scale-[0.98] dark:border-slate-800/60
          dark:bg-card dark:hover:border-slate-700 dark:hover:shadow-black/20"
      >
        {isLoading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center
              rounded-2xl bg-white/80 backdrop-blur-sm dark:bg-card/80"
          >
            <div
              className="h-5 w-5 animate-spin rounded-full border-2
                border-slate-300 border-t-slate-700 dark:border-slate-700
                dark:border-t-slate-300"
            />
          </div>
        )}

        {/* Header: color dot + name + menu */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5 pt-1">
            <span
              className="size-2.5 shrink-0 rounded-full ring-1 ring-inset
                ring-black/10 dark:ring-white/10"
              style={{ backgroundColor: color }}
            />
            <h3
              className="truncate text-lg font-bold tracking-tight
                text-slate-600 dark:text-foreground"
            >
              {category.name}
            </h3>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="flex size-7 shrink-0 items-center justify-center
                  rounded-lg text-slate-400 transition-colors duration-150
                  hover:bg-slate-100 hover:text-slate-600
                  focus-visible:bg-slate-100 focus-visible:outline-none
                  dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(category);
                }}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDeleteOpen(true);
                }}
                className="text-red-600 focus:text-red-600"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Borrower count */}
        <p
          className="mt-1.5 text-[13px] font-medium text-slate-400
            dark:text-muted-foreground"
        >
          {borrower_count === 1
            ? "1 borrower"
            : borrower_count > 1
              ? `${borrower_count} borrowers`
              : "No borrowers"}
        </p>

        <div className="flex-1" />

        {/* Footer: View details */}
        <div
          className="mt-5 flex items-center justify-between border-t
            border-slate-100 pt-3.5 dark:border-slate-800/60"
        >
          <span
            className="text-[13px] font-medium text-slate-500 transition-colors
              group-hover:text-slate-700 dark:text-muted-foreground
              dark:group-hover:text-foreground"
          >
            View details
          </span>
          <ChevronRight
            className="size-4 text-slate-300 transition-all duration-200
              group-hover:translate-x-0.5 group-hover:text-slate-500
              dark:text-slate-600 dark:group-hover:text-slate-300"
          />
        </div>
      </div>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{category.name}</strong>?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteCategory(category.id);
                setIsDeleteOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
