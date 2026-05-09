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
import {
  bimonthlyLegacyInstallmentAmount,
  generateLegacyBimonthlyDueDates,
} from "@/lib/payment-schedule/bimonthly-legacy";

function formatLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Avoid UTC vs local ambiguity from `new Date("YYYY-MM-DD")`. */
function parseDateInput(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
const formatNumber = (value: string) => {
  const num = value.replace(/,/g, "");
  if (!num) return "";
  return Number(num).toLocaleString();
};
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
    setValue,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      borrower_id: borrowerId,
      type: "loan",
      payment_frequency: "bimonthly",
    },
  });
  const value = watch("principal_amount");
  const onSubmit = async (values: AccountFormValues) => {
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

    const schedules: Array<{
      account_id: string;
      due_date: string;
      amount_due: number;
      status: string;
    }> = [];

    if (values.payment_frequency === "bimonthly") {
      const start = parseDateInput(values.first_payment_date);
      const dueDates = generateLegacyBimonthlyDueDates(
        start,
        values.term_months
      );
      const pay = bimonthlyLegacyInstallmentAmount(
        values.principal_amount,
        values.interest_rate,
        values.term_months
      );

      for (const d of dueDates) {
        schedules.push({
          account_id: account.id,
          due_date: formatLocalISODate(d),
          amount_due: pay,
          status: "pending",
        });
      }
    } else {
      let currentDate = parseDateInput(values.first_payment_date);

      for (let i = 0; i < values.term_months; i++) {
        schedules.push({
          account_id: account.id,
          due_date: formatLocalISODate(currentDate),
          amount_due: Number(installmentAmount.toFixed(2)),
          status: "pending",
        });

        if (values.payment_frequency === "monthly") {
          currentDate.setMonth(currentDate.getMonth() + 1);
        } else if (values.payment_frequency === "weekly") {
          currentDate.setDate(currentDate.getDate() + 7);
        } else {
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
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
      payment_frequency: "bimonthly",
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
          type="text"
          inputMode="decimal"
          {...register("principal_amount", {
            setValueAs: (v) =>
              Number(String(v).replace(/,/g, "")),
          })}
          value={
            value
              ? Number(value).toLocaleString()
              : ""
          }
          onChange={(e) => {
            const raw = e.target.value.replace(/,/g, "");

            if (raw === "") {
              setValue("principal_amount", 0);
              return;
            }

            const num = Number(raw);

            if (!isNaN(num)) {
              setValue("principal_amount", num);
            }
          }}
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
        <div className="min-w-0">
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
            className={`${formFieldInputClassName} w-full min-w-0`}
          />

          {errors.release_date?.message ? (
            <p className={formFieldErrorClassName}>
              {errors.release_date.message}
            </p>
          ) : null}
        </div>

        <div className="min-w-0">
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
            className={`${formFieldInputClassName} w-full min-w-0`}
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
          defaultValue="bimonthly"
          id="payment_frequency"
          {...register("payment_frequency")}
          className={formFieldInputClassName}
        >
          <option value="weekly">weekly</option>
          <option value="bimonthly">
            bimonthly
          </option>
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

