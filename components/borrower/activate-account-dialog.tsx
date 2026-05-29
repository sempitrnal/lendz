"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import NeobrutButton from "@/components/neobrut-button";
import { activateAccountAction, type ActivateAccountData } from "@/app/actions/accounts";

type ActivateAccountDialogProps = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  initialValues: Partial<ActivateAccountData>;
};

const inputClass =
  "mt-1 w-full rounded-lg border-2 border-slate-900 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] outline-none focus:ring-2 focus:ring-green-300";

export default function ActivateAccountDialog({
  open,
  onClose,
  accountId,
  initialValues,
}: ActivateAccountDialogProps) {
  const router = useRouter();

  const [principal, setPrincipal] = useState(initialValues.principal_amount ?? 0);
  const [interestRate, setInterestRate] = useState(initialValues.interest_rate ?? 0);
  const [releaseDate, setReleaseDate] = useState(initialValues.release_date ?? "");
  const [firstPaymentDate, setFirstPaymentDate] = useState(initialValues.first_payment_date ?? "");
  const [paymentFrequency, setPaymentFrequency] = useState<ActivateAccountData["payment_frequency"]>(
    initialValues.payment_frequency ?? "bimonthly"
  );
  const [termMonths, setTermMonths] = useState(initialValues.term_months ?? 1);
  const [scheduleMode, setScheduleMode] = useState<ActivateAccountData["schedule_mode"]>(
    initialValues.schedule_mode ?? "auto"
  );
  const [interestType, setInterestType] = useState<ActivateAccountData["interest_type"]>(
    initialValues.interest_type ?? "flat"
  );
  const [isCustom, setIsCustom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPrincipal(initialValues.principal_amount ?? 0);
      setInterestRate(initialValues.interest_rate ?? 0);
      setReleaseDate(initialValues.release_date ?? "");
      setFirstPaymentDate(initialValues.first_payment_date ?? "");
      setPaymentFrequency(initialValues.payment_frequency ?? "bimonthly");
      setTermMonths(initialValues.term_months ?? 1);
      setScheduleMode(initialValues.schedule_mode ?? "auto");
      setInterestType(initialValues.interest_type ?? "flat");
      setIsCustom(initialValues.payment_frequency === "custom");
    }
  }, [open, initialValues]);

  const isManual = scheduleMode === "manual";
  const isRolling = isManual && interestType === "rolling";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstPaymentDate) {
      toast.error("First payment date is required");
      return;
    }
    if (termMonths <= 0) {
      toast.error("Term must be greater than 0");
      return;
    }

    setIsSubmitting(true);
    const result = await activateAccountAction(accountId, {
      principal_amount: principal,
      interest_rate: interestRate,
      release_date: releaseDate,
      first_payment_date: firstPaymentDate,
      payment_frequency: paymentFrequency,
      term_months: termMonths,
      schedule_mode: scheduleMode,
      interest_type: interestType,
    });
    setIsSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Account activated and schedules created");
    onClose();
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-black uppercase tracking-wide text-slate-900">
            activate account
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Principal */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              principal amount
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value))}
              className={inputClass}
            />
          </div>

          {/* Interest rate */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              interest rate (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              className={inputClass}
            />
          </div>

          {/* Release date */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
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
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              schedule mode
            </label>
            <select
              value={scheduleMode}
              onChange={(e) => setScheduleMode(e.target.value as ActivateAccountData["schedule_mode"])}
              className={inputClass}
            >
              <option value="auto">auto</option>
              <option value="manual">manual</option>
            </select>
          </div>

          {/* Interest type (only when manual) */}
          {isManual && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                interest type
              </label>
              <select
                value={interestType}
                onChange={(e) => setInterestType(e.target.value as ActivateAccountData["interest_type"])}
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
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                first payment date
              </label>
              <input
                type="date"
                value={firstPaymentDate}
                onChange={(e) => setFirstPaymentDate(e.target.value)}
                required={!isManual}
                className={inputClass}
              />
            </div>
          )}

          {/* Payment frequency */}
          {!isManual && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                payment frequency
              </label>
              <select
                value={paymentFrequency}
                onChange={(e) => {
                  const val = e.target.value as ActivateAccountData["payment_frequency"];
                  setPaymentFrequency(val);
                  setIsCustom(val === "custom");
                  if (val === "custom") setTermMonths(1);
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
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {isCustom ? "term installments (gives)" : "term (months)"}
              </label>
              <input
                type="number"
                inputMode={isCustom ? "numeric" : "decimal"}
                step={isCustom ? 1 : 0.5}
                min={isCustom ? 1 : 0.5}
                value={termMonths}
                onChange={(e) => setTermMonths(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          )}

          <DialogFooter className="gap-3 sm:gap-2">
            <Button variant="outline" type="button" onClick={onClose}>
              cancel
            </Button>
            <NeobrutButton variant="green" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "activating..." : "activate account"}
            </NeobrutButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
