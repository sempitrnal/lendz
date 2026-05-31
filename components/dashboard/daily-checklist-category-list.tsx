"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import NeobrutButton from "@/components/neobrut-button";
import Modal from "@/components/modal";
import {
  formFieldInputClassName,
  formFieldLabelClassName,
} from "@/lib/form-field-classes";
import { GripVertical } from "lucide-react";

export type DailyChecklistCategory = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
};

export default function DailyChecklistCategoryList() {
  const [categories, setCategories] = useState<DailyChecklistCategory[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<DailyChecklistCategory | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#3b82f6");
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<DailyChecklistCategory | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("daily_checklist_categories")
      .select("id, name, color, sort_order, created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setCategories((data ?? []) as DailyChecklistCategory[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadCategories();
  }, []);

  const addCategory = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsSaving(true);
    const maxSort = categories.reduce(
      (max, c) => Math.max(max, c.sort_order),
      -1
    );
    const { error } = await supabase
      .from("daily_checklist_categories")
      .insert({
        name: trimmed,
        color,
        sort_order: maxSort + 1,
      });
    setIsSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setName("");
    setColor("#3b82f6");
    await loadCategories();
  };

  const openEditModal = (category: DailyChecklistCategory) => {
    setEditingCategory(category);
    setEditName(category.name);
    setEditColor(category.color);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingCategory(null);
    setEditName("");
    setEditColor("#3b82f6");
  };

  const updateCategory = async () => {
    if (!editingCategory) return;
    const trimmed = editName.trim();
    if (!trimmed) return;

    setIsUpdating(true);
    const { error } = await supabase
      .from("daily_checklist_categories")
      .update({ name: trimmed, color: editColor })
      .eq("id", editingCategory.id);
    setIsUpdating(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    closeEditModal();
    await loadCategories();
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase
      .from("daily_checklist_categories")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setDeleteTarget(null);
    await loadCategories();
  };

  const moveCategory = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const updated = [...categories];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // update sort_order values
    const reordered = updated.map((c, i) => ({ ...c, sort_order: i }));
    setCategories(reordered);

    // persist
    for (const c of reordered) {
      await supabase
        .from("daily_checklist_categories")
        .update({ sort_order: c.sort_order })
        .eq("id", c.id);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <article className="rounded-xl border-2 border-slate-900 bg-linear-to-r from-violet-50 via-white to-fuchsia-100 p-4 shadow-[4px_4px_0px_0px_#0f172a] dark:border-border dark:from-violet-950/20 dark:via-card dark:to-fuchsia-950/20 dark:shadow-none sm:p-5">
        <h2 className="mb-3 text-base font-black lowercase text-slate-900 dark:text-foreground">
          add category
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              className="w-full rounded-md border-2 border-slate-900 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:-translate-y-0.5 focus:translate-x-0.5 focus:shadow-[4px_4px_0px_0px_#334155] dark:border-border dark:bg-card dark:text-foreground dark:focus:shadow-none"
            />
          </div>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded-md border-2 border-slate-900 bg-white p-1 dark:border-border dark:bg-card"
            aria-label="Category color"
          />
          <NeobrutButton
            onClick={addCategory}
            disabled={isSaving}
            variant="green"
            className="h-fit"
          >
            {isSaving ? "Adding..." : "Add category"}
          </NeobrutButton>
        </div>
      </article>

      <div>
        {loading ? (
          <p className="text-sm text-slate-500 dark:text-muted-foreground">Loading categories...</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-muted-foreground">No categories yet.</p>
        ) : (
          <ul className="space-y-2">
            {categories.map((category, index) => (
              <li
                key={category.id}
                className="flex items-center gap-2 rounded-lg border-2 border-slate-900 bg-white px-3 py-2 shadow-[2px_2px_0px_0px_#0f172a] dark:border-border dark:bg-card dark:shadow-none"
              >
                <span
                  className="inline-block size-4 shrink-0 rounded-sm border border-slate-900/25"
                  style={{ backgroundColor: category.color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 text-sm font-bold text-slate-900 dark:text-foreground">
                  {category.name}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveCategory(index, "up")}
                    className="rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-border dark:text-muted-foreground dark:hover:bg-muted"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={index === categories.length - 1}
                    onClick={() => moveCategory(index, "down")}
                    className="rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 dark:border-border dark:text-muted-foreground dark:hover:bg-muted"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(category)}
                    className="text-xs font-bold uppercase text-sky-700 dark:text-sky-400"
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(category)}
                    className="text-xs font-bold uppercase text-rose-700 dark:text-rose-400"
                  >
                    delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        closeOnEscape
        closeOnOverlayClick
        title="Edit category"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="edit_category_name" className={formFieldLabelClassName}>
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
            <label htmlFor="edit_category_color" className={formFieldLabelClassName}>
              Color
            </label>
            <input
              id="edit_category_color"
              type="color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-border dark:bg-card"
            />
          </div>
          <div className="flex justify-end gap-2">
            <NeobrutButton variant="white" onClick={closeEditModal}>
              Cancel
            </NeobrutButton>
            <NeobrutButton
              variant="green"
              onClick={updateCategory}
              disabled={isUpdating}
            >
              {isUpdating ? "Saving..." : "Save"}
            </NeobrutButton>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        closeOnEscape
        closeOnOverlayClick
        title="Delete category"
        size="xs"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 dark:text-muted-foreground">
            Are you sure you want to delete{" "}
            <strong className="dark:text-foreground">{deleteTarget?.name}</strong>? Checklist items using this
            category will become uncategorized.
          </p>
          <div className="flex justify-end gap-2">
            <NeobrutButton
              variant="white"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </NeobrutButton>
            <NeobrutButton
              variant="red"
              onClick={() => {
                if (deleteTarget) void deleteCategory(deleteTarget.id);
              }}
            >
              Delete
            </NeobrutButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
