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

export default function BorrowerForm({ onSuccess }: {
  onSuccess: any
}) {
  const router = useRouter();

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
    console.log("hello")
    router.refresh()
    reset();

    onSuccess?.()
    router.refresh()

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