"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import BorrowerDetailMenu from "@/components/borrower/borrower-detail-menu";
import NeobrutButton, {
  neobrutButtonClassName,
} from "@/components/neobrut-button";
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

export type BorrowerEditFormProps = {
  borrowerId: string;
  initial: {
    first_name: string;
    last_name: string;
    contact: string | null;
  };
};

export default function BorrowerEditForm({
  borrowerId,
  initial,
}: BorrowerEditFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BorrowerFormValues>({
    resolver: zodResolver(borrowerSchema),
    defaultValues: {
      first_name: initial.first_name,
      last_name: initial.last_name,
      contact: initial.contact
        ? formatContactNumber(initial.contact)
        : "",
    },
  });

  const { ref: contactRef, onChange: contactOnChange, ...contactRest } =
    register("contact");

  const onSubmit = async (values: BorrowerFormValues) => {
    const { error } = await supabase
      .from("borrowers")
      .update({
        first_name: values.first_name,
        last_name: values.last_name,
        contact: values.contact?.trim()
          ? values.contact.trim()
          : null,
      })
      .eq("id", borrowerId);

    if (error) {
      alert(error.message);
      return;
    }

    router.push(`/borrowers/${borrowerId}`);
    router.refresh();
  };

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <form
          id="borrower-edit-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex min-w-0 flex-1 flex-col gap-4"
        >
          <div>
            <label
              htmlFor="edit_first_name"
              className={formFieldLabelClassName}
            >
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
            <label
              htmlFor="edit_last_name"
              className={formFieldLabelClassName}
            >
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
            <label
              htmlFor="edit_contact"
              className={formFieldLabelClassName}
            >
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
                const formatted = formatContactNumber(
                  e.target.value
                );
                e.target.value = formatted;
                contactOnChange(e);
              }}
              className={formFieldInputClassName}
            />
          </div>
          <div className="flex items-center justify-end gap-4">
            <Link
              href={`/borrowers/${borrowerId}`}
              className={neobrutButtonClassName(
                "white",
                "mt-5 inline-flex items-center justify-center"
              )}
            >
              Cancel
            </Link>
            <NeobrutButton
              type="submit"
              form="borrower-edit-form"
              variant="green"
              disabled={isSubmitting}
              className="mt-5"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </NeobrutButton>
          </div>
        </form>

        <div className="flex shrink-0 flex-col items-end gap-3">
          <BorrowerDetailMenu borrowerId={borrowerId} hideEditLink />
        </div>
      </div>
    </div>
  );
}
