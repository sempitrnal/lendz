"use client";

import { useEffect, useRef, useState } from "react";

import Modal from "@/components/modal";
import NeobrutButton from "@/components/neobrut-button";
import {
  formFieldInputClassName,
  formFieldLabelClassName,
} from "@/lib/form-field-classes";
import { supabase } from "@/lib/supabase/client";
import CategoryCard from "./category-card";
import BackButton from "../back-button";
type Count = {
  count: number
}
export type Category = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  borrower_categories: Count[]
};

export default function CategoryList() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#22c55e");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#22c55e");
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const loadCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, color, created_at, borrower_categories(count)")
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setCategories((data ?? []) as Category[]);
    setLoading(false);
  };

  useEffect(() => {
    loadCategories();
  }, []);

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

    setName("");
    setColor("#22c55e");
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
      .update({
        name: trimmed,
        color: editColor,
      })
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

    const { error, data } = await supabase
      .from("categories")
      .delete()
      .eq("id", id);
    console.log("hello")
    console.log(data)
    if (error) {
      alert(error.message);
      return;
    }

    loadCategories();
  };
  return (
    <div className="flex flex-col gap-6 relative" >
      <div className="rounded-lg border border-slate-200 bg-linear-to-r from-cyan-50 via-white to-blue-50 p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-sm text-gray-500">Manage borrower categories</p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              className={`${formFieldInputClassName} sm:mb-0`}
            />
          </div>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-11 w-16 cursor-pointer rounded-lg border"
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
      </div>

      <div className="">
        {loading ? (
          <p className="text-sm text-gray-500">Loading categories...</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-gray-500">No categories yet.</p>
        ) : (
          <div className="grid-cols-1 md:grid-cols-3 grid gap-3">
            {categories.map((category) => (
              <CategoryCard deleteCategory={deleteCategory} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} key={category.id} category={category} openEditModal={openEditModal} />
            ))}
          </div>
        )
        }
      </div >

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
              className="h-11 w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
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
    </div >
  );
}
