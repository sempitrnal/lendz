import { connection } from "next/server";
import { getAccountDetailPageData } from "@/lib/cache/accounts";
import { notFound } from "next/navigation";
import AddSchedulesPanel from "@/components/add-schedules-panel";
import { ScheduleSelectionProvider } from "@/components/schedule-selection-provider";
import { AccountBand } from "@/components/account/account-band";
import { ScheduleTimeline } from "@/components/account/schedule-timeline";
import BatchScheduleToolbar from "@/components/batch-schedule-toolbar";
import type { ShareSchedule } from "@/components/share-schedule-button";
import NextScheduleScroller from "@/components/next-schedule-scroller";
import PendingActivationBanner from "@/components/accounts/pending-activation-banner";
import { ImpasNaBannerClient as ImpasNaBanner } from "@/components/impas-na-banner-client";
import type { ActivateAccountData } from "@/app/actions/accounts";
import {
  amountPaidOnInstallment,
  remainingOnInstallment,
} from "@/lib/payment-schedule/schedule-balances";
import { countSkippedSchedules } from "@/lib/payment-schedule/build-payload";
import { Info } from "lucide-react";
import {
  updateScheduleStatusAction,
  batchUpdateScheduleStatusAction,
  applyPartialPaymentAction,
  updatePaymentEntryAction,
  deletePaymentEntryAction,
  deleteScheduleAction,
  addSchedulesAction,
} from "@/lib/actions/schedules";

type AccountDetailPageProps = {
  params: Promise<{ id: string }>;
};

const nb = {
  card: "rounded-xl border border-slate-300 bg-background dark:border-slate-700 dark:bg-slate-900",
  cardSoft:
    "rounded-xl border border-slate-300 bg-background dark:border-slate-700 dark:bg-slate-900",
  inset:
    "rounded-lg border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900",
  label:
    "text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400",
  /** Payment schedule block */
  scheduleShell: "overflow-hidden rounded-2xl border border-border bg-card   ",
  scheduleHead:
    " px-4 rounded-t-md py-3 sm:px-5 sm:py-4 dark:border-slate-700 ",
  scheduleTh:
    "border-r border-b border-slate-300 bg-slate-50 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 last:border-r-0 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
  scheduleTd:
    "border-r border-b border-slate-300 px-3 py-2.5 align-middle text-slate-600 last:border-r-0 dark:border-slate-700 dark:text-slate-300",
};

function formatMoney(value: number) {
  return `₱${value.toLocaleString()}`;
}

