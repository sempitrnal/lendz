"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { triggerHaptic } from "@/lib/haptics";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import NeobrutButton from "@/components/neobrut-button";
import {
  activateAccountAction,
  type ActivateAccountData,
} from "@/app/actions/accounts";

type ActivateAccountDialogProps = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  initialValues: Partial<ActivateAccountData>;
};

const inputClass =
  "mt-1 w-full rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-[2px_2px_0px_0px_#0f172a] outline-none focus:ring-2 focus:ring-green-300 dark:border-border dark:bg-card dark:text-foreground dark:shadow-none";

export default function ActivateAccountDialog({
  open,
  onClose,
  accountId,
  initialValues,
}: ActivateAccountDialogProps) {
  const router = useRouter();

  const [principal, setPrincipal] = useState<number>(
    initialValues.principal_amount ?? 0,
  );
  const [principalText, setPrincipalText] = useState(
    initialValues.principal_amount
      ? Number(initialValues.principal_amount).toLocaleString()
      : "",
  );
  const [interestRate, setInterestRate] = useState<number | "">(
    initialValues.interest_rate ?? "",
  );
  const [interestRateText, setInterestRateText] = useState(
    initialValues.interest_rate !== undefined
      ? String(initialValues.interest_rate)
      : "",
  );
  const [releaseDate, setReleaseDate] = useState(
    initialValues.release_date ?? "",
  );
  const [firstPaymentDate, setFirstPaymentDate] = useState(
    initialValues.first_payment_date ?? "",
  );

  const quickFirstPayment = (day: number) => {
    const base = releaseDate ? new Date(releaseDate) : new Date();
    const baseYear = base.getFullYear();
    const baseMonth = base.getMonth();
    const baseDay = base.getDate();

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
      label: target.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      value: `${y}-${m}-${d}`,
      ts: target.getTime(),
    };
  };
  const [paymentFrequency, setPaymentFrequency] = useState<
    ActivateAccountData["payment_frequency"]
  >(initialValues.payment_frequency ?? "bimonthly");
  const [termMonths, setTermMonths] = useState<number | "">(
    initialValues.term_months ?? "",
  );
  const [scheduleMode, setScheduleMode] = useState<
    ActivateAccountData["schedule_mode"]
  >(initialValues.schedule_mode ?? "auto");
  const [interestType, setInterestType] = useState<
    ActivateAccountData["interest_type"]
  >(initialValues.interest_type ?? "flat");
  const [isCustom, setIsCustom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calculateSkipped, setCalculateSkipped] = useState(false);

  useEffect(() => {
    if (open) {
      setPrincipal(initialValues.principal_amount ?? 0);
      setPrincipalText(
        initialValues.principal_amount
          ? Number(initialValues.principal_amount).toLocaleString()
          : "",
      );
      setInterestRate(initialValues.interest_rate ?? "");
      setInterestRateText(
        initialValues.interest_rate !== undefined
          ? String(initialValues.interest_rate)
          : "",
      );
      setReleaseDate(initialValues.release_date ?? "");
      setFirstPaymentDate(initialValues.first_payment_date ?? "");
      setPaymentFrequency(initialValues.payment_frequency ?? "bimonthly");
      setTermMonths(initialValues.term_months ?? "");
      setScheduleMode(initialValues.schedule_mode ?? "auto");
      setInterestType(initialValues.interest_type ?? "flat");
      setIsCustom(initialValues.payment_frequency === "custom");
      setCalculateSkipped(initialValues.calculate_skipped_schedules ?? false);
    }
  }, [open, initialValues]);

  const isManual = scheduleMode === "manual";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstPaymentDate) {
      triggerHaptic("warning");
      toast.error("First payment date is required");
      return;
    }
    const termNum = Number(termMonths);
    if (!Number.isFinite(termNum) || termNum <= 0) {
      triggerHaptic("warning");
      toast.error("Term must be greater than 0");
      return;
    }
    const rateNum = Number(interestRate);
    if (!Number.isFinite(rateNum) || rateNum < 0) {
      triggerHaptic("warning");
      toast.error("Interest rate must be a valid number");
      return;
    }

    setIsSubmitting(true);
    const result = await activateAccountAction(accountId, {
      principal_amount: principal,
      interest_rate: rateNum,
      release_date: releaseDate,
      first_payment_date: firstPaymentDate,
      payment_frequency: paymentFrequency,
      term_months: termNum,
      schedule_mode: scheduleMode,
      interest_type: interestType,
      calculate_skipped_schedules: calculateSkipped,
    });
    setIsSubmitting(false);

    if (result.error) {
      triggerHaptic("error");
      toast.error(result.error);
      return;
    }

    triggerHaptic("success");
    toast.success("Account activated and schedules created");
    onClose();
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            className="text-sm font-black tracking-wide text-slate-600
              uppercase"
          >
            activate account
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Principal */}
          <div>
            <label
              className="dark:text-muted-foreground text-[10px] font-bold
                tracking-wider text-slate-500 uppercase"
            >
              principal amount
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={principalText}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, "");
                if (raw === "") {
                  setPrincipalText("");
                  setPrincipal(0);
                  return;
                }
                const num = Number(raw);
                if (!isNaN(num)) {
                  setPrincipalText(num.toLocaleString());
                  setPrincipal(num);
                }
              }}
              className={inputClass}
            />
          </div>

          {/* Interest rate */}
          <div>
            <label
              className="dark:text-muted-foreground text-[10px] font-bold
                tracking-wider text-slate-500 uppercase"
            >
              interest rate (%)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={interestRateText}
              onChange={(e) => {
                const v = e.target.value.replace(",", ".");
                setInterestRateText(v);
                if (v === "" || v === ".") {
                  setInterestRate("");
                  return;
                }
                const num = Number(v);
                if (!isNaN(num)) {
                  setInterestRate(num);
                }
              }}
              onBlur={() => {
                const num = Number(interestRateText.replace(",", "."));
                if (!isNaN(num)) {
                  setInterestRate(num);
                  setInterestRateText(String(num));
                } else {
                  setInterestRateText("");
                  setInterestRate("");
                }
              }}
              onFocus={(e) => e.target.select()}
              className={inputClass}
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[3.3, 3.8, 4, 5].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    setInterestRate(rate);
                    setInterestRateText(String(rate));
                  }}
                  className={`dark:border-border rounded-md border-2
                  border-slate-900 px-4 py-2 text-sm font-bold transition
                  hover:-translate-y-0.5 dark:shadow-none ${
                    interestRate === rate
                      ? `dark:bg-foreground dark:text-background bg-slate-900
                        text-white`
                      : `dark:text-foreground bg-gradient-to-br from-emerald-50
                        to-sky-50 text-slate-600 dark:bg-gradient-to-br
                        dark:from-slate-800 dark:to-slate-900`
                  }`}
                >
                  {rate}%
                </button>
              ))}
            </div>
          </div>

          {/* Release date */}
          <div>
            <label
              className="dark:text-muted-foreground text-[10px] font-bold
                tracking-wider text-slate-500 uppercase"
            >
              release date
            </label>
            <input
              type="date"
              value={releaseDate}
              onChange={(e) => setReleaseDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Schedule mode */}
          <div>
            <label
              className="dark:text-muted-foreground text-[10px] font-bold
                tracking-wider text-slate-500 uppercase"
            >
              schedule mode
            </label>
            <select
              value={scheduleMode}
              onChange={(e) =>
                setScheduleMode(
                  e.target.value as ActivateAccountData["schedule_mode"],
                )
              }
              className={inputClass}
            >
              <option value="auto">auto</option>
              <option value="manual">manual</option>
            </select>
          </div>

          {/* Interest type (only when manual) */}
          {isManual && (
            <div>
              <label
                className="dark:text-muted-foreground text-[10px] font-bold
                  tracking-wider text-slate-500 uppercase"
              >
                interest type
              </label>
              <select
                value={interestType}
                onChange={(e) =>
                  setInterestType(
                    e.target.value as ActivateAccountData["interest_type"],
                  )
                }
                className={inputClass}
              >
                <option value="flat">flat</option>
                <option value="rolling">rolling</option>
              </select>
            </div>
          )}

          {/* First payment date */}
          {!isManual && (
            <div>
              <label
                className="dark:text-muted-foreground text-[10px] font-bold
                  tracking-wider text-slate-500 uppercase"
              >
                first payment date
              </label>
              <input
                type="date"
                value={firstPaymentDate}
                onChange={(e) => setFirstPaymentDate(e.target.value)}
                required={!isManual}
                className={inputClass}
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[4, 5, 7, 8, 10, 15]
                  .map((day) => quickFirstPayment(day))
                  .sort((a, b) => a.ts - b.ts)
                  .map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFirstPaymentDate(value)}
                      className={`dark:border-border rounded-md border-2
                      border-slate-900 px-4 py-2 text-sm font-bold transition
                      hover:-translate-y-0.5 dark:shadow-none ${
                        firstPaymentDate === value
                          ? `dark:bg-foreground dark:text-background
                            bg-slate-900 text-white`
                          : `dark:text-foreground bg-gradient-to-br
                            from-emerald-50 to-sky-50 text-slate-600
                            dark:bg-gradient-to-br dark:from-slate-800
                            dark:to-slate-900`
                      }`}
                    >
                      {label}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Skipped schedules toggle */}
          {!isManual && (
            <div>
              <label
                className="dark:text-muted-foreground text-[10px] font-bold
                  tracking-wider text-slate-500 uppercase"
              >
                calculate skipped schedules
              </label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCalculateSkipped(true)}
                  className={`rounded-md border-2 border-slate-900 px-3 py-1.5
                  text-[10px] font-bold shadow-[1px_1px_0px_0px_#0f172a]
                  transition hover:-translate-y-0.5 dark:shadow-none ${
                    calculateSkipped
                      ? "bg-emerald-300 text-slate-600"
                      : "bg-white text-slate-600"
                  }`}
                >
                  yes
                </button>
                <button
                  type="button"
                  onClick={() => setCalculateSkipped(false)}
                  className={`rounded-md border-2 border-slate-900 px-3 py-1.5
                  text-[10px] font-bold shadow-[1px_1px_0px_0px_#0f172a]
                  transition hover:-translate-y-0.5 dark:shadow-none ${
                    !calculateSkipped
                      ? "bg-red-300 text-slate-600"
                      : "bg-white text-slate-600"
                  }`}
                >
                  no
                </button>
              </div>
            </div>
          )}

          {/* Payment frequency */}
          {!isManual && (
            <div>
              <label
                className="dark:text-muted-foreground text-[10px] font-bold
                  tracking-wider text-slate-500 uppercase"
              >
                payment frequency
              </label>
              <select
                value={paymentFrequency}
                onChange={(e) => {
                  const val = e.target
                    .value as ActivateAccountData["payment_frequency"];
                  setPaymentFrequency(val);
                  setIsCustom(val === "custom");
                }}
                className={inputClass}
              >
                <option value="weekly">weekly</option>
                <option value="bimonthly">bimonthly</option>
                <option value="monthly">monthly</option>
                <option value="custom">custom</option>
              </select>
            </div>
          )}

          {/* Term */}
          {!isManual && (
            <div>
              <label
                className="dark:text-muted-foreground text-[10px] font-bold
                  tracking-wider text-slate-500 uppercase"
              >
                {isCustom ? "term installments (gives)" : "term (months)"}
              </label>
              <input
                type="text"
                inputMode={isCustom ? "numeric" : "decimal"}
                value={termMonths}
                onChange={(e) => {
                  const v = e.target.value.replace(",", ".");
                  if (v === "" || v === ".") {
                    setTermMonths("");
                    return;
                  }
                  const num = Number(v);
                  if (!isNaN(num)) {
                    setTermMonths(num);
                  }
                }}
                onFocus={(e) => e.target.select()}
                className={inputClass}
              />
            </div>
          )}

          <DialogFooter className="gap-3 sm:gap-2">
            <Button variant="outline" type="button" onClick={onClose}>
              cancel
            </Button>
            <NeobrutButton
              variant="green"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "activating..." : "activate account"}
            </NeobrutButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
