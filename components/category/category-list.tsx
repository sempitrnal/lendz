"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
import { fetchCategoriesAction } from "@/lib/actions/categories";
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
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

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
      const rows = await fetchCategoriesAction();
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

  return (
    <div className="mx-auto max-w-7xl py-10 md:max-w-full px-4 pb-16 md:px-6">
      <div className="flex items-end justify-between">
        <div>
          <h1
            className="text-2xl font-black tracking-tight text-slate-600
              dark:text-foreground"
          >
            categories
          </h1>
          <p
            className="mt-1 text-sm text-slate-400 mb-5
              dark:text-muted-foreground"
          >
            {categories.length} categor{categories.length === 1 ? "y" : "ies"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border
                border-slate-200/60 bg-slate-50/50 dark:border-slate-800
                dark:bg-slate-900/30"
            />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl
            border border-dashed border-slate-200 bg-slate-50/30 py-20
            dark:border-slate-800 dark:bg-slate-900/20"
        >
          <p
            className="text-sm font-medium text-slate-400
              dark:text-muted-foreground"
          >
            No categories yet
          </p>
          <button
            type="button"
            onClick={openAddDialog}
            className="text-sm font-semibold text-slate-600 underline-offset-4
              hover:underline dark:text-foreground"
          >
            Create your first category
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              openEditModal={openEditModal}
              deleteCategory={deleteCategory}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
            />
          ))}
        </div>
      )}

      {/* FAB — portalled to body to escape PageTransition transform stacking context */}
      {isMounted &&
        createPortal(
          <button
            type="button"
            onClick={openAddDialog}
            aria-label="Add category"
            className="fixed bottom-[76px] right-4 z-40 flex size-14
              items-center justify-center rounded-full bg-slate-900 text-white
              shadow-lg shadow-slate-900/20 transition-all duration-200
              hover:scale-105 hover:shadow-xl hover:shadow-slate-900/25
              active:scale-95 dark:bg-foreground dark:text-background
              dark:shadow-black/30"
          >
            <Plus className="size-5" />
          </button>,
          document.body,
        )}

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
