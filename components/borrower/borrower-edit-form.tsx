"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import BorrowerDetailMenu from "@/components/borrower/borrower-detail-menu";
import { Button } from "@/components/ui/button";
import {
  borrowerSchema,
  type BorrowerFormValues,
} from "@/lib/validations/borrower";
import {
  formFieldErrorClassName,
  formFieldInputClassName,
  formFieldLabelClassName,
} from "@/lib/form-field-classes";
import { formatContactNumber } from "@/lib/format-contact-number";
import { supabase } from "@/lib/supabase/client";
import { fetchCategoriesAction } from "@/lib/actions/categories";
import { revalidateBorrowerDetailPage } from "@/lib/actions/borrowers";
import { useEffect, useState } from "react";
import { isDarkColor } from "@/lib/utils";
import { X } from "lucide-react";

type CategoryOption = {
  id: string;
  name: string;
  color: string;
};

export type BorrowerEditFormProps = {
  borrowerId: string;
  initial: {
    first_name: string;
    last_name: string;
    contact: string | null;
  };
  initialCategoryIds: string[];
  onCancel?: () => void;
  onSuccess?: () => void;
  hideMenu?: boolean;
};

export default function BorrowerEditForm({
  borrowerId,
  initial,
  initialCategoryIds,
  onCancel,
  onSuccess,
  hideMenu = false,
}: BorrowerEditFormProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] =
    useState<string[]>(initialCategoryIds);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BorrowerFormValues>({
    resolver: zodResolver(borrowerSchema),
    defaultValues: {
      first_name: initial.first_name,
      last_name: initial.last_name,
      contact: initial.contact ? formatContactNumber(initial.contact) : "",
    },
  });

  const {
    ref: contactRef,
    onChange: contactOnChange,
    ...contactRest
  } = register("contact");

  useEffect(() => {
    fetchCategoriesAction().then((rows) => {
      setCategories(
        rows.map((c) => ({ id: c.id, name: c.name, color: c.color ?? "" })),
      );
    });
  }, []);

  const onSubmit = async (values: BorrowerFormValues) => {
    const { error } = await supabase
      .from("borrowers")
      .update({
        first_name: values.first_name,
        last_name: values.last_name,
        contact: values.contact?.trim() ? values.contact.trim() : null,
      })
      .eq("id", borrowerId);

    if (error) {
      alert(error.message);
      return;
    }

    const { error: deleteLinksError } = await supabase
      .from("borrower_categories")
      .delete()
      .eq("borrower_id", borrowerId);

    if (deleteLinksError) {
      alert(deleteLinksError.message);
      return;
    }

    if (selectedCategoryIds.length > 0) {
      const links = selectedCategoryIds.map((categoryId) => ({
        borrower_id: borrowerId,
        category_id: categoryId,
      }));

      const { error: linkInsertError } = await supabase
        .from("borrower_categories")
        .insert(links);

      if (linkInsertError) {
        alert(linkInsertError.message);
        return;
      }
    }

    await revalidateBorrowerDetailPage(borrowerId);

    if (onSuccess) {
      onSuccess();
    } else {
      router.push(`/borrowers/${borrowerId}`);
    }
    router.refresh();
  };

  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(categorySearch.trim().toLowerCase()),
  );

  const selectedCategoryNames = categories
    .filter((category) => selectedCategoryIds.includes(category.id))
    .map((category) => {
      return {
        name: category.name,
        color: category.color,
      };
    });

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId],
    );
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <form
        id="borrower-edit-form"
        onSubmit={handleSubmit(onSubmit)}
        className="flex min-w-0 flex-1 flex-col gap-5"
      >
        <div>
          <label htmlFor="edit_first_name" className={formFieldLabelClassName}>
            First Name
          </label>
          <input
            id="edit_first_name"
            autoComplete="given-name"
            {...register("first_name")}
            className={formFieldInputClassName}
          />
          {errors.first_name?.message ? (
            <p className={formFieldErrorClassName}>
              {errors.first_name.message}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="edit_last_name" className={formFieldLabelClassName}>
            Last Name
          </label>
          <input
            id="edit_last_name"
            autoComplete="family-name"
            {...register("last_name")}
            className={formFieldInputClassName}
          />
          {errors.last_name?.message ? (
            <p className={formFieldErrorClassName}>
              {errors.last_name.message}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="edit_contact" className={formFieldLabelClassName}>
            Contact Number
          </label>
          <input
            id="edit_contact"
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
        <div>
          <label
            htmlFor="edit_borrower_categories_search"
            className={formFieldLabelClassName}
          >
            Categories
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
              className={`${formFieldInputClassName} flex w-full items-center
                justify-between`}
            >
              <div className="flex flex-wrap gap-2">
                {selectedCategoryNames.length > 0
                  ? selectedCategoryNames.map((e) => {
                      return (
                        <div
                          key={e.name}
                          style={{ backgroundColor: e.color }}
                          className={`flex items-center gap-1 rounded-full
                            px-2.5 py-1 text-xs font-semibold ${
                              isDarkColor(e.color)
                                ? "text-white"
                                : "text-slate-800"
                            }`}
                        >
                          <span>{e.name}</span>
                          <span
                            onClick={(b) => {
                              b.stopPropagation();
                              setSelectedCategoryIds((prev) =>
                                prev.filter((id) => {
                                  const category = categories.find(
                                    (c) => c.id === id,
                                  );

                                  return category?.name !== e.name;
                                }),
                              );
                            }}
                            className="ml-0.5 flex h-4 w-4 cursor-pointer
                              items-center justify-center rounded-full
                              opacity-70 hover:bg-black/10 hover:opacity-100"
                          >
                            <X className="h-3 w-3" strokeWidth={3} />
                          </span>
                        </div>
                      );
                    })
                  : "Select categories"}
              </div>
              <span className="ml-2 text-xs text-slate-400">
                {isCategoryDropdownOpen ? "▲" : "▼"}
              </span>
            </button>

            {isCategoryDropdownOpen ? (
              <div
                className="absolute z-20 mt-2 w-full rounded-xl border
                  border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700
                  dark:bg-card"
              >
                <input
                  id="edit_borrower_categories_search"
                  type="text"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Search categories..."
                  className={formFieldInputClassName}
                />

                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
                  {filteredCategories.length === 0 ? (
                    <p
                      className="px-2 py-1 text-sm text-gray-500
                        dark:text-muted-foreground"
                    >
                      No categories found.
                    </p>
                  ) : (
                    filteredCategories.map((category) => {
                      const checked = selectedCategoryIds.includes(category.id);
                      return (
                        <label
                          key={category.id}
                          className="flex cursor-pointer items-center gap-3
                            rounded-lg px-2 py-2 hover:bg-slate-50
                            dark:hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCategory(category.id)}
                            className="h-4 w-4 rounded border-slate-300
                              text-emerald-600 focus:ring-emerald-500"
                          />
                          <span
                            className="h-3 w-3 rounded-full border
                              border-slate-200"
                            style={{
                              backgroundColor: category.color ?? "#cbd5e1",
                            }}
                          />
                          <span className="text-sm">{category.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>

                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsCategoryDropdownOpen(false)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <p
            className="mt-1.5 text-xs text-slate-500 dark:text-muted-foreground"
          >
            Search and tick one or more categories.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          {onCancel ? (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link href={`/borrowers/${borrowerId}`}>Cancel</Link>
            </Button>
          )}
          <Button
            type="submit"
            form="borrower-edit-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>

      {!hideMenu && (
        <div className="flex shrink-0 flex-col items-end gap-3">
          <BorrowerDetailMenu borrowerId={borrowerId} hideEditLink />
        </div>
      )}
    </div>
  );
}
