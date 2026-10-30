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
  /** Names of a few of its borrowers, once the borrower list has loaded. */
  members: string[];
  /** Its borrowers as a share of the biggest category's (0 to 1). */
  share: number;
};

/** "mila santos" → "MS", "bo" → "B". */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "");
}

export default function CategoryCard({
  category,
  openEditModal,
  deleteCategory,
  members,
  share,
}: CategoryCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const borrower_count = category.borrower_categories[0]?.count ?? 0;
  const color = category.color ?? "#94a3b8";

  return (
    <>
      <div
        role="link"
        tabIndex={0}
        onClick={() => {
          setIsLoading(true);
          router.push(`/categories/${category.id}`);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.target !== e.currentTarget) return;
          setIsLoading(true);
          router.push(`/categories/${category.id}`);
        }}
        style={{ "--cat": color } as React.CSSProperties}
        className="relative flex min-h-44 cursor-pointer flex-col rounded-3xl
          border border-border bg-card p-3 shadow-sm transition-transform
          active:scale-[0.97]"
      >
        {isLoading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center
              rounded-3xl bg-card/80"
          >
            <div
              className="size-5 animate-spin rounded-full border-2 border-muted
                border-t-foreground"
            />
          </div>
        )}

        {/* The category's initial on its colour, and the menu. */}
        <div className="flex items-start justify-between gap-1">
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-2xl
              ring-1 ring-black/5 ring-inset dark:ring-white/10
              bg-[color-mix(in_oklab,var(--cat)_22%,var(--card))] text-lg
              font-black
              text-[color-mix(in_oklab,var(--cat)_45%,var(--foreground))]
              uppercase"
          >
            {category.name.trim().charAt(0) || "?"}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label={`${category.name} options`}
                className="-mt-1 -mr-1 flex size-8 shrink-0 items-center
                  justify-center rounded-full text-muted-foreground
                  transition-colors hover:bg-muted focus-visible:bg-muted
                  focus-visible:outline-none"
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

        <h3
          className="mt-2.5 line-clamp-2 text-[15px] leading-tight font-black
            tracking-tight lowercase"
        >
          {category.name}
        </h3>
        <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
          {borrower_count} borrower{borrower_count === 1 ? "" : "s"}
        </p>

        <div className="flex-1" />

        {/* A few of its borrowers, then how it measures up to the biggest. */}
        <div className="mt-3 flex items-center">
          {members.length === 0 ? (
            <span className="text-[11px] font-semibold text-muted-foreground/60">
              {borrower_count === 0 ? "empty" : "\u00a0"}
            </span>
          ) : (
            <div className="flex -space-x-1.5">
              {members.slice(0, 3).map((name, i) => (
                <span
                  key={i}
                  title={name}
                  className="flex size-6 items-center justify-center
                    rounded-full
                    bg-[color-mix(in_oklab,var(--cat)_30%,var(--card))]
                    text-[9px] font-black
                    text-[color-mix(in_oklab,var(--cat)_40%,var(--foreground))]
                    uppercase ring-2 ring-card"
                >
                  {initials(name)}
                </span>
              ))}
              {borrower_count > 3 && (
                <span
                  className="flex h-6 min-w-6 items-center justify-center
                    rounded-full bg-muted px-1 text-[9px] font-black
                    text-muted-foreground ring-2 ring-card"
                >
                  +{borrower_count - 3}
                </span>
              )}
            </div>
          )}
          <ChevronRight className="ml-auto size-4 text-muted-foreground" />
        </div>
        <div
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-(--cat) ring-1 ring-black/10
              ring-inset transition-[width] duration-500"
            style={{
              width: `${Math.max(share * 100, borrower_count ? 4 : 0)}%`,
            }}
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
