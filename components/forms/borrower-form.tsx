"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { borrowerSchema, BorrowerFormValues } from "@/lib/validations/borrower";
import { supabase } from "@/lib/supabase/client";
import { revalidateBorrowersPage } from "@/lib/actions/borrowers";
import { triggerHaptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/dashboard/checklist-v2/sheet";
import {
  BorrowerFields,
  BorrowerSheetHeader,
  CategoryPicker,
} from "@/components/borrower/borrower-fields";

/** The add borrower sheet's content. */
export default function BorrowerForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  const form = useForm<BorrowerFormValues>({
    resolver: zodResolver(borrowerSchema),
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  const onSubmit = async (values: BorrowerFormValues) => {
    const { data, error } = await supabase
      .from("borrowers")
      .insert(values)
      .select()
      .single();

    if (error) {
      triggerHaptic("error");
      toast.error(error.message);
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
        triggerHaptic("error");
        toast.error(categoryLinkError.message);
        return;
      }
    }

    await revalidateBorrowersPage();

    reset();
    setSelectedCategoryIds([]);

    triggerHaptic("success");
    toast.success("Borrower created successfully");
    onSuccess?.();
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <BorrowerSheetHeader
        form={form}
        title="New borrower"
        fallback="Who are you lending to?"
      />
      <div className="space-y-5 px-5 pb-5">
        <BorrowerFields form={form} idPrefix="add" />
        <CategoryPicker
          idPrefix="add"
          selected={selectedCategoryIds}
          onChange={setSelectedCategoryIds}
        />
      </div>
      <SheetFooter>
        <Button
          disabled={isSubmitting}
          type="submit"
          size="lg"
          className="h-12 w-full rounded-2xl text-base font-bold"
        >
          <Plus className="size-5" strokeWidth={2.75} />
          {isSubmitting ? "Adding…" : "Add borrower"}
        </Button>
      </SheetFooter>
    </form>
  );
}
