"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import {
  accountSchema,
  type AccountFormValues,
} from "@/lib/validations/account";
import {
  formFieldErrorClassName,
  formFieldInputClassName,
  formFieldLabelClassName,
} from "@/lib/form-field-classes";
import { supabase } from "@/lib/supabase/client";
import NeobrutButton from "@/components/neobrut-button";

type AccountFormProps = {
  borrowerId: string;
  onSuccess?: () => void;
};

export default function AccountForm({
  borrowerId,
  onSuccess,
}: AccountFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      borrower_id: borrowerId,
      type: "loan",
      payment_frequency: "monthly",
    },
  });
  const onSubmit = async (values: AccountFormValues) => {
    // 1. Calculate totals
    const totalWithInterest =
      values.principal_amount *
      (1 + values.interest_rate / 100);

    const installmentAmount =
      totalWithInterest / values.term_months;

    // 2. Create account first
    const { data: account, error } = await supabase
      .from("accounts")
      .insert(values)
      .select()
      .single();

    if (error || !account) {
      alert(error?.message);
      return;
    }

    // 3. Generate payment schedules
    const schedules = [];

    let currentDate = new Date(
      values.first_payment_date
    );

    for (let i = 0; i < values.term_months; i++) {
      schedules.push({
        account_id: account.id,

        due_date: currentDate
          .toISOString()
          .split("T")[0],

        amount_due: Number(
          installmentAmount.toFixed(2)
        ),

        status: "pending",
      });

      // Increment date based on frequency
      if (values.payment_frequency === "monthly") {
        currentDate.setMonth(
          currentDate.getMonth() + 1
        );
      }

      if (values.payment_frequency === "weekly") {
        currentDate.setDate(
          currentDate.getDate() + 7
        );
      }
    }

    // 4. Insert payment schedules
    const { error: scheduleError } = await supabase
      .from("payment_schedules")
      .insert(schedules);

    if (scheduleError) {
      alert(scheduleError.message);
      return;
    }

    // 5. Reset form
    reset({
      borrower_id: borrowerId,
      type: "loan",
      payment_frequency: "monthly",
    });

    router.refresh();
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <input type="hidden" {...register("borrower_id")} />

      <div>
        <label className={formFieldLabelClassName} htmlFor="account_type">
          Account type
        </label>
        <select
          id="account_type"
          {...register("type")}
          className={formFieldInputClassName}
        >
          <option value="loan">loan</option>
          <option value="cash_advance">cash advance</option>
        </select>
        {errors.type?.message ? (
          <p className={formFieldErrorClassName}>{errors.type.message}</p>
        ) : null}
      </div>

      <div>
        <label
          className={formFieldLabelClassName}
          htmlFor="principal_amount"
        >
          Principal amount
        </label>
        <input
          id="principal_amount"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          {...register("principal_amount", { valueAsNumber: true })}
          className={formFieldInputClassName}
        />
        {errors.principal_amount?.message ? (
          <p className={formFieldErrorClassName}>
            {errors.principal_amount.message}
          </p>
        ) : null}
      </div>

      <div>
        <label className={formFieldLabelClassName} htmlFor="interest_rate">
          Interest rate (%)
        </label>
        <input
          id="interest_rate"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          max={100}
          {...register("interest_rate", { valueAsNumber: true })}
          className={formFieldInputClassName}
        />
        {errors.interest_rate?.message ? (
          <p className={formFieldErrorClassName}>
            {errors.interest_rate.message}
          </p>
        ) : null}
      </div>

      <div>
        <label className={formFieldLabelClassName} htmlFor="term_months">
          Term (months)
        </label>
        <input
          id="term_months"
          type="number"
          inputMode="numeric"
          step={1}
          min={1}
          {...register("term_months", { valueAsNumber: true })}
          className={formFieldInputClassName}
        />
        {errors.term_months?.message ? (
          <p className={formFieldErrorClassName}>
            {errors.term_months.message}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            className={formFieldLabelClassName}
            htmlFor="release_date"
          >
            Release date
          </label>
          <input
            id="release_date"
            type="date"
            {...register("release_date")}
            className={formFieldInputClassName}
          />
          {errors.release_date?.message ? (
            <p className={formFieldErrorClassName}>
              {errors.release_date.message}
            </p>
          ) : null}
        </div>

        <div>
          <label
            className={formFieldLabelClassName}
            htmlFor="first_payment_date"
          >
            First payment date
          </label>
          <input
            id="first_payment_date"
            type="date"
            {...register("first_payment_date")}
            className={formFieldInputClassName}
          />
          {errors.first_payment_date?.message ? (
            <p className={formFieldErrorClassName}>
              {errors.first_payment_date.message}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label
          className={formFieldLabelClassName}
          htmlFor="payment_frequency"
        >
          Payment frequency
        </label>
        <select
          id="payment_frequency"
          {...register("payment_frequency")}
          className={formFieldInputClassName}
        >
          <option value="weekly">weekly</option>
          <option value="monthly">monthly</option>
          <option value="custom">custom</option>
        </select>
        {errors.payment_frequency?.message ? (
          <p className={formFieldErrorClassName}>
            {errors.payment_frequency.message}
          </p>
        ) : null}
      </div>

      <NeobrutButton
        type="submit"
        variant="green"
        disabled={isSubmitting}
        className="mt-2 w-full"
      >
        {isSubmitting ? "Creating..." : "Create account"}
      </NeobrutButton>
    </form>
  );
}

