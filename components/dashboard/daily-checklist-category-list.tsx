"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import Modal from "@/components/modal";
import { ChevronUp, ChevronDown, Pencil, Trash2 } from "lucide-react";

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
      -1,
    );
    const { error } = await supabase.from("daily_checklist_categories").insert({
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
      <article
        className="rounded-2xl border border-border/50 bg-background/60 p-4
          backdrop-blur-sm sm:p-5"
      >
        <h2
          className="mb-3 text-sm font-semibold text-slate-700
            dark:text-foreground"
        >
          Add category
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              className="dark:bg-card/50 dark:text-foreground w-full rounded-xl
                border border-border/50 bg-white/60 px-3 py-2 text-sm
                text-slate-700 transition-all duration-200
                placeholder:text-slate-400 focus:border-border
                focus:outline-none dark:placeholder:text-muted-foreground"
            />
          </div>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded-xl border
              border-border/50 bg-white/60 p-1 dark:bg-card/50"
            aria-label="Category color"
          />
          <button
            type="button"
            onClick={addCategory}
            disabled={isSaving || !name.trim()}
            className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm
              font-semibold text-white transition-all duration-200
              hover:bg-slate-700 disabled:opacity-40 dark:bg-foreground
              dark:text-background dark:hover:bg-foreground/80"
          >
            {isSaving ? "Adding…" : "Add"}
          </button>
        </div>
      </article>

      <div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border
                  border-border/50 px-4 py-3"
              >
                <div
                  className="size-4 animate-pulse rounded bg-slate-200
                    dark:bg-muted/60"
                />
                <div
                  className="h-4 flex-1 animate-pulse rounded bg-slate-100
                    dark:bg-muted/40"
                />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div
            className="dark:text-muted-foreground flex flex-col items-center
              gap-2 rounded-2xl border border-border/50 py-12 text-center"
          >
            <p className="text-sm text-slate-400">No categories yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {categories.map((category, index) => (
              <li
                key={category.id}
                className="flex items-center gap-3 rounded-xl border
                  border-border/50 bg-background/40 px-4 py-3 transition-all
                  duration-200 hover:bg-background/60"
              >
                <span
                  className="inline-block size-4 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                  aria-hidden
                />
                <span
                  className="min-w-0 flex-1 text-sm font-medium text-slate-700
                    dark:text-foreground"
                >
                  {category.name}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveCategory(index, "up")}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors
                      duration-200 hover:bg-slate-100 hover:text-slate-600
                      disabled:opacity-30 dark:text-muted-foreground
                      dark:hover:bg-muted/60 dark:hover:text-foreground"
                    title="Move up"
                    aria-label="Move category up"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === categories.length - 1}
                    onClick={() => moveCategory(index, "down")}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors
                      duration-200 hover:bg-slate-100 hover:text-slate-600
                      disabled:opacity-30 dark:text-muted-foreground
                      dark:hover:bg-muted/60 dark:hover:text-foreground"
                    title="Move down"
                    aria-label="Move category down"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(category)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors
                      duration-200 hover:bg-sky-50 hover:text-sky-600
                      dark:hover:bg-sky-900/20 dark:hover:text-sky-400"
                    title="Edit"
                    aria-label="Edit category"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(category)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors
                      duration-200 hover:bg-rose-50 hover:text-rose-500
                      dark:hover:bg-rose-900/20 dark:hover:text-rose-400"
                    title="Delete"
                    aria-label="Delete category"
                  >
                    <Trash2 className="size-4" />
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
            <label
              htmlFor="edit_category_name"
              className="dark:text-muted-foreground mb-1.5 block text-xs
                font-medium text-slate-500"
            >
              Name
            </label>
            <input
              id="edit_category_name"
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="dark:bg-card dark:text-foreground w-full rounded-xl
                border border-border/50 bg-white px-3 py-2.5 text-sm
                text-slate-700 transition-all duration-200 outline-none
                focus:border-border"
            />
          </div>
          <div>
            <label
              htmlFor="edit_category_color"
              className="dark:text-muted-foreground mb-1.5 block text-xs
                font-medium text-slate-500"
            >
              Color
            </label>
            <input
              id="edit_category_color"
              type="color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              className="h-11 w-full cursor-pointer rounded-xl border
                border-border/50 bg-white p-1 dark:bg-card"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeEditModal}
              className="dark:text-muted-foreground rounded-lg px-4 py-2 text-sm
                font-medium text-slate-600 transition-colors duration-200
                hover:bg-slate-100 dark:hover:bg-muted/60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={updateCategory}
              disabled={isUpdating}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium
                text-white transition-colors duration-200 hover:bg-slate-700
                disabled:opacity-40 dark:bg-foreground dark:text-background
                dark:hover:bg-foreground/80"
            >
              {isUpdating ? "Saving…" : "Save"}
            </button>
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
          <p className="text-sm text-slate-600 dark:text-muted-foreground">
            Are you sure you want to delete{" "}
            <strong className="dark:text-foreground">
              {deleteTarget?.name}
            </strong>
            ? Checklist items using this category will become uncategorized.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="dark:text-muted-foreground rounded-lg px-4 py-2 text-sm
                font-medium text-slate-600 transition-colors duration-200
                hover:bg-slate-100 dark:hover:bg-muted/60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (deleteTarget) void deleteCategory(deleteTarget.id);
              }}
              className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium
                text-white transition-colors duration-200 hover:bg-rose-600"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
