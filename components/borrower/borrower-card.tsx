"use client";

import { formatDate, isDarkColor } from "@/lib/utils";
import { ChevronDown, Loader2, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  memo,
  useRef,
  useState,
  useTransition,
  type SyntheticEvent,
} from "react";

import BorrowerDetailMenu from "@/components/borrower/borrower-detail-menu";
import { Borrower } from "./borrower-list";

type BorrowerCardProps = {
  borrower: Borrower;
  quickAction?: {
    label: string;
    onClick: () => void;
    isLoading?: boolean;
  };
  /** Borrowers list: next collection, mark next paid, overflow menu */
  showScheduleSummary?: boolean;
  onBorrowerUpdated?: () => void;
  /** Compact mode for upcoming-due-dates grid (slimmer card, less detail) */
  compact?: boolean;
  onVisit?: (borrower: {
    id: string;
    first_name: string;
    last_name: string;
    categoryColor: string | null;
  }) => void;
};

export const BorrowerCard = memo(function BorrowerCard({
  borrower,
  quickAction,
  showScheduleSummary = false,
  onBorrowerUpdated,
  compact = false,
  onVisit,
}: BorrowerCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAccountPending, startAccountTransition] = useTransition();
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const touchStartY = useRef(0);
  const didScroll = useRef(false);
  const [overdueOpen, setOverdueOpen] = useState(false);
  const [expandedOverdue, setExpandedOverdue] = useState<
    Record<number, boolean>
  >({});
  const toggleOverdue = (i: number, defaultOpen: boolean) =>
    setExpandedOverdue((prev) => ({ ...prev, [i]: !(prev[i] ?? defaultOpen) }));
  const [showAllSchedules, setShowAllSchedules] = useState(false);
  const categories = [...(borrower.borrower_categories ?? [])].sort((a, b) =>
    a.category.name.localeCompare(b.category.name),
  );
  const firstCategoryColor = categories[0]?.category?.color;

  const hasOverdue = (borrower.overdue_count ?? 0) > 0;
  const hasAccounts = borrower.has_accounts === true;
  const accountsCount = borrower.accounts_count ?? 0;
  const nextDate = borrower.next_collection_date;
  const nextAmount = borrower.next_collection_amount ?? 0;
  const nextAmounts = borrower.next_collection_amounts;
  const nextStatus = borrower.next_collection_status;
  const hasNextUnpaid = Boolean(nextDate);
  const schedules = borrower.account_schedules || [];
  const manualPrincipal = borrower.manual_total_principal ?? 0;
  const manualPaid = borrower.manual_total_paid ?? 0;
  const manualRemaining = borrower.manual_total_remaining ?? 0;
  const hasManual = manualPrincipal > 0;
  const manualAccountsCount = borrower.manual_accounts_count ?? 0;
  const hasAutoAccounts = (borrower.accounts_count ?? 0) > manualAccountsCount;
  function openBorrower(e: SyntheticEvent) {
    if (isPending) return;
    if (didScroll.current) return;
    if (
      (e.target as HTMLElement).closest("[data-prevent-borrower-card-open]")
    ) {
      return;
    }
    sessionStorage.setItem("borrowers-list-scroll", String(window.scrollY));
    onVisit?.({
      id: borrower.id,
      first_name: borrower.first_name,
      last_name: borrower.last_name,
      categoryColor: firstCategoryColor ?? null,
    });
    startTransition(() => {
      router.push(`/borrowers/${borrower.id}`);
    });
  }

  return (
    <div
      onTouchStart={(e) => {
        touchStartY.current = e.touches[0].clientY;
        didScroll.current = false;
      }}
      onTouchMove={(e) => {
        if (Math.abs(e.touches[0].clientY - touchStartY.current) > 8)
          didScroll.current = true;
      }}
      className={`relative w-full max-w-full min-w-0 rounded-lg border-2
        border-slate-300 bg-white text-left transition-all duration-150
        dark:border-border dark:bg-card ${
          isPending
            ? ""
            : `active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_#0f172a]
              dark:active:shadow-[2px_2px_0px_0px_#020617]`
        }`}
      aria-busy={isPending}
    >
      {/* Prefetch borrower detail page for instant navigation */}
      <Link
        href={`/borrowers/${borrower.id}`}
        prefetch
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      <div
        className="absolute top-2 right-2 z-10 flex items-center gap-1"
        data-prevent-borrower-card-open
      >
        {borrower.contact ? (
          <Link
            href={`tel:${borrower.contact}`}
            className="touch-manipulation rounded-md border border-slate-900/30
              bg-slate-50 p-1.5 text-slate-600 transition hover:bg-slate-100
              active:translate-y-px dark:border-border/50 dark:bg-muted
              dark:text-slate-300 dark:hover:bg-muted/70"
            aria-label={`Call ${borrower.first_name} ${borrower.last_name}`}
          >
            <Phone className="size-3.5" />
          </Link>
        ) : null}
        <BorrowerDetailMenu
          borrowerId={borrower.id}
          onDeleted={showScheduleSummary ? onBorrowerUpdated : undefined}
        />
      </div>

      <div
        tabIndex={isPending ? -1 : 0}
        onPointerEnter={() => router.prefetch(`/borrowers/${borrower.id}`)}
        onClick={openBorrower}
        onKeyDown={(e) => {
          if (isPending) return;
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          startTransition(() => {
            router.push(`/borrowers/${borrower.id}`);
          });
        }}
        aria-disabled={isPending}
        className={`dark:text-foreground dark:focus-visible:ring-border
          box-border block w-full max-w-full min-w-0 cursor-pointer
          touch-manipulation text-left outline-none focus-visible:ring-2
          focus-visible:ring-slate-900 focus-visible:ring-offset-2
          ${compact ? "p-2.5" : "p-4"} ${isPending ? "opacity-50" : ""}`}
        aria-label={`Open ${borrower.first_name} ${borrower.last_name}`}
      >
        <div className="flex w-full min-w-0 flex-col">
          <h2
            className={`dark:text-foreground pr-4 font-bold text-slate-700
              lowercase ${compact ? "text-base" : "text-xl"}`}
          >
            {borrower.first_name} {borrower.last_name}
          </h2>
          {!compact && (
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map(
                (e: {
                  category: { id: string; color: string | null; name: string };
                }) => {
                  const { id, color, name } = e.category;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-1.5 rounded-full
                        text-[10px] font-bold uppercase dark:border-border/40"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full border
                          border-slate-900/15"
                        style={{
                          backgroundColor: color ?? "#cbd5e1",
                        }}
                      />
                      {name}
                    </div>
                  );
                },
              )}
            </div>
          )}
          {!compact && categories.length > 0 && hasNextUnpaid && (
            <div className="relative mt-3 h-px">
              <div
                className="absolute -left-4 -right-4 top-0 h-px bg-slate-200
                  dark:bg-border/50"
              />
            </div>
          )}
        </div>

        {!compact && showScheduleSummary && borrower.all_accounts_pending ? (
          <div
            className="mt-4 w-full min-w-0 rounded-lg border border-slate-200
              bg-slate-50 p-3 dark:border-border/50 dark:bg-muted/40"
          >
            <p
              className="text-[10px] font-bold tracking-widest text-slate-500
                uppercase dark:text-muted-foreground"
            >
              pending loan
            </p>
            <p
              className="mt-1 text-sm font-bold text-slate-600
                dark:text-foreground"
            >
              ₱{(borrower.pending_principal_total ?? 0).toLocaleString()}{" "}
              <span
                className="text-xs font-medium text-slate-500
                  dark:text-muted-foreground"
              >
                principal
              </span>
            </p>
            <p
              className="mt-1 text-[10px] font-medium text-slate-500
                dark:text-muted-foreground"
            >
              Awaiting release — no collection schedules yet
            </p>
          </div>
        ) : null}

        {!compact && showScheduleSummary && hasManual && schedules.length > 0
          ? (() => {
              const manualSchedules = schedules.filter(
                (s) => s.schedule_mode === "manual",
              );
              const groups: {
                key: string;
                label: string;
                items: typeof manualSchedules;
              }[] = [
                {
                  key: "flat-loan",
                  label: "manual flat",
                  items: manualSchedules.filter(
                    (s) =>
                      s.type !== "cash_advance" &&
                      s.interest_type !== "rolling",
                  ),
                },
                {
                  key: "rolling-loan",
                  label: "manual rolling",
                  items: manualSchedules.filter(
                    (s) =>
                      s.type !== "cash_advance" &&
                      s.interest_type === "rolling",
                  ),
                },
                {
                  key: "flat-ca",
                  label: "manual flat ca",
                  items: manualSchedules.filter(
                    (s) =>
                      s.type === "cash_advance" &&
                      s.interest_type !== "rolling",
                  ),
                },
                {
                  key: "rolling-ca",
                  label: "manual rolling ca",
                  items: manualSchedules.filter(
                    (s) =>
                      s.type === "cash_advance" &&
                      s.interest_type === "rolling",
                  ),
                },
              ];
              return (
                <>
                  {groups.map((g) => {
                    if (g.items.length === 0) return null;
                    const principal = g.items.reduce(
                      (sum, s) => sum + Number(s.principal_amount ?? 0),
                      0,
                    );
                    const paid = g.items.reduce(
                      (sum, s) => sum + Number(s.amount_paid_total ?? 0),
                      0,
                    );
                    const remaining = Math.max(0, principal - paid);
                    const pct =
                      principal > 0
                        ? Math.min(100, Math.round((paid / principal) * 100))
                        : 0;
                    return (
                      <div
                        key={g.key}
                        className="mt-2 w-full min-w-0 rounded-lg border
                          border-slate-200 bg-slate-50 p-2.5 dark:border-border/50
                          dark:bg-muted/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[9px] font-bold tracking-wider text-slate-500 uppercase dark:text-muted-foreground">
                              {g.label}
                            </p>
                            <p className="text-xs font-bold text-slate-600 tabular-nums dark:text-foreground">
                              ₱{principal.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                              paid
                            </p>
                            <p className="text-xs font-bold text-emerald-700 tabular-nums dark:text-emerald-300">
                              ₱{paid.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-bold tracking-wider text-rose-600 uppercase dark:text-rose-400">
                              left
                            </p>
                            <p className="text-xs font-bold text-rose-700 tabular-nums dark:text-rose-300">
                              ₱{remaining.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {principal > 0 && (
                          <div className="mt-2 flex items-center gap-2">
                            <div
                              className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                              role="progressbar"
                              aria-valuenow={pct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`${g.label} payment progress`}
                            >
                              <div
                                className="h-full bg-emerald-400 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="shrink-0 text-[9px] font-bold text-slate-600 dark:text-slate-300">
                              {pct}%
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              );
            })()
          : null}

        {/* Compact upcoming-due display */}
        {compact && showScheduleSummary && hasNextUnpaid ? (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="dark:text-foreground font-black text-slate-600">
              {formatDate(nextDate)}
            </span>
            <span className="font-bold text-slate-500">
              ₱{nextAmount.toLocaleString()}
            </span>
            {nextStatus ? (
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px]
                  font-black uppercase ${
                    nextStatus === "overdue"
                      ? `bg-rose-100 text-rose-800 dark:bg-rose-900/40
                        dark:text-rose-200`
                      : nextStatus === "paid"
                        ? `bg-emerald-100 text-emerald-800
                          dark:bg-emerald-900/40 dark:text-emerald-200`
                        : nextStatus === "pending"
                          ? `bg-amber-100 text-amber-800 dark:bg-amber-900/40
                            dark:text-amber-200`
                          : nextStatus === "partial"
                            ? `bg-purple-100 text-purple-800
                              dark:bg-purple-900/40 dark:text-purple-200`
                            : `bg-sky-100 text-sky-800 dark:bg-sky-900/40
                              dark:text-sky-200`
                  }`}
              >
                {nextStatus}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Full next-collection section for non-compact mode */}
        {!compact && showScheduleSummary && hasNextUnpaid ? (
          <div
            className="mt-4 w-full min-w-0 self-stretch rounded-lg border
              border-slate-200 bg-fuchsia-50/80 p-3 dark:border-border/50
              dark:bg-muted/40"
          >
            <div
              className="flex w-full min-w-0 flex-wrap items-center
                justify-between gap-2 sm:flex-nowrap"
            >
              <div className="min-w-0 flex-1">
                <p
                  className="dark:text-muted-foreground text-[10px] font-bold
                    tracking-wide text-slate-500 uppercase"
                >
                  Next collection
                  {accountsCount > 0 ? (
                    <span
                      className="dark:text-muted-foreground ml-1 text-slate-400
                        normal-case"
                    >
                      · {accountsCount} account{accountsCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </p>
                {hasNextUnpaid ? (
                  <div className="mt-2 space-y-1.5">
                    <div>
                      <p
                        className="text-[10px] font-bold tracking-wide
                          text-slate-500 uppercase"
                      ></p>
                      {(() => {
                        const visibleSchedules =
                          showAllSchedules || schedules.length <= 2
                            ? schedules
                            : schedules.slice(0, 2);
                        const hiddenCount =
                          schedules.length - visibleSchedules.length;
                        return (
                          <>
                            {visibleSchedules.map((schedule, i) => {
                              const isThisAccountPending =
                                isAccountPending &&
                                pendingAccountId === schedule.account_id;
                              return (
                                <div
                                  key={i}
                                  role="button"
                                  tabIndex={0}
                                  data-prevent-borrower-card-open
                                  className="relative -mx-1 block w-full touch-manipulation rounded-lg px-1 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
                                  onPointerEnter={() => {
                                    if (schedule.account_id)
                                      router.prefetch(
                                        `/accounts/${schedule.account_id}`,
                                      );
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (didScroll.current) return;
                                    if (!schedule.account_id) return;
                                    setPendingAccountId(schedule.account_id);
                                    startAccountTransition(() => {
                                      router.push(
                                        `/accounts/${schedule.account_id}`,
                                      );
                                    });
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key !== "Enter" && e.key !== " ")
                                      return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!schedule.account_id) return;
                                    setPendingAccountId(schedule.account_id);
                                    startAccountTransition(() => {
                                      router.push(
                                        `/accounts/${schedule.account_id}`,
                                      );
                                    });
                                  }}
                                >
                                  <div className="flex flex-col gap-2">
                                    <p className="dark:text-foreground mt-2 flex items-center gap-2 text-sm font-black text-slate-600">
                                      {formatDate(schedule.due_date)}
                                      {schedules.length > 1 ? (
                                        <span className="w-max text-xs font-bold text-stone-500">
                                          ₱{schedule.amount.toLocaleString()}
                                          {schedule.status === "partial" &&
                                          schedule.amount_due_per_schedule &&
                                          schedule.amount_due_per_schedule >
                                            schedule.amount ? (
                                            <span className="dark:text-muted-foreground font-normal text-slate-400">
                                              {" "}
                                              of ₱
                                              {Number(
                                                schedule.amount_due_per_schedule,
                                              ).toLocaleString()}
                                            </span>
                                          ) : null}
                                        </span>
                                      ) : null}
                                      {schedule.status ? (
                                        <span
                                          className={`ml-1 shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${schedule.status === "overdue" ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200" : schedule.status === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : schedule.status === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" : schedule.status === "partial" ? "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200" : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"}`}
                                        >
                                          {schedule.status}
                                        </span>
                                      ) : null}
                                    </p>{" "}
                                    <div className="flex flex-col items-start gap-2">
                                      {(() => {
                                        const isManual =
                                          schedule.schedule_mode === "manual";
                                        const principal = Number(
                                          schedule.principal_amount ?? 0,
                                        );
                                        const totalSched =
                                          schedule.total_schedules || 1;
                                        const amtDue = Number(
                                          schedule.amount_due_per_schedule ?? 0,
                                        );
                                        const isPartial =
                                          schedule.status === "partial";
                                        const partialPaid =
                                          isPartial && amtDue > 0
                                            ? amtDue - schedule.amount
                                            : 0;
                                        const partialFraction =
                                          isPartial && amtDue > 0
                                            ? partialPaid / amtDue
                                            : 0;
                                        const pct = isManual
                                          ? Math.min(
                                              100,
                                              Math.round(
                                                ((schedule.amount_paid_total ??
                                                  0) /
                                                  (principal || 1)) *
                                                  100,
                                              ),
                                            )
                                          : Math.min(
                                              100,
                                              Math.round(
                                                (((schedule.paid_schedules_count ??
                                                  0) +
                                                  partialFraction) /
                                                  totalSched) *
                                                  100,
                                              ),
                                            );
                                        const principalPerSched =
                                          principal / totalSched;
                                        const interestPerSched =
                                          amtDue > 0
                                            ? amtDue - principalPerSched
                                            : null;
                                        return (
                                          <>
                                            <div
                                              className="h-2 w-full overflow-hidden rounded-full border border-slate-200 dark:border-border bg-white md:w-40 dark:bg-slate-800"
                                              role="progressbar"
                                              aria-valuenow={pct}
                                              aria-valuemin={0}
                                              aria-valuemax={100}
                                              aria-label="Payment progress"
                                            >
                                              <div
                                                className="h-full bg-emerald-400 transition-all"
                                                style={{ width: `${pct}%` }}
                                              />
                                            </div>
                                            <p className="dark:text-foreground text-xs font-black text-stone-800">
                                              {isManual
                                                ? `₱${(schedule.amount_paid_total ?? 0).toLocaleString()} paid of ₱${principal.toLocaleString()}`
                                                : isPartial
                                                  ? `${schedule.paid_schedules_count} paid · ₱${partialPaid.toLocaleString()} of ₱${amtDue.toLocaleString()} on current`
                                                  : `${schedule.paid_schedules_count} paid out of ${schedule.total_schedules} schedule${schedule.total_schedules === 1 ? "" : "s"}`}
                                            </p>
                                            {!isManual && principal > 0 && (
                                              <div className="mt-0.5 flex flex-wrap gap-3 gap-y-1">
                                                <span className="dark:text-muted-foreground text-[10px] text-slate-500">
                                                  <span className="dark:text-foreground font-black text-slate-700">
                                                    Principal
                                                  </span>{" "}
                                                  ₱{principal.toLocaleString()}
                                                </span>
                                                {schedule.interest_rate !=
                                                  null && (
                                                  <span className="dark:text-muted-foreground text-[10px] text-slate-500">
                                                    <span className="dark:text-foreground font-black text-slate-700">
                                                      Interest
                                                    </span>{" "}
                                                    {schedule.interest_rate}%
                                                  </span>
                                                )}
                                                {interestPerSched != null &&
                                                  interestPerSched > 0 && (
                                                    <span className="dark:text-muted-foreground text-[10px] text-slate-500">
                                                      <span className="dark:text-foreground font-black text-slate-700">
                                                        per payroll
                                                      </span>{" "}
                                                      ₱
                                                      {interestPerSched.toLocaleString(
                                                        undefined,
                                                        {
                                                          maximumFractionDigits: 2,
                                                        },
                                                      )}
                                                    </span>
                                                  )}
                                              </div>
                                            )}
                                            {schedule.overdue_schedules &&
                                              schedule.overdue_schedules
                                                .length > 0 &&
                                              (() => {
                                                const defaultOpen =
                                                  schedule.overdue_schedules
                                                    .length <= 6;
                                                const isOpen =
                                                  expandedOverdue[i] ??
                                                  defaultOpen;
                                                return (
                                                  <div className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-border/50 dark:bg-muted/40">
                                                    <button
                                                      type="button"
                                                      data-prevent-borrower-card-open
                                                      onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        toggleOverdue(
                                                          i,
                                                          defaultOpen,
                                                        );
                                                      }}
                                                      className="flex w-full items-center justify-between gap-2"
                                                    >
                                                      <span className="text-[9px] font-bold tracking-wide text-rose-600 uppercase dark:text-rose-400">
                                                        Overdue installments ·{" "}
                                                        {
                                                          schedule
                                                            .overdue_schedules
                                                            .length
                                                        }
                                                      </span>
                                                      <ChevronDown
                                                        className={`size-3 text-rose-500 transition-transform duration-200 dark:text-rose-400 ${isOpen ? "rotate-180" : ""}`}
                                                      />
                                                    </button>
                                                    <div
                                                      className={`grid transition-[grid-template-rows] duration-200 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                                                    >
                                                      <div className="overflow-hidden">
                                                        <div className="mt-1 space-y-0.5">
                                                          {schedule.overdue_schedules.map(
                                                            (os, oi) => (
                                                              <div
                                                                key={oi}
                                                                className="flex items-center justify-between gap-2"
                                                              >
                                                                <span className="dark:text-foreground text-[10px] font-semibold text-slate-700">
                                                                  {new Date(
                                                                    os.due_date,
                                                                  ).toLocaleDateString(
                                                                    undefined,
                                                                    {
                                                                      month:
                                                                        "short",
                                                                      day: "numeric",
                                                                      year: "numeric",
                                                                    },
                                                                  )}
                                                                </span>
                                                                <span className="text-[10px] font-black text-red-700 dark:text-red-300">
                                                                  ₱
                                                                  {os.amount.toLocaleString()}
                                                                </span>
                                                              </div>
                                                            ),
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              })()}
                                          </>
                                        );
                                      })()}
                                    </div>
                                    <div className="my-2 h-px bg-slate-200 dark:bg-border/50" />
                                  </div>
                                  {isThisAccountPending && (
                                    <div className="dark:bg-card/60 pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-white/60">
                                      <Loader2 className="dark:text-muted-foreground size-4 animate-spin text-slate-500" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {hiddenCount > 0 && (
                              <button
                                type="button"
                                data-prevent-borrower-card-open
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowAllSchedules(true);
                                }}
                                className="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-bold text-slate-500 transition hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/5"
                              >
                                <span>
                                  + {hiddenCount} more account
                                  {hiddenCount === 1 ? "" : "s"}
                                </span>
                                <ChevronDown className="size-3" />
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div>
                      <p
                        className="dark:text-muted-foreground text-[10px]
                          font-bold tracking-wide text-slate-500 uppercase"
                      >
                        total amount
                      </p>
                      <p
                        className="dark:text-foreground text-sm font-black
                          text-slate-600 tabular-nums"
                      >
                        {`₱${nextAmount.toLocaleString()}`}
                        {schedules.length === 1 &&
                        schedules[0].status === "partial" &&
                        schedules[0].amount_due_per_schedule &&
                        schedules[0].amount_due_per_schedule > nextAmount ? (
                          <span
                            className="dark:text-muted-foreground ml-1 text-xs
                              font-normal text-slate-400"
                          >
                            of ₱
                            {Number(
                              schedules[0].amount_due_per_schedule,
                            ).toLocaleString()}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p
                    className="dark:text-muted-foreground mt-2 text-sm
                      font-semibold text-slate-600"
                  >
                    All schedules paid
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}
        {/* {borrower.overdue_total && borrower.overdue_count ? (
                <div className="min-w-0 mt-2 shadow-md border-2 border-red-900 bg-red-50 rounded-lg" data-prevent-borrower-card-open>
                  <button
                    type="button"
                    onClick={() => setOverdueOpen((o) => !o)}
                    className="w-full flex items-center justify-between p-2 text-left"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Overdue · {borrower.overdue_count} due date{borrower.overdue_count === 1 ? "" : "s"} · ₱{borrower.overdue_total?.toLocaleString()}
                    </p>
                    <span className={`text-[10px] font-black text-red-700 transition-transform ${overdueOpen ? "rotate-180" : ""}`}>▾</span>
                  </button>
                  {overdueOpen ? (
                    <div className="px-2 pb-2">
                      <div className="space-y-1">
                        {(borrower.overdue_schedules ?? []).map((s, i) => (
                          <p key={i} className="text-sm font-black text-slate-600 flex items-center gap-2">
                            {formatDate(s.due_date)}
                            <span className="font-bold text-stone-500 text-xs w-max">
                              ₱{s.amount.toLocaleString()}
                            </span>
                            <span className="text-[8px] font-black text-black px-1 shadow-[2px_2px_0px_0px_#333] rounded-xs border border-slate-900 uppercase bg-red-500/70">
                              overdue
                            </span>
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null} */}

        {!showScheduleSummary && quickAction ? (
          <div
            className="mt-4 flex justify-end"
            data-prevent-borrower-card-open
          >
            <button
              type="button"
              disabled={quickAction.isLoading || isPending}
              onClick={(e) => {
                e.stopPropagation();
                quickAction.onClick();
              }}
              className="rounded-md border border-slate-900/30 bg-emerald-50
                px-3 py-1.5 text-[11px] font-bold text-emerald-800 transition
                hover:bg-emerald-100 active:translate-y-px disabled:cursor-wait
                disabled:opacity-70 dark:border-border/50 dark:bg-emerald-900/30
                dark:text-emerald-300"
            >
              {quickAction.isLoading ? "Updating..." : quickAction.label}
            </button>
          </div>
        ) : null}

        {isPending ? (
          <div
            className="dark:bg-card/50 pointer-events-none absolute inset-0 flex
              items-center justify-center rounded-lg bg-white/50"
          >
            <Loader2
              className="dark:text-muted-foreground h-6 w-6 animate-spin
                text-slate-500"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
});
