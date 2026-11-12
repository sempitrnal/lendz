"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { triggerHaptic } from "@/lib/haptics";
import { formatDate, formatMoney } from "@/lib/utils";

import {
  accountSchema,
  type AccountFormValues,
} from "@/lib/validations/account";
import { logAuditAction } from "@/app/actions/audit";
import { revalidateBorrowerDetailPage } from "@/lib/actions/borrowers";
import { supabase } from "@/lib/supabase/client";
import { wasQueuedOffline } from "@/lib/checklist/offline-cache";
import { addPendingAccount } from "@/lib/offline/pending-accounts";
import { Button } from "@/components/ui/button";
import { AnimatePresence, m, MotionConfig } from "motion/react";
import {
  Banknote,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  History,
  Hourglass,
  Landmark,
  Pencil,
  Percent,
  Plus,
  Repeat,
  SlidersHorizontal,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { SheetFooter } from "@/components/dashboard/checklist-v2/sheet";
import {
  accountInputClass,
  Chip,
  ChipRow,
  Field,
  FieldError,
  HeroAmount,
  INPUT_FOCUS,
  Reveal,
  Rise,
  Roll,
  Segmented,
  Stagger,
  StepperInput,
  SwitchRow,
  type Tone,
} from "@/components/forms/account-form-parts";
import {
  buildSchedulesPayload,
  countSkippedSchedules,
} from "@/lib/payment-schedule/build-payload";
import { deriveBimonthlyAnchors } from "@/lib/payment-schedule/bimonthly-legacy";
import {
  planReschedule,
  summarizeCarry,
  type ExistingSchedule,
  type RescheduleMode,
} from "@/lib/payment-schedule/reschedule";
import { snapshotAccount } from "@/lib/accounts/revisions";
import {
  isConnectionGood,
  useConnectionQuality,
} from "@/lib/offline/connection";

export {
  isoDateOnlyForInput,
  accountRowToFormInitial,
  type AccountEditableRow,
} from "@/components/forms/account-form-initial";

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

type AccountFormProps = {
  borrowerId: string;
  /** When set, form updates this account instead of creating one. */
  accountId?: string;
  /** Prefill when editing (merged with borrower_id). */
  initialValues?: Partial<AccountFormValues>;
  onSuccess?: () => void;
  /** After creating, navigate to the borrower page. When false, a detailed toast is shown instead. */
  redirectOnCreate?: boolean;
  /** Shown in the header, and in the creation toast when `redirectOnCreate` is false. */
  borrowerName?: string;
  /** False when the sheet around the form has its own heading. */
  showHeader?: boolean;
};

/** The longest term the live preview builds a schedule for. */
const PREVIEW_MAX_TERM = 120;

const hintClass = "mt-1.5 px-1 text-xs font-medium text-muted-foreground";

/** Today's date where the lending happens, as yyyy-mm-dd. */
const manilaToday = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

/** Interest rate (%) a new account starts with. */
const DEFAULT_INTEREST_RATE = 3.8;

const emptyDefaults = (borrowerId: string): AccountFormValues => ({
  borrower_id: borrowerId,
  type: "loan",
  principal_amount: 0,
  interest_rate: DEFAULT_INTEREST_RATE,
  term_months: 0,
  release_date: "",
  first_payment_date: "",
  payment_frequency: "bimonthly",
  schedule_mode: "auto",
  interest_type: "flat",
  status: "active",
  calculate_skipped_schedules: false,
});

export default function AccountForm({
  borrowerId,
  accountId,
  initialValues,
  onSuccess,
  redirectOnCreate = true,
  borrowerName,
  showHeader = true,
}: AccountFormProps) {
  const router = useRouter();
  const isEdit = Boolean(accountId);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    watch,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema) as Resolver<AccountFormValues>,
    defaultValues: {
      ...emptyDefaults(borrowerId),
      ...initialValues,
      borrower_id: borrowerId,
      status: initialValues?.status ?? emptyDefaults(borrowerId).status,
    } as AccountFormValues,
  });

  const value = watch("principal_amount");
  const interestRateValue = watch("interest_rate");
  const termMonthsValue = watch("term_months");

  const [principalText, setPrincipalText] = useState(
    initialValues?.principal_amount
      ? Number(initialValues.principal_amount).toLocaleString("en-US")
      : "",
  );
  const [interestRateText, setInterestRateText] = useState(
    String(initialValues?.interest_rate ?? DEFAULT_INTEREST_RATE),
  );
  const [termMonthsText, setTermMonthsText] = useState(
    initialValues?.term_months !== undefined
      ? String(initialValues.term_months)
      : "",
  );
  const frequency = watch("payment_frequency");
  const scheduleMode = watch("schedule_mode");
  const interestType = watch("interest_type");
  const status = watch("status");
  const typeValue = watch("type");
  const calculateSkipped = watch("calculate_skipped_schedules");
  const releaseDateValue = watch("release_date");
  const firstPaymentDateValue = watch("first_payment_date");
  const isCustom = frequency === "custom";
  const isManual = scheduleMode === "manual";
  const isRolling = isManual && interestType === "rolling";
  const isPending = status === "pending";

  const formRef = useRef<HTMLFormElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const quality = useConnectionQuality();
  // Schedule mode and status: tucked away unless they are not the usual ones.
  const [optionsOpen, setOptionsOpen] = useState(
    () =>
      initialValues?.schedule_mode === "manual" ||
      (!accountId && initialValues?.status === "pending"),
  );

  useEffect(() => {
    // Only when there is a date to clear: setting the value re-renders the
    // whole form, and the form starts out empty.
    if (!releaseDateValue && getValues("first_payment_date")) {
      setValue("first_payment_date", "");
    }
  }, [releaseDateValue, setValue, getValues]);

  // Editing: what the existing schedules already have paid, so the form can
  // offer to keep those payments when the dates change.
  const [rescheduleMode, setRescheduleMode] = useState<RescheduleMode>("carry");
  const [carried, setCarried] = useState<{
    paid: number;
    partial: number;
  } | null>(null);
  useEffect(() => {
    if (!isEdit || !accountId) return;
    let cancelled = false;
    supabase
      .from("payment_schedules")
      .select("id, due_date, amount_due, amount_paid, status")
      .eq("account_id", accountId)
      .then(({ data }: { data: ExistingSchedule[] | null }) => {
        if (!cancelled && data) {
          setCarried(summarizeCarry(data as ExistingSchedule[]));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, accountId]);

  // Opening Options, or a choice in it that adds or removes fields, moves the
  // section; follow it while it settles so it stays on screen.
  // Only when one of them really changed: not on open, and not on the second
  // run of the effect that development mode adds.
  const optionsKey = `${optionsOpen}|${scheduleMode}|${interestType}|${status}`;
  const lastOptionsKey = useRef(optionsKey);
  useEffect(() => {
    if (lastOptionsKey.current === optionsKey) return;
    lastOptionsKey.current = optionsKey;
    const started = performance.now();
    let frame = requestAnimationFrame(function follow(now) {
      optionsRef.current?.scrollIntoView({ block: "nearest" });
      if (now - started < 900) frame = requestAnimationFrame(follow);
    });
    // Once more when everything has settled.
    const settled = setTimeout(
      () => optionsRef.current?.scrollIntoView({ block: "nearest" }),
      1000,
    );
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settled);
    };
  }, [optionsKey]);

  const onSubmit = async (values: AccountFormValues) => {
    const schedulesPayload = (id: string) => buildSchedulesPayload(id, values);

    if (isEdit && accountId) {
      const isCustomFreq = values.payment_frequency === "custom";
      const regenerate = values.schedule_mode === "auto";

      // Rewriting schedules needs the current rows and a backup first, so it
      // can't be queued offline.
      if (regenerate && !isConnectionGood()) {
        triggerHaptic("error");
        toast.error(
          "Editing schedules needs a good connection — try again online.",
        );
        return;
      }

      // Back up the account, its schedules and payments so this edit can be
      // reverted. Required when schedules change; best effort otherwise.
      let existing: ExistingSchedule[] = [];
      try {
        const state = await snapshotAccount(accountId, "account.updated");
        existing = state.schedules as unknown as ExistingSchedule[];
      } catch (err) {
        if (regenerate) {
          triggerHaptic("error");
          toast.error(err instanceof Error ? err.message : "Backup failed.");
          return;
        }
      }

      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Manila",
      });
      const plan = regenerate
        ? planReschedule(
            existing,
            schedulesPayload(accountId),
            rescheduleMode,
            today,
          )
        : null;
      if (plan && plan.blocked.length > 0) {
        triggerHaptic("error");
        toast.error(
          `The new terms have ${plan.blocked.length} fewer installment${
            plan.blocked.length === 1 ? "" : "s"
          } than the payments already made. Lengthen the term, or choose "Start over".`,
        );
        return;
      }

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
        triggerHaptic("error");
        toast.error(updateError.message);
        return;
      }

      if (plan) {
        // Existing rows move in place (ids, payments and checklist links
        // stay); extra installments are added; unpaid leftovers removed.
        const steps: Array<
          () => PromiseLike<{ error: { message: string } | null }>
        > = [];
        if (plan.updates.length) {
          steps.push(() =>
            supabase.from("payment_schedules").upsert(
              plan.updates.map((u) => ({ ...u, account_id: accountId })),
              { onConflict: "id" },
            ),
          );
        }
        if (plan.deletes.length) {
          steps.push(() =>
            supabase.from("payment_schedules").delete().in("id", plan.deletes),
          );
        }
        if (plan.inserts.length) {
          steps.push(() =>
            supabase.from("payment_schedules").insert(plan.inserts),
          );
        }
        for (const step of steps) {
          const { error } = await step();
          if (error) {
            triggerHaptic("error");
            toast.error(
              `${error.message} — use "Revert last update" on the account to undo.`,
            );
            return;
          }
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
      triggerHaptic("success");
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
    // The id is made here, not by the database, so the schedules and the
    // calendar event can point at the account even when the insert is only
    // queued (slow or no connection) and nothing comes back.
    const accountPayload = {
      id: crypto.randomUUID(),
      ...values,
      first_payment_date: values.first_payment_date || null,
      term_months: values.term_months || null,
      term_installments: isCustomFreq ? values.term_months : null,
      release_date: values.release_date || null,
    };
    const { data: inserted, error } = await supabase
      .from("accounts")
      .insert(accountPayload)
      .select()
      .single();

    // Queued requests replay in order once the connection is good, so the
    // account goes first and what depends on it follows.
    let queued = wasQueuedOffline(error);
    const account = queued ? accountPayload : inserted;
    // Server actions (audit log, revalidation) can't run offline either; they
    // were queued too, so a failure there only matters when we're online.
    const settle = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (err) {
        if (!queued) throw err;
      }
    };

    if ((error && !queued) || !account) {
      triggerHaptic("error");
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
      if (wasQueuedOffline(evtError)) queued = true;
      else if (evtError) {
        triggerHaptic("warning");
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

      if (wasQueuedOffline(scheduleError)) queued = true;
      else if (scheduleError) {
        triggerHaptic("error");
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
      if (wasQueuedOffline(scheduleError)) queued = true;
      else if (scheduleError) {
        triggerHaptic("error");
        toast.error(scheduleError.message);
        return;
      }
    }

    await settle(() =>
      logAuditAction(
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
      ),
    );
    reset(emptyDefaults(borrowerId));
    if (queued) {
      // Show it on the borrower page now; it's replaced by the real row once
      // the queued requests have gone through.
      addPendingAccount(values.borrower_id, accountPayload);
      triggerHaptic("success");
      toast.info(
        "Saved offline — the account will be created when your connection is back.",
      );
      // No router.refresh() here: offline it can turn into a full page reload
      // that wipes out whatever happens next (like ticking the checklist item).
      if (redirectOnCreate) router.push(`/borrowers/${values.borrower_id}`);
      onSuccess?.();
      return;
    }
    const msg =
      values.status === "pending"
        ? "Pending account created. A calendar event was scheduled for activation."
        : "Account created." +
          (values.schedule_mode === "manual"
            ? values.interest_type === "rolling"
              ? " First rolling schedule generated."
              : " Add schedules manually."
            : "");
    triggerHaptic("success");
    if (isEdit || redirectOnCreate) {
      toast.success(msg);
    } else {
      toast.success("Account created", {
        position: "top-center",
        className:
          "!border-green-200 !bg-green-50 !text-green-900 dark:!border-green-900 dark:!bg-green-950 dark:!text-green-100",
        classNames: {
          description: "!text-green-800 dark:!text-green-200",
        },
        description: (
          <div className="mt-1 flex flex-col gap-1 text-sm">
            {borrowerName ? (
              <div className="flex items-center gap-2">
                <span className="text-green-700 dark:text-green-300">
                  Borrower
                </span>
                <span className="font-semibold">{borrowerName}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <span className="text-green-700 dark:text-green-300">
                Principal
              </span>
              <span className="font-semibold">
                {formatMoney(values.principal_amount)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-700 dark:text-green-300">Type</span>
              <span
                className="rounded-full bg-green-200 px-2 py-0.5 text-xs
                  font-medium text-green-900 dark:bg-green-900
                  dark:text-green-100"
              >
                {values.type === "cash_advance" ? "Cash advance" : "Loan"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-700 dark:text-green-300">
                Release date
              </span>
              <span className="font-semibold">
                {formatDate(values.release_date)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-700 dark:text-green-300">
                First payment
              </span>
              <span className="font-semibold">
                {formatDate(values.first_payment_date)}
              </span>
            </div>
          </div>
        ),
      });
    }

    await settle(() => revalidateBorrowerDetailPage(values.borrower_id));
    router.refresh();
    if (!isEdit && redirectOnCreate) {
      router.push(`/borrowers/${values.borrower_id}`);
    }
    onSuccess?.();
  };

  /** Sets a value; once a save was tried, also re-checks it so errors clear. */
  const set = <K extends keyof AccountFormValues>(
    name: K,
    next: AccountFormValues[K],
  ) =>
    setValue(name, next as never, {
      shouldDirty: true,
      shouldValidate: isSubmitted,
    });

  const onInvalid = () => {
    triggerHaptic("error");
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector("[data-field-error]")
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  const onRateText = (raw: string) => {
    const v = raw.replace(",", ".");
    setInterestRateText(v);
    if (v === "" || v === ".") return set("interest_rate", 0);
    const num = Number(v);
    if (!isNaN(num)) set("interest_rate", num);
  };
  const setRate = (rate: number) => {
    set("interest_rate", rate);
    setInterestRateText(String(rate));
  };

  const onTermText = (raw: string) => {
    const v = raw.replace(",", ".");
    setTermMonthsText(v);
    if (v === "" || v === ".") return set("term_months", 0);
    const num = Number(v);
    if (!isNaN(num)) set("term_months", num);
  };
  const setTerm = (term: number) => {
    set("term_months", term);
    setTermMonthsText(String(term));
  };

  const firstPaymentChips = useMemo(() => {
    if (!releaseDateValue) return [];
    const base = new Date(releaseDateValue);
    const baseYear = base.getFullYear();
    const baseMonth = base.getMonth();
    const baseDay = base.getDate();
    return [4, 5, 7, 8, 10, 15]
      .map((day) => {
        let target: Date;
        if (day > baseDay) {
          target = new Date(baseYear, baseMonth, day);
        } else {
          const nextMonth = baseMonth + 1;
          const nextYear = baseYear + (nextMonth > 11 ? 1 : 0);
          target = new Date(nextYear, nextMonth % 12, day);
        }
        const y = target.getFullYear();
        const m = String(target.getMonth() + 1).padStart(2, "0");
        const d = String(target.getDate()).padStart(2, "0");
        return {
          value: `${y}-${m}-${d}`,
          label: target.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          ts: target.getTime(),
        };
      })
      .sort((a, b) => a.ts - b.ts);
  }, [releaseDateValue]);

  // What saving would create, from the same builder that saves it.
  const preview = useMemo(() => {
    if (isManual || isPending) return null;
    const principal = Number(value) || 0;
    const term = Number(termMonthsValue) || 0;
    const rate = Number(interestRateValue) || 0;
    if (principal <= 0 || !firstPaymentDateValue) return null;
    if (term <= 0 || term > PREVIEW_MAX_TERM) return null;
    if (isCustom ? !Number.isInteger(term) : term % 0.5 !== 0) return null;
    try {
      const rows = buildSchedulesPayload("preview", {
        principal_amount: principal,
        interest_rate: rate,
        term_months: term,
        first_payment_date: firstPaymentDateValue,
        payment_frequency: frequency,
        release_date: releaseDateValue || undefined,
        calculate_skipped_schedules: calculateSkipped,
      });
      if (rows.length === 0) return null;
      const total =
        Math.round(rows.reduce((sum, r) => sum + r.amount_due, 0) * 100) / 100;
      return {
        count: rows.length,
        each: rows[0].amount_due,
        first: rows[0].due_date,
        last: rows[rows.length - 1].due_date,
        total,
        interest: Math.round((total - principal) * 100) / 100,
        // What each payment earns: its share of the interest.
        profitEach: Math.round(((total - principal) / rows.length) * 100) / 100,
        skipped: releaseDateValue
          ? countSkippedSchedules(
              releaseDateValue,
              firstPaymentDateValue,
              frequency,
            )
          : 0,
      };
    } catch {
      return null;
    }
  }, [
    isManual,
    isPending,
    isCustom,
    value,
    termMonthsValue,
    interestRateValue,
    firstPaymentDateValue,
    releaseDateValue,
    frequency,
    calculateSkipped,
  ]);

  const rollingFirstDue =
    isRolling && !isPending && Number(value) > 0 && interestRateValue > 0
      ? Math.round(Number(value) * (1 + interestRateValue / 100) * 100) / 100
      : null;

  const showsSchedule = !isManual && !isPending;
  const typeTone: Tone = typeValue === "cash_advance" ? "amber" : "emerald";
  const optionsSummary = [
    isManual ? `Manual schedule, ${interestType ?? "flat"}` : "Auto schedule",
    ...(isEdit ? [] : [isPending ? "Pending" : "Active"]),
  ].join(" · ");
  const hasCarried =
    isEdit &&
    !isManual &&
    carried !== null &&
    carried.paid + carried.partial > 0;

  return (
    <MotionConfig reducedMotion="user">
      <form
        ref={formRef}
        onSubmit={handleSubmit(onSubmit, onInvalid)}
        noValidate
        data-account-form=""
        className="lowercase [&_button]:lowercase"
      >
        <input type="hidden" {...register("borrower_id")} />

        {showHeader && (
          <div className="flex items-center gap-3 px-5 pt-2 pb-4">
            <m.span
              aria-hidden="true"
              initial={{ scale: 0.6, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
              className={`flex size-14 shrink-0 items-center justify-center
              rounded-full shadow-sm transition-colors duration-300 ${
                typeTone === "amber"
                  ? `border border-amber-500 bg-amber-50 text-amber-700
                    dark:bg-amber-900/30 dark:text-amber-300`
                  : `border border-emerald-500 bg-emerald-50 text-emerald-700
                    dark:bg-emerald-900/30 dark:text-emerald-300`
              }`}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <m.span
                  key={isEdit ? "edit" : typeValue}
                  initial={{ y: 10, opacity: 0, scale: 0.7 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -10, opacity: 0, scale: 0.7 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  {isEdit ? (
                    <Pencil className="size-6" strokeWidth={2.5} />
                  ) : typeValue === "cash_advance" ? (
                    <Banknote className="size-6" strokeWidth={2.5} />
                  ) : (
                    <Landmark className="size-6" strokeWidth={2.5} />
                  )}
                </m.span>
              </AnimatePresence>
            </m.span>
            <div className="min-w-0">
              <h2 className="text-xl font-black tracking-tight">
                {isEdit ? "Edit account" : "New account"}
              </h2>
              <p className="truncate text-sm font-semibold
                text-muted-foreground">
                {borrowerName ? (
                  <>
                    for <span className="lowercase">{borrowerName}</span>
                  </>
                ) : isEdit ? (
                  "Update the terms and schedule"
                ) : (
                  "Loan or cash advance"
                )}
              </p>
            </div>
          </div>
        )}

        <Stagger className="px-5 pb-5">
          <Rise>
            <HeroAmount
              id="principal_amount"
              tone={typeTone}
              value={principalText}
              invalid={!!errors.principal_amount}
              onChange={(text) => {
                setPrincipalText(text);
                const num = Number(text.replace(/,/g, ""));
                set("principal_amount", text === "" || isNaN(num) ? 0 : num);
              }}
            />
            <ChipRow>
              {[5000, 10000, 15000, 20000, 30000, 40000, 50000].map((amt) => (
                <Chip
                  key={amt}
                  tone={typeTone}
                  selected={Number(value) === amt}
                  onClick={() => {
                    set("principal_amount", amt);
                    setPrincipalText(amt.toLocaleString("en-US"));
                  }}
                >
                  {amt / 1000}k
                </Chip>
              ))}
            </ChipRow>
            <FieldError message={errors.principal_amount?.message} />
          </Rise>

          <Rise>
            <div className="pt-5">
              <Segmented
                label="Account type"
                tone={typeTone}
                value={typeValue}
                onChange={(v) => set("type", v)}
                options={[
                  { value: "loan", label: "Loan", tone: "emerald" },
                  {
                    value: "cash_advance",
                    label: "Cash advance",
                    tone: "amber",
                  },
                ]}
              />
              <FieldError message={errors.type?.message} />
            </div>
          </Rise>

          <Rise>
            <div className="pt-5">
              <Field
                id="interest_rate"
                label="Interest rate"
                icon={Percent}
                tone="emerald"
                error={errors.interest_rate?.message}
              >
                <StepperInput
                  id="interest_rate"
                  label="interest rate"
                  tone="emerald"
                  suffix="%"
                  value={interestRateText}
                  invalid={!!errors.interest_rate}
                  onChange={onRateText}
                  onBlur={() => {
                    const num = Number(interestRateText.replace(",", "."));
                    if (!isNaN(num)) setRate(num);
                    else {
                      setInterestRateText("");
                      set("interest_rate", 0);
                    }
                  }}
                  onStep={(dir) => {
                    const now = Number(interestRateValue) || 0;
                    const next = Math.round((now + dir * 0.1) * 100) / 100;
                    setRate(Math.min(100, Math.max(0, next)));
                  }}
                />
                <ChipRow>
                  {[3.3, 3.8, 4, 5].map((rate) => (
                    <Chip
                      key={rate}
                      tone="emerald"
                      selected={interestRateValue === rate}
                      onClick={() => setRate(rate)}
                    >
                      {rate}%
                    </Chip>
                  ))}
                </ChipRow>
              </Field>
            </div>
          </Rise>

          <Rise>
            <Reveal show={showsSchedule}>
              <div className="pt-5">
                <Field
                  label="Pays"
                  icon={Repeat}
                  tone="emerald"
                  error={errors.payment_frequency?.message}
                  aside={
                    frequency === "bimonthly" && firstPaymentDateValue
                      ? (() => {
                          const day = new Date(firstPaymentDateValue).getDate();
                          const [a1, a2] = deriveBimonthlyAnchors(day);
                          return `${ordinalSuffix(a1)} & ${ordinalSuffix(a2)}`;
                        })()
                      : undefined
                  }
                >
                  <Segmented
                    label="Payment frequency"
                    tone="emerald"
                    value={frequency}
                    onChange={(v) => set("payment_frequency", v)}
                    options={[
                      { value: "weekly", label: "Weekly" },
                      { value: "bimonthly", label: "Bimonthly" },
                      { value: "monthly", label: "Monthly" },
                      { value: "custom", label: "Custom" },
                    ]}
                  />
                </Field>
              </div>

              <div className="pt-5">
                <Field
                  id="term_months"
                  label={isCustom ? "Installments (gives)" : "Term"}
                  icon={Hourglass}
                  tone="emerald"
                  error={errors.term_months?.message}
                >
                  <StepperInput
                    id="term_months"
                    label={isCustom ? "installments" : "term"}
                    tone="emerald"
                    suffix={
                      isCustom
                        ? Number(termMonthsValue) === 1
                          ? "give"
                          : "gives"
                        : Number(termMonthsValue) === 1
                          ? "month"
                          : "months"
                    }
                    inputMode={isCustom ? "numeric" : "decimal"}
                    value={termMonthsText}
                    invalid={!!errors.term_months}
                    onChange={onTermText}
                    onBlur={() => {
                      const num = Number(termMonthsText.replace(",", "."));
                      if (!isNaN(num)) setTerm(num);
                      else {
                        setTermMonthsText("");
                        set("term_months", 0);
                      }
                    }}
                    onStep={(dir) => {
                      const now = Number(termMonthsValue) || 0;
                      const size = isCustom ? 1 : 0.5;
                      const next = Math.round((now + dir * size) / size) * size;
                      setTerm(Math.max(0, next));
                    }}
                  />
                  <ChipRow>
                    {[1, 2, 3, 5, 6, 10, 12].map((months) => (
                      <Chip
                        key={months}
                        tone="emerald"
                        selected={Number(termMonthsValue) === months}
                        onClick={() => setTerm(months)}
                      >
                        {months}
                      </Chip>
                    ))}
                  </ChipRow>
                </Field>
              </div>
            </Reveal>
          </Rise>

          <Rise>
            <div className="pt-5">
              <Field
                id="release_date"
                label="Release date"
                icon={CalendarDays}
                tone="emerald"
                error={errors.release_date?.message}
              >
                <div className="flex items-center gap-2">
                  <input
                    id="release_date"
                    type="date"
                    aria-invalid={!!errors.release_date}
                    {...register("release_date")}
                    className={`${accountInputClass} ${INPUT_FOCUS.emerald}`}
                  />
                  <Chip
                    tone="emerald"
                    className="h-12 rounded-2xl px-4"
                    selected={releaseDateValue === manilaToday()}
                    onClick={() => set("release_date", manilaToday())}
                  >
                    Today
                  </Chip>
                </div>
              </Field>
            </div>
          </Rise>

          <Rise>
            <Reveal
              show={showsSchedule && Boolean(releaseDateValue)}
              className="pt-5"
            >
              <Field
                id="first_payment_date"
                label="First payment"
                icon={CalendarCheck}
                tone="emerald"
                error={errors.first_payment_date?.message}
              >
                <input
                  id="first_payment_date"
                  type="date"
                  min={releaseDateValue}
                  aria-invalid={!!errors.first_payment_date}
                  {...register("first_payment_date")}
                  className={`${accountInputClass} ${INPUT_FOCUS.emerald}`}
                />
                <ChipRow>
                  {firstPaymentChips.map((chip) => (
                    <Chip
                      key={chip.value}
                      tone="emerald"
                      selected={firstPaymentDateValue === chip.value}
                      onClick={() => set("first_payment_date", chip.value)}
                    >
                      {chip.label}
                    </Chip>
                  ))}
                </ChipRow>
              </Field>
            </Reveal>
          </Rise>

          <Rise>
            <Reveal show={showsSchedule && preview !== null} className="pt-5">
              {preview && (
                <div
                  className="relative overflow-hidden rounded-3xl
                    bg-linear-to-br from-emerald-500 to-emerald-700 p-4
                    text-white"
                >
                  <Sparkles
                    aria-hidden="true"
                    className="absolute -top-2 -right-2 size-20 text-white/10"
                  />
                  <p className="text-xs font-bold text-white/80">
                    Schedule preview
                  </p>
                  <p className="mt-1 text-lg font-black tracking-tight">
                    <Roll value={String(preview.count)} /> payment
                    {preview.count === 1 ? "" : "s"} of{" "}
                    <span className="tabular-nums">
                      <Roll value={formatMoney(preview.each)} />
                    </span>
                  </p>
                  <p className="text-sm font-semibold text-white/80">
                    {formatDate(preview.first)}
                    {preview.count > 1 && <> → {formatDate(preview.last)}</>}
                  </p>
                  <p
                    className="mt-1 text-sm font-bold text-yellow-200
                      tabular-nums"
                  >
                    <Roll value={`+${formatMoney(preview.profitEach)}`} />{" "}
                    profit per payment
                  </p>
                  <dl
                    className="mt-3 grid grid-cols-2 gap-2 border-t
                      border-white/20 pt-3 text-sm"
                  >
                    <div>
                      <dt className="text-xs font-semibold text-white/75">
                        Total to collect
                      </dt>
                      <dd className="font-black tabular-nums">
                        <Roll value={formatMoney(preview.total)} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold text-white/75">
                        Interest
                      </dt>
                      <dd className="font-black tabular-nums text-yellow-200">
                        <Roll value={`+${formatMoney(preview.interest)}`} />
                      </dd>
                    </div>
                  </dl>
                  <Reveal show={preview.skipped > 0}>
                    <div className="mt-3 border-t border-white/20 pt-3">
                      <SwitchRow
                        checked={calculateSkipped}
                        onChange={(on) =>
                          set("calculate_skipped_schedules", on)
                        }
                      >
                        Add interest for {preview.skipped} skipped period
                        {preview.skipped === 1 ? "" : "s"}
                        <span
                          className="block text-xs font-medium text-white/75"
                        >
                          Between the release and the first payment.
                        </span>
                      </SwitchRow>
                    </div>
                  </Reveal>
                </div>
              )}
            </Reveal>
            <Reveal show={showsSchedule && preview === null} className="pt-5">
              <p
                className="rounded-3xl border border-dashed
                  border-emerald-500/40 bg-emerald-500/5 p-4 text-center text-sm
                  font-medium text-muted-foreground"
              >
                Add the amount, term and first payment to preview the schedule.
              </p>
            </Reveal>

            <Reveal show={rollingFirstDue !== null} className="pt-5">
              <div
                className="rounded-3xl bg-linear-to-br from-emerald-500
                  to-emerald-700 p-4 text-white"
              >
                <p className="text-xs font-bold text-white/80">
                  First schedule
                </p>
                <p
                  className="mt-1 text-lg font-black tracking-tight
                    tabular-nums"
                >
                  <Roll value={formatMoney(rollingFirstDue ?? 0)} />
                </p>
                <p className="text-sm font-semibold text-white/80">
                  {releaseDateValue
                    ? `Due ${formatDate(releaseDateValue)}`
                    : "Due on the release date"}
                </p>
              </div>
            </Reveal>
          </Rise>

          <Rise>
            <div
              ref={optionsRef}
              className="mt-5 scroll-mt-4 scroll-mb-24 rounded-3xl bg-muted/40"
            >
              <button
                type="button"
                aria-expanded={optionsOpen}
                onClick={() => setOptionsOpen((open) => !open)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center
                    rounded-xl bg-emerald-100 text-emerald-700
                    dark:bg-emerald-500/20 dark:text-emerald-300"
                >
                  <SlidersHorizontal className="size-4" strokeWidth={2.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">Options</span>
                  <span
                    className="block truncate text-xs font-semibold
                      text-muted-foreground"
                  >
                    {optionsSummary}
                  </span>
                </span>
                <m.span
                  animate={{ rotate: optionsOpen ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                >
                  <ChevronDown className="size-5 shrink-0 text-muted-foreground" />
                </m.span>
              </button>
              <Reveal show={optionsOpen}>
                <div className="space-y-4 px-4 pb-4">
                  <Field label="Schedule">
                    <Segmented
                      label="Schedule mode"
                      tone="emerald"
                      value={scheduleMode}
                      onChange={(v) => set("schedule_mode", v)}
                      options={[
                        { value: "auto", label: "Auto", tone: "emerald" },
                        { value: "manual", label: "Manual", tone: "emerald" },
                      ]}
                    />
                    <p className={hintClass}>
                      {isManual
                        ? "You add the schedules yourself."
                        : "Schedules are generated from the terms."}
                    </p>
                  </Field>

                  <Reveal show={isManual}>
                    <Field label="Interest type">
                      <Segmented
                        label="Interest type"
                        tone="emerald"
                        value={interestType ?? "flat"}
                        onChange={(v) => set("interest_type", v)}
                        options={[
                          { value: "flat", label: "Flat" },
                          { value: "rolling", label: "Rolling" },
                        ]}
                      />
                      <p className={hintClass}>
                        {isRolling
                          ? "First schedule auto-created on save. Each partial payment generates the next cycle with interest on remaining balance."
                          : "A fixed total."}
                      </p>
                    </Field>
                  </Reveal>

                  {!isEdit && (
                    <Field label="Status">
                      <Segmented
                        label="Account status"
                        tone="emerald"
                        value={status}
                        onChange={(v) => set("status", v)}
                        options={[
                          {
                            value: "active",
                            label: "Active",
                            tone: "emerald",
                          },
                          {
                            value: "pending",
                            label: "Pending",
                            tone: "amber",
                          },
                        ]}
                      />
                      <Reveal show={isPending}>
                        <p className={hintClass}>
                          Payment schedules will be created when this account is
                          activated. A calendar event will be added using the
                          release date.
                        </p>
                      </Reveal>
                    </Field>
                  )}
                </div>
              </Reveal>
            </div>
          </Rise>

          <Reveal show={hasCarried} className="pt-5">
            {carried && (
              <Field label="Existing payments" icon={History} tone="emerald">
                <div
                  role="radiogroup"
                  aria-label="Existing payments"
                  className="space-y-2"
                >
                  {(
                    [
                      {
                        mode: "carry",
                        title: "Keep them on the new dates",
                        hint: `${carried.paid} paid${
                          carried.partial
                            ? ` and ${carried.partial} partial`
                            : ""
                        } installment${
                          carried.paid + carried.partial === 1 ? "" : "s"
                        } move in order (1st to 1st, 2nd to 2nd) with their payments.`,
                      },
                      {
                        mode: "reset",
                        title: "Start over",
                        hint: "Every installment starts unpaid; recorded payments are removed.",
                      },
                    ] as const
                  ).map((option) => {
                    const on = rescheduleMode === option.mode;
                    const danger = option.mode === "reset";
                    return (
                      <m.button
                        key={option.mode}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setRescheduleMode(option.mode)}
                        className={`flex w-full items-start gap-3 rounded-2xl
                        border p-3 text-left transition-colors ${
                          !on
                            ? "border-border bg-card"
                            : danger
                              ? "border-rose-500/50 bg-rose-500/10"
                              : "border-emerald-500/50 bg-emerald-500/10"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex size-5 shrink-0 items-center
                          justify-center rounded-full border transition-colors
                          ${
                            !on
                              ? "border-muted-foreground/40"
                              : danger
                                ? "border-rose-500 bg-rose-500 text-white"
                                : "border-emerald-500 bg-emerald-500 text-white"
                          }`}
                        >
                          {on && <Check className="size-3.5" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold">
                            {option.title}
                            {option.mode === "carry" && (
                              <span
                                className="ml-1.5 text-xs font-semibold
                                  text-emerald-600 dark:text-emerald-300"
                              >
                                recommended
                              </span>
                            )}
                          </span>
                          <span
                            className="block text-xs font-medium
                              text-muted-foreground"
                          >
                            {option.hint}
                          </span>
                        </span>
                      </m.button>
                    );
                  })}
                </div>
              </Field>
            )}
          </Reveal>

          <Reveal
            show={isEdit && !isManual && quality !== "good"}
            className="pt-5"
          >
            <p
              role="status"
              className="flex gap-2 rounded-2xl border border-amber-500/40
                bg-amber-500/10 p-3 text-xs font-semibold"
            >
              <WifiOff className="mt-0.5 size-4 shrink-0 text-amber-600" />
              Saving rewrites the schedules, which needs a good connection. Try
              again when you are back online.
            </p>
          </Reveal>
        </Stagger>

        <SheetFooter>
          <m.div whileTap={{ scale: 0.97 }}>
            <Button
              type="submit"
              data-account-submit=""
              disabled={isSubmitting}
              size="lg"
              className="h-12 w-full rounded-2xl text-base font-bold shadow-lg
                shadow-primary/25"
            >
              {isEdit ? (
                <Check className="size-5" strokeWidth={2.75} />
              ) : (
                <Plus className="size-5" strokeWidth={2.75} />
              )}
              {isSubmitting
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save changes"
                  : "Create account"}
            </Button>
          </m.div>
        </SheetFooter>
      </form>
    </MotionConfig>
  );
}
