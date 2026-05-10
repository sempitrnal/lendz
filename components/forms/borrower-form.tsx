"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  borrowerSchema,
  BorrowerFormValues,
} from "@/lib/validations/borrower";

import {
  formFieldErrorClassName,
  formFieldInputClassName,
  formFieldLabelClassName,
} from "@/lib/form-field-classes";
import { formatContactNumber } from "@/lib/format-contact-number";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type CategoryOption = {
  id: string;
  name: string;
  color: string | null;
};

export default function BorrowerForm({ onSuccess }: {
  onSuccess: any
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BorrowerFormValues>({
    resolver: zodResolver(borrowerSchema),
  });

  const { ref: contactRef, onChange: contactOnChange, ...contactRest } =
    register("contact");

  useEffect(() => {
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, color")
        .order("name", { ascending: true });

      if (!error) {
        setCategories((data ?? []) as CategoryOption[]);
      }
    };

    loadCategories();
  }, []);

  const onSubmit = async (values: BorrowerFormValues) => {
    const { data, error } = await supabase
      .from("borrowers")
      .insert(values)
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }
    if (selectedCategoryIds.length > 0) {
      const links = selectedCategoryIds.map((categoryId) => ({
        borrower_id: data.id,
        category_id: categoryId,
      }));

      const { error: categoryLinkError } = await supabase
        .from("borrower_categories")
        .insert(links);

      if (categoryLinkError) {
        alert(categoryLinkError.message);
        return;
      }
    }

    router.refresh()
    reset();
    setSelectedCategoryIds([]);

    onSuccess?.()
    router.refresh()

  };

  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(categorySearch.trim().toLowerCase())
  );

  const selectedCategoryNames = categories
    .filter((category) => selectedCategoryIds.includes(category.id))
    .map((category) => category.name);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className=" border-slate-900  p-6 pb-20 "
    >
      <div className="">
        <label
          htmlFor="first_name"
          className={formFieldLabelClassName}
        >
          First Name
        </label>
        <input
          id="first_name"
          placeholder="Juan"
          {...register("first_name")}
          className={formFieldInputClassName}
        />
        <p className={formFieldErrorClassName}>
          {errors.first_name?.message}
        </p>
      </div>

      <div className="">
        <label
          htmlFor="last_name"
          className={formFieldLabelClassName}
        >
          Last Name
        </label>
        <input
          id="last_name"
          placeholder="Dela Cruz"
          {...register("last_name")}
          className={formFieldInputClassName}
        />
        <p className={formFieldErrorClassName}>
          {errors.last_name?.message}
        </p>
      </div>

      <div className="mb-2">
        <label
          htmlFor="contact"
          className={formFieldLabelClassName}
        >
          Contact Number
        </label>
        <input
          id="contact"
          ref={contactRef}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="(0977) 123-4567"
          {...contactRest}
          onChange={(e) => {
            const formatted = formatContactNumber(e.target.value);
            e.target.value = formatted;
            contactOnChange(e);
          }}
          className={formFieldInputClassName}
        />
      </div>

      <div className="mb-2">
        <label
          htmlFor="borrower_categories_search"
          className={formFieldLabelClassName}
        >
          Categories
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
            className={`${formFieldInputClassName} flex w-full items-center justify-between`}
          >
            <span className="truncate text-left">
              {selectedCategoryNames.length > 0
                ? selectedCategoryNames.join(", ")
                : "Select categories"}
            </span>
            <span className="ml-2 text-xs text-slate-500">
              {isCategoryDropdownOpen ? "▲" : "▼"}
            </span>
          </button>

          {isCategoryDropdownOpen ? (
            <div className="absolute z-20 mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              <input
                id="borrower_categories_search"
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search categories..."
                className={formFieldInputClassName}
              />

              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
                {filteredCategories.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-gray-500">
                    No categories found.
                  </p>
                ) : (
                  filteredCategories.map((category) => {
                    const checked = selectedCategoryIds.includes(category.id);
                    return (
                      <label
                        key={category.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCategory(category.id)}
                          className="h-4 w-4"
                        />
                        <span
                          className="h-3 w-3 rounded-full border"
                          style={{ backgroundColor: category.color ?? "#cbd5e1" }}
                        />
                        <span className="text-sm">{category.name}</span>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsCategoryDropdownOpen(false)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Done
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Search and tick one or more categories.
        </p>
      </div>

      <button
        disabled={isSubmitting}
        type="submit"
        className="mt-10 w-full cursor-pointer rounded-lg border-4 border-slate-900 bg-slate-300 px-4 py-2 text-sm font-black lowercase tracking-wide text-slate-900 shadow-[6px_6px_0px_0px_#1e293b] transition hover:-translate-y-0.5 hover:translate-x-0.5 hover:shadow-[4px_4px_0px_0px_#1e293b] hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creating..." : "Create Borrower"}
      </button>
    </form>
  );
}