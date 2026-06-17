"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FaPlus } from "react-icons/fa6";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import NeobrutButton from "@/components/neobrut-button";
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
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingCategoryId(null);
    setEditName("");
    setEditColor("#22c55e");
  };

  const updateCategory = async () => {
    if (!editingCategoryId) return;
    const trimmed = editName.trim();
    if (!trimmed) return;

    setIsUpdating(true);
    const { error } = await supabase
      .from("categories")
      .update({ name: trimmed, color: editColor })
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
    <div className="flex flex-col gap-6 relative min-h-[60vh]">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-black lowercase tracking-tight
              text-slate-900 dark:text-foreground"
          >
            Categories
          </h1>
          <p className="text-sm text-slate-500">
            {categories.length} categor{categories.length === 1 ? "y" : "ies"}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading categories...</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-gray-500">No categories yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              items-center justify-center rounded-full border-2 border-slate-900
              bg-green-400 text-white shadow-[3px_3px_0px_0px_rgb(15_23_42/0.4)]
              transition-transform duration-200 active:scale-95
              dark:border-border dark:bg-green-400 dark:text-background
              dark:shadow-[3px_3px_0px_0px_rgb(0_0_0/0.5)]"
          >
            <FaPlus className="size-5" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
                autoFocus
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
                className="h-11 w-full cursor-pointer rounded-lg border
                  border-slate-300 bg-white p-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeAddDialog}>
                Cancel
              </Button>
              <NeobrutButton
                variant="green"
                onClick={addCategory}
                disabled={isSaving || !name.trim()}
              >
                {isSaving ? "Adding..." : "Add"}
              </NeobrutButton>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
                className="h-11 w-full cursor-pointer rounded-lg border
                  border-slate-300 bg-white p-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeEditModal}>
                Cancel
              </Button>
              <NeobrutButton
                variant="green"
                onClick={updateCategory}
                disabled={isUpdating || !editName.trim()}
              >
                {isUpdating ? "Saving..." : "Save"}
              </NeobrutButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