export default async function AccountDetailPage({
  params,
  searchParams,
}: AccountDetailPageProps & {
  searchParams: Promise<{ focus?: string }>;
}) {
  await connection();
  const { id } = await params;
  const { focus: focusScheduleId } = await searchParams;

  let accountDetail;
  try {
    accountDetail = await getAccountDetailPageData(id);
  } catch {
    notFound();
  }

  const {
    account: accountRow,
    borrower,
    schedules,
    paymentsMap,
  } = accountDetail;
  const totalPayment = schedules.reduce(
    (sum, s) => sum + (s.amount_due ?? 0),
    0,
  );

  const amountPaid = schedules.reduce(
    (sum, s) => sum + amountPaidOnInstallment(s),
    0,
  );

  const amountLeftRaw = schedules.reduce(
    (sum, s) => sum + remainingOnInstallment(s),
    0,
  );
  const amountLeftRolling = schedules
    .filter((s) => s.status !== "partial")
    .reduce((sum, s) => sum + remainingOnInstallment(s), 0);

  const principal = Number(accountRow.principal_amount ?? 0);
  const interestRate = Number(accountRow.interest_rate ?? 0);
  const isManual = accountRow.schedule_mode === "manual";
  const isRolling = isManual && accountRow.interest_type === "rolling";
  const isFlatManual = isManual && !isRolling;
  const manualFlatTotal = isFlatManual
    ? principal * (1 + interestRate / 100)
    : 0;

  const totalScheduledDue = schedules.reduce(
    (s, r) => s + Math.max(0, Number(r.amount_due ?? 0)),
    0,
  );
  const totalScheduledPaid = schedules.reduce(
    (s, r) => s + Math.max(0, Number(r.amount_paid ?? 0)),
    0,
  );

  const amountLeft = isFlatManual
    ? Math.max(0, manualFlatTotal - amountPaid)
    : isRolling
      ? amountLeftRolling
      : amountLeftRaw;

  const rollingTotalContract = isRolling ? amountPaid + amountLeft : 0;
  const profit = isFlatManual
    ? manualFlatTotal - principal
    : isRolling
      ? rollingTotalContract - principal
      : totalPayment - principal;

  const progressPct = isFlatManual
    ? manualFlatTotal > 0
      ? Math.min(100, Math.round((amountPaid / manualFlatTotal) * 100))
      : 0
    : totalScheduledDue > 0
      ? Math.min(
          100,
          Math.round((totalScheduledPaid / totalScheduledDue) * 100),
        )
      : 0;

  const updateScheduleStatus = updateScheduleStatusAction.bind(
    null,
    accountRow.id,
  );
  const batchUpdateScheduleStatus = batchUpdateScheduleStatusAction.bind(
    null,
    accountRow.id,
  );
  const applyPartialPayment = applyPartialPaymentAction;
  const updatePaymentEntry = updatePaymentEntryAction.bind(null, id);
  const deletePaymentEntry = deletePaymentEntryAction.bind(null, id);
  const deleteSchedule = deleteScheduleAction.bind(null, id);
  const addSchedules = addSchedulesAction.bind(null, id);

  const borrowerName = borrower
    ? `${borrower.first_name} ${borrower.last_name}`
    : "Unknown borrower";

  const borrowerCategories =
    borrower?.borrower_categories?.map((row) => row.category).filter(Boolean) ??
    [];

  const isPending = accountRow.status === "pending";
  const terms = isPending
    ? "pending"
    : [
        accountRow.interest_rate != null
          ? `${accountRow.interest_rate}%`
          : null,
        isManual
          ? isRolling
            ? "manual rolling"
            : "manual flat"
          : accountRow.payment_frequency,
        isManual ? null : `${accountRow.term_months ?? 1}mo`,
      ]
        .filter(Boolean)
        .join(" · ");

  const totalRemaining = schedules.reduce(
    (sum, s) => sum + remainingOnInstallment(s),
    0,
  );

  const shareSchedules = schedules.map(
    (s, i) =>
      ({
        index: i + 1,
        due_date: s.due_date,
        amount_due: Number(s.amount_due ?? 0),
        amount_paid: amountPaidOnInstallment(s),
        remaining: remainingOnInstallment(s),
        status: s.status,
        paid_date: s.paid_date,
      }) as ShareSchedule,
  );

  return (
    <>
      <NextScheduleScroller />

      <div className="mx-auto max-w-2xl px-4 pb-16">
        <AccountBand
          accountId={id}
          borrowerId={borrower?.id ?? ""}
          borrowerName={borrowerName}
          categories={borrowerCategories.map((c) => ({
            id: c.id,
            name: c.name,
            color: c.color ?? null,
          }))}
          kind={accountRow.type === "cash_advance" ? "cash advance" : "loan"}
          principal={principal}
          terms={terms}
          releaseDate={accountRow.release_date ?? null}
          left={amountLeft}
          collected={amountPaid}
          profit={profit}
          pct={progressPct}
          share={{
            isManual,
            borrowerName,
            accountType: accountRow.type,
            releaseDate: accountRow.release_date,
            principal,
            collected: amountPaid,
            remaining: amountLeft,
            profit,
            totalPayment,
            progressPct,
            schedules: shareSchedules,
          }}
        />

        {/* Floats over the band's lower edge; the band's header caps it on
            scroll (see AccountBand). */}
        <div
          className="relative z-10 -mt-8 space-y-5 px-1 sm:-mt-12"
          data-settle-group
        >
          {accountRow.status === "pending" ? (
            <PendingActivationBanner
              releaseDate={accountRow.release_date}
              principal={principal}
              accountId={id}
              initialValues={{
                principal_amount: principal,
                interest_rate: Number(accountRow.interest_rate ?? 0),
                release_date: accountRow.release_date ?? "",
                first_payment_date: accountRow.first_payment_date ?? "",
                payment_frequency:
                  (accountRow.payment_frequency as ActivateAccountData["payment_frequency"]) ??
                  "bimonthly",
                term_months: Number(accountRow.term_months ?? 1),
                schedule_mode:
                  (accountRow.schedule_mode as ActivateAccountData["schedule_mode"]) ??
                  "auto",
                interest_type:
                  (accountRow.interest_type as ActivateAccountData["interest_type"]) ??
                  "flat",
              }}
            />
          ) : null}

          {/* 
        <section aria-labelledby="balances-heading" className="hidden sm:block">
          <h2 id="balances-heading" className={`mb-3 ${nb.label}`}>
            Balances
          </h2>
          <div className="grid gap-3 text-4xl sm:grid-cols-2 lg:grid-cols-4">
            <div
              className={`${nb.card} dark:to-card border-sky-900/20
                bg-linear-to-br from-sky-50/90 to-white p-4
                dark:border-sky-400/20 dark:from-sky-400/10`}
            >
              <p className={nb.label}>Principal</p>
              <p
                className="dark:text-foreground mt-1.5 text-4xl font-black
                  tracking-tight text-slate-600"
              >
                <AnimatedNumber
                  value={Number(accountRow.principal_amount ?? 0)}
                  prefix="₱"
                />
              </p>
              <p
                className="dark:text-muted-foreground mt-1.5 text-xs
                  text-slate-600"
              >
                Loan amount
              </p>
            </div>
            <div
              className={`${nb.card} dark:to-card border-rose-900/20
                bg-linear-to-br from-rose-50/90 to-white p-4
                dark:border-rose-400/20 dark:from-rose-400/10`}
            >
              <p className={nb.label}>Remaining</p>
              <p
                className="dark:text-foreground mt-1.5 text-4xl font-black
                  tracking-tight text-slate-600"
              >
                <AnimatedNumber value={amountLeft} prefix="₱" />
              </p>
              <p
                className="dark:text-muted-foreground mt-1.5 text-xs
                  text-slate-600"
              >
                Still to collect
              </p>
            </div>
            <div
              className={`${nb.card} dark:to-card border-emerald-900/20
                bg-linear-to-br from-emerald-50/90 to-white p-4
                dark:border-emerald-400/20 dark:from-emerald-400/10`}
            >
              <p className={nb.label}>Collected</p>
              <p
                className="dark:text-foreground mt-1.5 text-4xl font-black
                  tracking-tight text-slate-600"
              >
                <AnimatedNumber value={amountPaid} prefix="₱" />
              </p>
              <p
                className="dark:text-muted-foreground mt-1.5 text-xs
                  text-slate-600"
              >
                Nabayran
              </p>
            </div>

            <div
              className={`${nb.card} dark:to-card border-amber-900/20
                bg-linear-to-br from-amber-50/90 to-white p-4
                dark:border-amber-400/20 dark:from-amber-400/10`}
            >
              <p className={nb.label}>Projected profit</p>
              <p
                className="dark:text-foreground mt-1.5 text-4xl font-black
                  tracking-tight text-slate-600"
              >
                <AnimatedNumber value={Math.max(0, profit)} prefix="₱" />
              </p>
              <p
                className="dark:text-muted-foreground mt-1.5 text-xs
                  text-slate-600"
              >
                {isRolling ? "Interest charged (all cycles)" : "Over principal"}
              </p>
            </div>
          </div>
          <div
            className={`mt-3 ${nb.inset} dark:text-muted-foreground px-4 py-3
              text-sm text-slate-700`}
          >
            <span className="dark:text-foreground font-semibold text-slate-600">
              Total contract
            </span>{" "}
            <span className="tabular-nums">
              {formatMoney(isRolling ? rollingTotalContract : totalPayment)}
            </span>
            <span className="dark:text-border mx-2 text-slate-300">|</span>
            <span className="dark:text-muted-foreground text-slate-600">
              {isRolling
                ? `${schedules.filter((s) => isInstallmentFullyPaid(s)).length} cycle${schedules.filter((s) => isInstallmentFullyPaid(s)).length === 1 ? "" : "s"} paid · ${formatMoney(amountLeft)} outstanding`
                : isManual
                  ? `${formatMoney(amountPaid)} of ${formatMoney(principal)} recovered`
                  : `${schedules.filter((s) => isInstallmentFullyPaid(s)).length} of ${totalInstallments} installments paid`}
            </span>
          </div>
        </section> */}

          {accountRow.status !== "pending" ? (
            <ScheduleSelectionProvider>
              <section aria-labelledby="schedule-heading">
                {/* <ScheduleEditBar allIds={schedules.map((s) => s.id)} /> */}

                {schedules.length === 0 ? (
                  <div
                    className="dark:border-border/50 dark:bg-muted/50 border-t
                      border-dashed border-slate-300 bg-slate-50/80 px-5 py-12
                      text-center"
                  >
                    <p
                      className="dark:text-muted-foreground text-sm font-black
                        tracking-wide text-slate-600 uppercase"
                    >
                      No payment schedules yet
                    </p>
                  </div>
                ) : (
                  <>
                    {totalRemaining === 0 &&
                      schedules.length > 0 &&
                      !isManual && (
                        <ImpasNaBanner profit={amountPaid - principal} />
                      )}
                    <ScheduleTimeline
                      schedules={schedules}
                      paymentsMap={paymentsMap}
                      isRolling={isRolling}
                      interestRate={interestRate}
                      focusScheduleId={focusScheduleId}
                      borrowerId={borrower?.id}
                      updateScheduleStatus={updateScheduleStatus}
                      applyPartialPayment={applyPartialPayment}
                      deleteSchedule={deleteSchedule}
                      updatePaymentEntry={updatePaymentEntry}
                      deletePaymentEntry={deletePaymentEntry}
                    />
                  </>
                )}
                {isManual ? (
                  <div className="print:hidden">
                    <AddSchedulesPanel
                      accountId={accountRow.id}
                      addSchedules={addSchedules}
                    />
                  </div>
                ) : null}
              </section>
              <BatchScheduleToolbar
                allIds={schedules.map((s) => s.id)}
                onBatchPaid={batchUpdateScheduleStatus}
                borrowerId={borrower?.id}
              />
            </ScheduleSelectionProvider>
          ) : null}

          {accountRow.status !== "pending" &&
            accountRow.calculate_skipped_schedules &&
            accountRow.release_date &&
            accountRow.first_payment_date &&
            accountRow.payment_frequency &&
            (() => {
              const skipped = countSkippedSchedules(
                accountRow.release_date,
                accountRow.first_payment_date,
                accountRow.payment_frequency as
                  | "weekly"
                  | "monthly"
                  | "bimonthly"
                  | "custom",
              );
              return skipped > 0 ? (
                <div className="space-y-2">
                  <div
                    className="flex items-center gap-2 rounded-xl border
                    border-amber-400/30 bg-amber-50/90 px-4 py-3
                    dark:border-amber-400/20 dark:bg-amber-400/12"
                  >
                    <Info className="size-4 shrink-0 text-amber-700 dark:text-amber-300" />
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      {skipped} payment schedule{skipped === 1 ? "" : "s"}{" "}
                      skipped between release date and first payment date. Extra
                      interest was added to each installment.
                    </p>
                  </div>
                  {(() => {
                    const p = Number(accountRow.principal_amount ?? 0);
                    const r = Number(accountRow.interest_rate ?? 0);
                    const t = Number(accountRow.term_months ?? 0);
                    const monthlyInterest = p * (r / 100);
                    const baseInterest = monthlyInterest * t;
                    const dailyInterest = monthlyInterest / 30;
                    const periodDays =
                      accountRow.payment_frequency === "bimonthly" ||
                      accountRow.payment_frequency === "custom"
                        ? 15
                        : accountRow.payment_frequency === "monthly"
                          ? 30
                          : 7;
                    const extraPerSkip = dailyInterest * periodDays;
                    const totalExtra = extraPerSkip * skipped;
                    const totalInterest = baseInterest + totalExtra;
                    const totalPayable = p + totalInterest;
                    const schedulesCount =
                      accountRow.payment_frequency === "bimonthly"
                        ? Math.round(t * 2)
                        : accountRow.payment_frequency === "weekly"
                          ? Math.round(t * 4)
                          : accountRow.payment_frequency === "custom"
                            ? Math.round(t)
                            : Math.round(t);
                    const perInstallment =
                      schedulesCount > 0
                        ? Number((totalPayable / schedulesCount).toFixed(2))
                        : 0;
                    const basePerInstallment =
                      schedulesCount > 0
                        ? Number(
                            ((p + baseInterest) / schedulesCount).toFixed(2),
                          )
                        : 0;
                    return (
                      <div
                        className={`${nb.inset} px-4 py-3 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300`}
                      >
                        <p className="dark:text-muted-foreground mb-1 text-[10px] font-black tracking-wide text-slate-500 uppercase">
                          Interest breakdown
                        </p>
                        <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
                          <span>
                            Base interest ({t}mo × {r}%)
                          </span>
                          <span className="text-right font-bold tabular-nums">
                            {formatMoney(baseInterest)}
                          </span>
                          <span>
                            Extra per skipped schedule ({periodDays} days)
                          </span>
                          <span className="text-right font-bold tabular-nums">
                            {formatMoney(extraPerSkip)}
                          </span>
                          <span>Skipped schedules</span>
                          <span className="text-right font-bold tabular-nums">
                            × {skipped}
                          </span>
                          <span className="border-t border-slate-200 pt-0.5 font-bold dark:border-slate-700">
                            Total extra interest
                          </span>
                          <span className="border-t border-slate-200 pt-0.5 text-right font-bold tabular-nums dark:border-slate-700">
                            {formatMoney(totalExtra)}
                          </span>
                          <span className="border-t border-slate-200 pt-0.5 font-bold dark:border-slate-700">
                            Total interest
                          </span>
                          <span className="border-t border-slate-200 pt-0.5 text-right font-bold tabular-nums dark:border-slate-700">
                            {formatMoney(totalInterest)}
                          </span>
                          <span className="border-t border-slate-200 pt-0.5 font-bold dark:border-slate-700">
                            Total payable
                          </span>
                          <span className="border-t border-slate-200 pt-0.5 text-right font-bold tabular-nums dark:border-slate-700">
                            {formatMoney(totalPayable)}
                          </span>
                          {schedulesCount > 0 && (
                            <>
                              <span className="pt-0.5">
                                Per installment ({schedulesCount})
                              </span>
                              <span className="text-right font-bold tabular-nums">
                                {formatMoney(perInstallment)}
                              </span>
                              <span className="dark:text-muted-foreground text-[10px] text-slate-500">
                                Without skip
                              </span>
                              <span className="dark:text-muted-foreground text-right text-[10px] text-slate-500 tabular-nums">
                                {formatMoney(basePerInstallment)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : null;
            })()}
        </div>
      </div>
    </>
  );
}
