"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  accountSchema,
  type AccountFormValues,
} from "@/lib/validations/account";
import { logAuditAction } from "@/app/actions/audit";
import { revalidateBorrowerDetailPage } from "@/lib/actions/borrowers";
import {
  formFieldErrorClassName,
  formFieldInputClassName,
  formFieldLabelClassName,
} from "@/lib/form-field-classes";
import { supabase } from "@/lib/supabase/client";
import NeobrutButton from "@/components/neobrut-button";
import { buildSchedulesPayload } from "@/lib/payment-schedule/build-payload";

export function isoDateOnlyForInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
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
  schedule_mode: "auto",
  interest_type: "flat",
  status: "active",
});

export type AccountEditableRow = {
  type: string;
  principal_amount: number | string | null;
  interest_rate: number | string | null;
  term_months: number | string | null;
  release_date: string | null;
  first_payment_date: string | null;
  payment_frequency: string | null;
  term_installments: number | string | null;
  schedule_mode: string | null;
  interest_type?: string | null;
  status?: string | null;
};

export function accountRowToFormInitial(
  account: AccountEditableRow,
): Partial<AccountFormValues> {
  const frequencies = ["weekly", "monthly", "bimonthly", "custom"] as const;
  const raw = account.payment_frequency ?? "";
  const payment_frequency = frequencies.includes(
    raw as (typeof frequencies)[number],
  )
    ? (raw as AccountFormValues["payment_frequency"])
    : "bimonthly";

  const t = account.type === "cash_advance" ? "cash_advance" : "loan";

  const scheduleMode = account.schedule_mode === "manual" ? "manual" : "auto";

  return {
    type: t,
    principal_amount: Number(account.principal_amount ?? 0),
    interest_rate: Number(account.interest_rate ?? 0),
    term_months: Number(account.term_months ?? 1),
    release_date: isoDateOnlyForInput(account.release_date),
    first_payment_date: isoDateOnlyForInput(account.first_payment_date),
    payment_frequency,
    schedule_mode: scheduleMode,
    interest_type: account.interest_type === "rolling" ? "rolling" : "flat",
    status:
      (account.status as AccountFormValues["status"] | undefined) ?? "active",
  } as Partial<AccountFormValues>;
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
    resolver: zodResolver(accountSchema) as any,
    defaultValues: {
      ...emptyDefaults(borrowerId),
      ...initialValues,
      borrower_id: borrowerId,
      status: initialValues?.status ?? emptyDefaults(borrowerId).status,
    } as AccountFormValues,
  });

  const value = watch("principal_amount");
  const frequency = watch("payment_frequency");
  const scheduleMode = watch("schedule_mode");
  const interestType = watch("interest_type");
  const status = watch("status");
  const isCustom = frequency === "custom";
  const isManual = scheduleMode === "manual";
  const isRolling = isManual && interestType === "rolling";
  const isPending = status === "pending";
  const onSubmit = async (values: AccountFormValues) => {
    const schedulesPayload = (id: string) => buildSchedulesPayload(id, values);

    if (isEdit && accountId) {
      const isCustomFreq = values.payment_frequency === "custom";
      const { error: updateError } = await supabase
        .from("accounts")
        .update({
          type: values.type,
          principal_amount: values.principal_amount,
          interest_rate: values.interest_rate,
          term_months: values.term_months || null,
          term_installments: isCustomFreq ? values.term_months : null,
          release_date: values.release_date || null,
          first_payment_date: values.first_payment_date || null,
          payment_frequency:
            values.schedule_mode === "manual"
              ? "bisag kanus-a"
              : values.payment_frequency,
          schedule_mode: values.schedule_mode,
          interest_type: values.interest_type ?? "flat",
          status: values.status,
        })
        .eq("id", accountId);

      if (updateError) {
        toast.error(updateError.message);
        return;
      }

      if (values.schedule_mode === "auto") {
        const { data: delData, error: delError } = await supabase
          .from("payment_schedules")
          .delete()
          .eq("account_id", accountId)
          .select();
        console.log(delError, delData);
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
      }
      await logAuditAction(
        "account.updated",
        "account",
        accountId!,
        `Account updated (${values.type}, ₱${values.principal_amount.toLocaleString()})`,
        {
          type: values.type,
          principal: values.principal_amount,
          interest_rate: values.interest_rate,
        },
        accountId,
      );
      toast.success(
        "Account updated." +
          (values.schedule_mode === "manual"
            ? " Schedules not regenerated (manual mode)."
            : ""),
      );

      await revalidateBorrowerDetailPage(values.borrower_id);
      router.refresh();
      onSuccess?.();
      return;
    }

    const isCustomFreq = values.payment_frequency === "custom";
    const { data: account, error } = await supabase
      .from("accounts")
      .insert({
        ...values,
        first_payment_date: values.first_payment_date || null,
        term_months: values.term_months || null,
        term_installments: isCustomFreq ? values.term_months : null,
        release_date: values.release_date || null,
      })
      .select()
      .single();

    if (error || !account) {
      toast.error(error?.message ?? "Could not create account.");
      return;
    }

    if (values.status === "pending" && values.release_date) {
      const { error: evtError } = await supabase
        .from("calendar_events")
        .insert({
          borrower_id: values.borrower_id,
          account_id: account.id,
          event_date: values.release_date,
          title: "Activate account",
          amount: values.principal_amount,
          status: "scheduled",
        });
      if (evtError) {
        toast.error(
          "Account created but calendar event failed: " + evtError.message,
        );
      }
    }

    if (values.status !== "pending" && values.schedule_mode === "auto") {
      const schedules = schedulesPayload(account.id);

      const { error: scheduleError } = await supabase
        .from("payment_schedules")
        .insert(schedules);

      if (scheduleError) {
        toast.error(scheduleError.message);
        return;
      }
    }

    if (
      values.status !== "pending" &&
      values.schedule_mode === "manual" &&
      values.interest_type === "rolling" &&
      values.interest_rate > 0
    ) {
      const principal = values.principal_amount;
      const firstDue =
        Math.round(principal * (1 + values.interest_rate / 100) * 100) / 100;
      const dueDate =
        values.release_date || new Date().toISOString().split("T")[0];
      const { error: scheduleError } = await supabase
        .from("payment_schedules")
        .insert({
          account_id: account.id,
          due_date: dueDate,
          amount_due: firstDue,
          amount_paid: 0,
          remaining_amount: firstDue,
          status: "pending",
        });
      if (scheduleError) {
        toast.error(scheduleError.message);
        return;
      }
    }

    await logAuditAction(
      "account.created",
      "account",
      account.id,
      `Account created (${values.type}, ₱${values.principal_amount.toLocaleString()})`,
      {
        type: values.type,
        principal: values.principal_amount,
        interest_rate: values.interest_rate,
        schedule_mode: values.schedule_mode,
        interest_type: values.interest_type,
        status: values.status,
      },
      account.id,
    );
    reset(emptyDefaults(borrowerId));
    const msg =
      values.status === "pending"
        ? "Pending account created. A calendar event was scheduled for activation."
        : "Account created." +
          (values.schedule_mode === "manual"
            ? values.interest_type === "rolling"
              ? " First rolling schedule generated."
              : " Add schedules manually."
            : "");
    toast.success(msg);

    await revalidateBorrowerDetailPage(values.borrower_id);
    router.refresh();
    if (!isEdit) {
      router.push(`/borrowers/${values.borrower_id}`);
    }
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
        <label className={formFieldLabelClassName} htmlFor="schedule_mode">
          Schedule mode
        </label>
        <select
          id="schedule_mode"
          {...register("schedule_mode")}
          className={formFieldInputClassName}
        >
          <option value="auto">auto (generate schedules)</option>
          <option value="manual">
            manual (I&apos;ll add schedules myself)
          </option>
        </select>
      </div>

      {!isEdit && (
        <div>
          <label className={formFieldLabelClassName}>Account status</label>
          <div className="flex gap-3">
            <label
              className={`dark flex cursor-pointer items-center gap-2 rounded-lg border-2 border-slate-900 px-3 py-2 text-sm font-bold transition dark:text-slate-800 ${
                !isPending
                  ? "bg-emerald-300 shadow-[2px_2px_0px_0px_#0f172a] dark:bg-emerald-400"
                  : "bg-white hover:bg-slate-50 dark:bg-slate-800 dark:text-white"
              }`}
            >
              <input
                type="radio"
                value="active"
                {...register("status")}
                className="sr-only"
              />
              <span>active</span>
            </label>
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 border-slate-900 px-3 py-2 text-sm font-bold transition dark:text-slate-800 ${
                isPending
                  ? "bg-amber-300 shadow-[2px_2px_0px_0px_#0f172a]"
                  : "bg-white hover:bg-slate-50 dark:bg-slate-800 dark:text-white"
              }`}
            >
              <input
                type="radio"
                value="pending"
                {...register("status")}
                className="sr-only"
              />
              <span>pending</span>
            </label>
          </div>
          {isPending && (
            <p className="mt-1 text-[10px] text-slate-500">
              Payment schedules will be created when this account is activated.
              A calendar event will be added using the release date.
            </p>
          )}
        </div>
      )}

      {isManual && (
        <div>
          <label className={formFieldLabelClassName}>Interest type</label>
          <div className="flex gap-3">
            {(["flat", "rolling"] as const).map((type) => (
              <label
                key={type}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 border-slate-900 px-3 py-2 text-sm font-bold transition dark:text-slate-800 ${
                  interestType === type
                    ? "bg-violet-300 shadow-[2px_2px_0px_0px_#0f172a]"
                    : "bg-white hover:bg-slate-50 dark:bg-slate-800 dark:text-white"
                }`}
              >
                <input
                  type="radio"
                  value={type}
                  {...register("interest_type")}
                  className="sr-only"
                />
                <span className="capitalize">{type}</span>
                <span className="text-[10px] font-normal text-slate-500">
                  {type === "flat" ? "fixed total" : "applies each cycle"}
                </span>
              </label>
            ))}
          </div>
          {isRolling && (
            <p className="mt-1 text-[10px] text-slate-500">
              First schedule auto-created on save. Each partial payment
              generates the next cycle with interest on remaining balance.
            </p>
          )}
        </div>
      )}

      <div>
        <label className={formFieldLabelClassName} htmlFor="principal_amount">
          Principal amount
        </label>
        <input
          id="principal_amount"
          type="text"
          inputMode="decimal"
          {...register("principal_amount", {
            setValueAs: (v) => Number(String(v).replace(/,/g, "")),
          })}
          value={value ? Number(value).toLocaleString() : ""}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label className={formFieldLabelClassName} htmlFor="release_date">
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

        {!isManual && !isPending && (
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
        )}
      </div>

      {!isManual && !isPending && (
        <>
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
              <option value="bimonthly">bimonthly</option>
              <option value="monthly">monthly</option>
              <option value="custom">custom</option>
            </select>
            {errors.payment_frequency?.message ? (
              <p className={formFieldErrorClassName}>
                {errors.payment_frequency.message}
              </p>
            ) : null}
          </div>

          <div>
            <label className={formFieldLabelClassName} htmlFor="term_months">
              {isCustom ? "Term installments (gives)" : "Term (months)"}
            </label>
            <input
              id="term_months"
              type="number"
              inputMode={isCustom ? "numeric" : "decimal"}
              step={isCustom ? 1 : 0.5}
              min={isCustom ? 1 : 0.5}
              {...register("term_months", { valueAsNumber: true })}
              className={formFieldInputClassName}
            />
            {errors.term_months?.message ? (
              <p className={formFieldErrorClassName}>
                {errors.term_months.message}
              </p>
            ) : null}
          </div>
        </>
      )}

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
