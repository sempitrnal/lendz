"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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
import { addOneMonthAnchored } from "@/lib/payment-schedule/monthly-anchor";

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

export function isoDateOnlyForInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function buildSchedulesPayload(
  accountId: string,
  values: AccountFormValues
): Array<{
  account_id: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  remaining_amount: number;
  status: string;
  note: null;
}> {
  const schedules: Array<{
    account_id: string;
    due_date: string;
    amount_due: number;
    amount_paid: number;
    remaining_amount: number;
    status: string;
    note: null;
  }> = [];

  if (values.payment_frequency === "bimonthly") {
    const totalWithInterest =
      values.principal_amount * (1 + values.interest_rate / 100);
    const start = parseDateInput(values.first_payment_date);
    const dueDates = generateLegacyBimonthlyDueDates(start, values.term_months);
    const pay = bimonthlyLegacyInstallmentAmount(
      values.principal_amount,
      values.interest_rate,
      values.term_months
    );

    for (const d of dueDates) {
      schedules.push({
        account_id: accountId,
        due_date: formatLocalISODate(d),
        amount_due: pay,
        amount_paid: 0,
        remaining_amount: pay,
        status: "pending",
        note: null,
      });
    }
  } else {
    let currentDate = parseDateInput(values.first_payment_date);
    const monthlyAnchorDay = currentDate.getDate();
    const totalInterest =
      values.principal_amount * (values.interest_rate / 100) * values.term_months;
    const totalPayment = values.principal_amount + totalInterest;
    const installmentAmount = totalPayment / values.term_months;

    for (let i = 0; i < values.term_months; i++) {
      const amt = Number(installmentAmount.toFixed(2));
      schedules.push({
        account_id: accountId,
        due_date: formatLocalISODate(currentDate),
        amount_due: amt,
        amount_paid: 0,
        remaining_amount: amt,
        status: "pending",
        note: null,
      });

      if (values.payment_frequency === "monthly") {
        currentDate = addOneMonthAnchored(currentDate, monthlyAnchorDay);
      } else if (values.payment_frequency === "weekly") {
        currentDate.setDate(currentDate.getDate() + 7);
      } else {
        currentDate = addOneMonthAnchored(currentDate, monthlyAnchorDay);
      }
    }
  }

  return schedules;
}

const formatNumber = (value: string) => {
  const num = value.replace(/,/g, "");
  if (!num) return "";
  return Number(num).toLocaleString();
};
type AccountFormProps = {
  borrowerId: string;
  /** When set, form updates this account instead of creating one. */
  accountId?: string;
  /** Prefill when editing (merged with borrower_id). */
  initialValues?: Partial<AccountFormValues>;
  onSuccess?: () => void;
};

const emptyDefaults = (borrowerId: string): AccountFormValues => ({
  borrower_id: borrowerId,
  type: "loan",
  principal_amount: 0,
  interest_rate: 0,
  term_months: 1,
  release_date: "",
  first_payment_date: "",
  payment_frequency: "bimonthly",
});

export type AccountEditableRow = {
  type: string;
  principal_amount: number | string | null;
  interest_rate: number | string | null;
  term_months: number | string | null;
  release_date: string | null;
  first_payment_date: string | null;
  payment_frequency: string | null;
};

export function accountRowToFormInitial(
  account: AccountEditableRow
): Partial<AccountFormValues> {
  const frequencies = ["weekly", "monthly", "bimonthly", "custom"] as const;
  const raw = account.payment_frequency ?? "";
  const payment_frequency = frequencies.includes(
    raw as (typeof frequencies)[number]
  )
    ? (raw as AccountFormValues["payment_frequency"])
    : "bimonthly";

  const t = account.type === "cash_advance" ? "cash_advance" : "loan";

  return {
    type: t,
    principal_amount: Number(account.principal_amount ?? 0),
    interest_rate: Number(account.interest_rate ?? 0),
    term_months: Number(account.term_months ?? 1),
    release_date: isoDateOnlyForInput(account.release_date),
    first_payment_date: isoDateOnlyForInput(account.first_payment_date),
    payment_frequency,
  };
}

export default function AccountForm({
  borrowerId,
  accountId,
  initialValues,
  onSuccess,
}: AccountFormProps) {
  const router = useRouter();
  const isEdit = Boolean(accountId);

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
      ...emptyDefaults(borrowerId),
      ...initialValues,
      borrower_id: borrowerId,
    },
  });

  const value = watch("principal_amount");
  const onSubmit = async (values: AccountFormValues) => {
    const schedulesPayload = (id: string) => buildSchedulesPayload(id, values);

    if (isEdit && accountId) {
      const { error: updateError } = await supabase
        .from("accounts")
        .update({
          type: values.type,
          principal_amount: values.principal_amount,
          interest_rate: values.interest_rate,
          term_months: values.term_months,
          release_date: values.release_date,
          first_payment_date: values.first_payment_date,
          payment_frequency: values.payment_frequency,
        })
        .eq("id", accountId);

      if (updateError) {
        toast.error(updateError.message);
        return;
      }

      const { data: delData, error: delError } = await supabase
        .from("payment_schedules")
        .delete()
        .eq("account_id", accountId)
        .select();
      console.log(delError, delData)
      if (delError) {
        toast.error(delError.message);
        return;
      }

      const schedules = schedulesPayload(accountId);
      const { error: insertError } = await supabase
        .from("payment_schedules")
        .insert(schedules);
      if (insertError) {
        toast.error(insertError.message);
        return;
      }
      toast.success("Account and payment schedules updated.");

      router.refresh();
      onSuccess?.();
      return;
    }

    const { data: account, error } = await supabase
      .from("accounts")
      .insert(values)
      .select()
      .single();

    if (error || !account) {
      toast.error(error?.message ?? "Could not create account.");
      return;
    }

    const schedules = schedulesPayload(account.id);

    const { error: scheduleError } = await supabase
      .from("payment_schedules")
      .insert(schedules);

    if (scheduleError) {
      toast.error(scheduleError.message);
      return;
    }

    reset(emptyDefaults(borrowerId));
    toast.success("Account created.");

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
        {isSubmitting
          ? isEdit
            ? "Saving..."
            : "Creating..."
          : isEdit
            ? "Save changes"
            : "Create account"}
      </NeobrutButton>
    </form>
  );
}

