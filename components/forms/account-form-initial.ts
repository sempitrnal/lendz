import type { AccountFormValues } from "@/lib/validations/account";

/**
 * The parts of the account form that other screens need without loading the
 * form itself (react-hook-form, zod and the schedule builders).
 */

export function isoDateOnlyForInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

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
  calculate_skipped_schedules?: boolean | null;
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
    calculate_skipped_schedules: false,
    interest_type: account.interest_type === "rolling" ? "rolling" : "flat",
    status:
      (account.status as AccountFormValues["status"] | undefined) ?? "active",
  } as Partial<AccountFormValues>;
}
