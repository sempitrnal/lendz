"use client";

import { useEffect, useState } from "react";
import { Plus, FolderPlus, Pencil } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  formFieldInputClassName,
  formFieldLabelClassName,
} from "@/lib/form-field-classes";
import { supabase } from "@/lib/supabase/client";
import { fetchCategories } from "@/lib/categories/fetch-categories";
import { useBorrowersSearch } from "@/hooks/use-borrowers-search";
import CategoryCard from "./category-card";

type Count = {
  count: number;
};

export type Category = {
  id: string;
  name: string;
  color: string | null;
  sort_order: number | null;
  created_at: string;
  borrower_categories: Count[];
};

export default function CategoryList() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  /* Add dialog */
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#22c55e");
  const [isSaving, setIsSaving] = useState(false);

  /* Edit dialog */
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#22c55e");
  const [editSortOrder, setEditSortOrder] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const loadCategories = async () => {
    try {
      const rows = await fetchCategories();
      setCategories(rows as Category[]);
    } catch {
      setCategories([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openAddDialog = () => {
    setName("");
    setColor("#22c55e");
    setIsAddOpen(true);
  };

  const closeAddDialog = () => {
    setIsAddOpen(false);
    setName("");
    setColor("#22c55e");
  };

  const addCategory = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsSaving(true);
    const { error } = await supabase
      .from("categories")
      .insert({ name: trimmed, color });
    setIsSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    closeAddDialog();
    loadCategories();
  };

  const openEditModal = (category: Category) => {
    setEditingCategoryId(category.id);
    setEditName(category.name);
    setEditColor(category.color ?? "#22c55e");
    setEditSortOrder(
      category.sort_order != null ? String(category.sort_order) : "",
    );
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingCategoryId(null);
    setEditName("");
    setEditColor("#22c55e");
    setEditSortOrder("");
  };

  const updateCategory = async () => {
    if (!editingCategoryId) return;
    const trimmed = editName.trim();
    if (!trimmed) return;

    setIsUpdating(true);
    const sortOrderValue =
      editSortOrder.trim() !== "" ? parseInt(editSortOrder, 10) : null;
    const { error } = await supabase
      .from("categories")
      .update({ name: trimmed, color: editColor, sort_order: sortOrderValue })
      .eq("id", editingCategoryId);
    setIsUpdating(false);

    if (error) {
      alert(error.message);
      return;
    }

    closeEditModal();
    loadCategories();
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    loadCategories();
  };

  const borrowerTotal = categories.reduce(
    (sum, c) => sum + (c.borrower_categories[0]?.count ?? 0),
    0,
  );
  // A few borrower names per category, for the faces on each card.
  const { data: borrowers } = useBorrowersSearch();
  const membersById = new Map<string, string[]>();
  for (const b of borrowers ?? []) {
    const name = `${b.first_name} ${b.last_name}`.trim();
    for (const link of b.borrower_categories ?? []) {
      const cats = Array.isArray(link.category)
        ? link.category
        : [link.category];
      for (const cat of cats) {
        if (!cat) continue;
        const list = membersById.get(cat.id) ?? [];
        if (list.length < 3) list.push(name);
        membersById.set(cat.id, list);
      }
    }
  }
  const biggest = Math.max(
    1,
    ...categories.map((c) => c.borrower_categories[0]?.count ?? 0),
  );

  // The share each category holds, for the strip under the total.
  const shares = categories
    .map((c) => ({
      id: c.id,
      color: c.color ?? "#94a3b8",
      count: c.borrower_categories[0]?.count ?? 0,
    }))
    .filter((c) => c.count > 0);

  return (
    <div className="pb-16">
      {/* The green band; the search above it is the mobile top bar. */}
      <div
        data-settle-group="band"
        className="relative -mt-16 px-4 pt-[4.75rem] pb-14 text-white sm:mt-0
          sm:px-6 sm:pt-6"
      >
        <div
          aria-hidden="true"
          data-nav-band
          className="band-bg absolute inset-0 rounded-b-3xl"
        />
        <div className="relative z-20 flex items-center justify-between">
          <p className="text-xs font-bold tracking-wider uppercase">
            categories
          </p>
          <button
            type="button"
            onClick={openAddDialog}
            aria-label="Add category"
            className="relative flex size-9 shrink-0 items-center justify-center
              rounded-full bg-white text-emerald-600 shadow-sm
              transition-transform active:scale-90"
          >
            <Plus className="size-5" />
          </button>
        </div>
        <div className="relative z-20 mt-4">
          <p className="text-xs font-semibold opacity-80">
            Borrowers in categories
          </p>
          {loading ? (
            <span
              className="mt-1 block h-10 w-24 animate-pulse rounded-xl
                bg-white/25"
            />
          ) : (
            <p
              className="text-[40px] leading-tight font-black tracking-tight
                tabular-nums"
            >
              {borrowerTotal}
            </p>
          )}
          <p className="text-xs font-semibold opacity-80">
            {loading
              ? "loading…"
              : `across ${categories.length} categor${
                  categories.length === 1 ? "y" : "ies"
                }`}
          </p>
          <div
            className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full
              bg-white/25"
            aria-hidden="true"
          >
            {shares.map((c) => (
              <span
                key={c.id}
                className="h-full ring-1 ring-white/40 first:rounded-l-full
                  last:rounded-r-full"
                style={{ flexGrow: c.count, backgroundColor: c.color }}
              />
            ))}
          </div>
        </div>
      </div>

      <div data-settle className="relative z-10 -mt-8 px-3 sm:px-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-3xl border border-border
                  bg-card shadow-sm"
              />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-3
              rounded-3xl border border-border bg-card py-20 shadow-sm"
          >
            <p className="text-sm font-semibold text-muted-foreground">
              No categories yet
            </p>
            <button
              type="button"
              onClick={openAddDialog}
              className="text-sm font-bold text-primary underline-offset-4
                hover:underline"
            >
              Create your first category
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                openEditModal={openEditModal}
                deleteCategory={deleteCategory}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                members={membersById.get(category.id) ?? []}
                share={(category.borrower_categories[0]?.count ?? 0) / biggest}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Category Dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={(v) => {
          if (!v) closeAddDialog();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="gap-3 pb-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full
                bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40
                dark:text-indigo-300"
            >
              <FolderPlus className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Add Category
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Create a new category to organize your borrowers.
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label
                htmlFor="add_category_name"
                className={formFieldLabelClassName}
              >
                Name
              </label>
              <input
                id="add_category_name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekly clients"
                className={formFieldInputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="add_category_color"
                className={formFieldLabelClassName}
              >
                Color
              </label>
              <input
                id="add_category_color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-11 w-full cursor-pointer rounded-xl border
                  border-slate-200 bg-white p-1 dark:border-slate-700
                  dark:bg-card"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={closeAddDialog}>
                Cancel
              </Button>
              <Button onClick={addCategory} disabled={isSaving || !name.trim()}>
                {isSaving ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog
        open={isEditModalOpen}
        onOpenChange={(v) => {
          if (!v) closeEditModal();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="gap-3 pb-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full
                bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40
                dark:text-indigo-300"
            >
              <Pencil className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Edit Category
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Update the category name, color, and sort order.
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label
                htmlFor="edit_category_name"
                className={formFieldLabelClassName}
              >
                Name
              </label>
              <input
                id="edit_category_name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={formFieldInputClassName}
              />
            </div>
            <div>
              <label
                htmlFor="edit_category_color"
                className={formFieldLabelClassName}
              >
                Color
              </label>
              <input
                id="edit_category_color"
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="h-11 w-full cursor-pointer rounded-xl border
                  border-slate-200 bg-white p-1 dark:border-slate-700
                  dark:bg-card"
              />
            </div>
            <div>
              <label
                htmlFor="edit_category_sort_order"
                className={formFieldLabelClassName}
              >
                Sort order
              </label>
              <input
                id="edit_category_sort_order"
                type="number"
                value={editSortOrder}
                onChange={(e) => setEditSortOrder(e.target.value)}
                placeholder="e.g. 1"
                className={formFieldInputClassName}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={closeEditModal}>
                Cancel
              </Button>
              <Button
                onClick={updateCategory}
                disabled={isUpdating || !editName.trim()}
              >
                {isUpdating ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
