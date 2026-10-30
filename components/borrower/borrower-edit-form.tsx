"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { toast } from "sonner";

import BorrowerDetailMenu from "@/components/borrower/borrower-detail-menu";
import { Button } from "@/components/ui/button";
import {
  borrowerSchema,
  type BorrowerFormValues,
} from "@/lib/validations/borrower";
import { formatContactNumber } from "@/lib/format-contact-number";
import { supabase } from "@/lib/supabase/client";
import { revalidateBorrowerDetailPage } from "@/lib/actions/borrowers";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { SheetFooter } from "@/components/dashboard/checklist-v2/sheet";
import {
  BorrowerFields,
  BorrowerSheetHeader,
  CategoryPicker,
} from "@/components/borrower/borrower-fields";

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
  /** In the edit sheet: no menu, and the buttons stick to its bottom. */
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
  const [selectedCategoryIds, setSelectedCategoryIds] =
    useState<string[]>(initialCategoryIds);

  const form = useForm<BorrowerFormValues>({
    resolver: zodResolver(borrowerSchema),
    defaultValues: {
      first_name: initial.first_name,
      last_name: initial.last_name,
      contact: initial.contact ? formatContactNumber(initial.contact) : "",
    },
  });
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  const fail = (message: string) => {
    triggerHaptic("error");
    toast.error(message);
  };

  const onSubmit = async (values: BorrowerFormValues) => {
    const { error } = await supabase
      .from("borrowers")
      .update({
        first_name: values.first_name,
        last_name: values.last_name,
        contact: values.contact?.trim() ? values.contact.trim() : null,
      })
      .eq("id", borrowerId);

    if (error) return fail(error.message);

    const { error: deleteLinksError } = await supabase
      .from("borrower_categories")
      .delete()
      .eq("borrower_id", borrowerId);

    if (deleteLinksError) return fail(deleteLinksError.message);

    if (selectedCategoryIds.length > 0) {
      const links = selectedCategoryIds.map((categoryId) => ({
        borrower_id: borrowerId,
        category_id: categoryId,
      }));

      const { error: linkInsertError } = await supabase
        .from("borrower_categories")
        .insert(links);

      if (linkInsertError) return fail(linkInsertError.message);
    }

    await revalidateBorrowerDetailPage(borrowerId);

    triggerHaptic("success");
    toast.success("Borrower saved");
    if (onSuccess) {
      onSuccess();
    } else {
      router.push(`/borrowers/${borrowerId}`);
    }
    router.refresh();
  };

  const buttons = (
    <div className="flex items-center gap-2">
      {onCancel ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isSubmitting}
          onClick={onCancel}
          className="h-12 flex-1 rounded-2xl font-bold"
        >
          Cancel
        </Button>
      ) : (
        <Button
          variant="outline"
          size="lg"
          asChild
          className="h-12 flex-1 rounded-2xl font-bold"
        >
          <Link href={`/borrowers/${borrowerId}`}>Cancel</Link>
        </Button>
      )}
      <Button
        type="submit"
        size="lg"
        disabled={isSubmitting}
        className="h-12 flex-[2] rounded-2xl text-base font-bold"
      >
        {isSubmitting ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex items-start justify-between">
        <BorrowerSheetHeader
          form={form}
          title="Edit borrower"
          fallback="Add a name"
        />
        {!hideMenu && (
          <div className="pt-3 pr-3">
            <BorrowerDetailMenu borrowerId={borrowerId} hideEditLink />
          </div>
        )}
      </div>
      <div className={cn("space-y-5 px-5", hideMenu ? "pb-5" : "pb-4")}>
        <BorrowerFields form={form} idPrefix="edit" />
        <CategoryPicker
          idPrefix="edit"
          selected={selectedCategoryIds}
          onChange={setSelectedCategoryIds}
        />
      </div>
      {hideMenu ? (
        <SheetFooter>{buttons}</SheetFooter>
      ) : (
        <div className="px-5 pb-5">{buttons}</div>
      )}
    </form>
  );
}
