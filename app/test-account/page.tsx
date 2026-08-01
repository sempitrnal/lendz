"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ChevronDown,
  FileText,
  Wallet,
  TrendingUp,
  MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

function formatMoney(value: number) {
  return `₱${value.toLocaleString()}`;
}

type ScheduleStatus = "pending" | "partial" | "paid" | "overdue";

type MockSchedule = {
  id: string;
  due_date: string;
  amount_due: number;
  status: ScheduleStatus;
  paid_date?: string;
  paid?: number;
  note?: string;
};

const account = {
  borrower: { first_name: "Juan", last_name: "Dela Cruz" },
  principal: 10_000,
  interestRate: 10,
  termMonths: 5,
  status: "active",
};

const schedules: MockSchedule[] = [
  {
    id: "s1",
    due_date: "2026-07-05",
    amount_due: 2200,
    status: "paid",
    paid_date: "2026-07-05",
  },
  {
    id: "s2",
    due_date: "2026-08-05",
    amount_due: 2200,
    status: "paid",
    paid_date: "2026-08-04",
  },
  {
    id: "s3",
    due_date: "2026-09-05",
    amount_due: 2200,
    status: "partial",
    paid: 1000,
    note: "Promised to pay balance next week",
  },
  {
    id: "s4",
    due_date: "2026-10-05",
    amount_due: 2200,
    status: "pending",
  },
  {
    id: "s5",
    due_date: "2026-11-05",
    amount_due: 2200,
    status: "pending",
  },
];

function statusClasses(status: ScheduleStatus) {
  switch (status) {
    case "paid":
      return {
        badge:
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-300",
        dot: "bg-emerald-500",
        ring: "ring-emerald-200 dark:ring-emerald-400/30",
      };
    case "partial":
      return {
        badge:
          "bg-violet-100 text-violet-800 dark:bg-violet-400/20 dark:text-violet-300",
        dot: "bg-violet-500",
        ring: "ring-violet-200 dark:ring-violet-400/30",
      };
    case "overdue":
      return {
        badge:
          "bg-rose-100 text-rose-800 dark:bg-rose-400/20 dark:text-rose-300",
        dot: "bg-rose-500",
        ring: "ring-rose-200 dark:ring-rose-400/30",
      };
    default:
      return {
        badge:
          "bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-300",
        dot: "bg-amber-400",
        ring: "ring-amber-200 dark:ring-amber-400/30",
      };
  }
}

function StatusIcon({ status }: { status: ScheduleStatus }) {
  if (status === "paid")
    return <CheckCircle2 className="size-4 text-emerald-500" />;
  if (status === "partial") return <Clock className="size-4 text-violet-500" />;
  if (status === "overdue")
    return <AlertCircle className="size-4 text-rose-500" />;
  return <Clock className="size-4 text-amber-500" />;
}

function ProgressRing({
  percent,
  size = 88,
  stroke = 8,
}: {
  percent: number;
  size?: number;
  stroke?: number;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          className="fill-none stroke-slate-200 dark:stroke-slate-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="fill-none stroke-sky-500 transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-sm font-extrabold text-slate-900 dark:text-slate-100"
        >
          {percent}%
        </span>
      </div>
    </div>
  );
}

function AccountHeader() {
  return (
    <div
      className="sticky top-0 z-20 border-b border-slate-200 bg-white/80
        backdrop-blur dark:border-slate-800 dark:bg-slate-950/80"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center
            rounded-xl bg-slate-900 text-white dark:bg-slate-800"
        >
          <Wallet className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-extrabold text-slate-900
              dark:text-slate-100"
          >
            {account.borrower.first_name} {account.borrower.last_name}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Principal {formatMoney(account.principal)} · {account.interestRate}%
            · {account.termMonths}mo
          </p>
        </div>
        <span
          className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px]
            font-bold uppercase tracking-wide text-emerald-800
            dark:bg-emerald-400/20 dark:text-emerald-300"
        >
          {account.status}
        </span>
        <button
          type="button"
          className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-bold
            text-white shadow-sm transition hover:bg-sky-600"
        >
          Mark next paid
        </button>
        <button
          type="button"
          className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100
            dark:hover:bg-slate-800"
          aria-label="More options"
        >
          <MoreVertical className="size-4" />
        </button>
      </div>
    </div>
  );
}

function AccountProgress() {
  const totalDue = schedules.reduce((s, x) => s + x.amount_due, 0);
  const totalPaid = schedules.reduce(
    (s, x) => s + (x.status === "paid" ? x.amount_due : (x.paid ?? 0)),
    0,
  );
  const remaining = totalDue - totalPaid;
  const profit = totalDue - account.principal;
  const percent = Math.round((totalPaid / totalDue) * 100);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl px-4 pt-4"
    >
      <div
        className="flex items-center gap-5 rounded-2xl border border-slate-200
          bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <ProgressRing percent={percent} />
        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-bold uppercase tracking-wide text-slate-400"
          >
            Progress
          </p>
          <p
            className="mt-1 text-2xl font-extrabold text-slate-900
              dark:text-slate-100"
          >
            {formatMoney(totalPaid)}
            <span className="text-sm font-semibold text-slate-400">
              {" "}
              / {formatMoney(totalDue)}
            </span>
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-wide
                  text-slate-400"
              >
                Remaining
              </p>
              <p
                className="text-sm font-bold text-slate-900 dark:text-slate-100"
              >
                {formatMoney(remaining)}
              </p>
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-wide
                  text-slate-400"
              >
                Profit
              </p>
              <p
                className="text-sm font-bold text-emerald-600
                  dark:text-emerald-400"
              >
                {formatMoney(profit)}
              </p>
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-wide
                  text-slate-400"
              >
                Rate
              </p>
              <p
                className="text-sm font-bold text-slate-900 dark:text-slate-100"
              >
                {account.interestRate}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function ScheduleTimelineItem({
  schedule,
  index,
  isNext,
}: {
  schedule: MockSchedule;
  index: number;
  isNext: boolean;
}) {
  const [open, setOpen] = useState(isNext);
  const st = statusClasses(schedule.status);
  const paid =
    schedule.paid ?? (schedule.status === "paid" ? schedule.amount_due : 0);
  const pct =
    schedule.amount_due > 0
      ? Math.min(100, Math.round((paid / schedule.amount_due) * 100))
      : 0;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn("relative pl-10", isNext && "z-10")}
    >
      <div
        className={cn(
          `absolute left-0 top-6 size-5 rounded-full border-4 border-white
          dark:border-slate-950`,
          st.dot,
          isNext && "ring-4",
          isNext && st.ring,
        )}
      />
      {index < schedules.length - 1 && (
        <div
          className="absolute left-2.5 top-11 h-full w-px bg-slate-200
            dark:bg-slate-800"
        />
      )}

      <div
        className={cn(
          "rounded-2xl border bg-white shadow-sm transition dark:bg-slate-900",
          isNext
            ? "border-sky-300 shadow-md dark:border-sky-700"
            : "border-slate-200 dark:border-slate-800",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-start justify-between gap-3 px-4 py-4
            text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="text-[11px] font-bold tracking-wide text-slate-400"
              >
                #{index + 1}
              </span>
              {isNext && (
                <span
                  className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px]
                    font-bold uppercase text-sky-700 dark:bg-sky-800/50
                    dark:text-sky-300"
                >
                  Next
                </span>
              )}
              <span
                className={cn(
                  `ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold
                  uppercase tracking-wide`,
                  st.badge,
                )}
              >
                {schedule.status}
              </span>
            </div>

            <div className="mt-1.5 flex items-baseline gap-2">
              <p
                className="text-2xl font-extrabold tracking-tight text-slate-900
                  dark:text-slate-100"
              >
                {formatMoney(schedule.amount_due)}
              </p>
              <StatusIcon status={schedule.status} />
            </div>

            <div
              className="mt-1.5 flex items-center gap-1.5 text-xs font-medium
                text-slate-500 dark:text-slate-400"
            >
              <CalendarClock className="size-3.5 shrink-0" />
              {schedule.status === "paid" && schedule.paid_date
                ? `Paid ${formatDate(schedule.paid_date)}`
                : formatDate(schedule.due_date)}
            </div>

            {schedule.status === "partial" && (
              <div className="mt-3">
                <div
                  className="flex justify-between text-[10px] font-bold
                    uppercase tracking-wide text-slate-400"
                >
                  <span>Paid {formatMoney(paid)}</span>
                  <span>Left {formatMoney(schedule.amount_due - paid)}</span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full
                    bg-slate-200 dark:bg-slate-700"
                >
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            {schedule.note && (
              <p
                className="mt-2 line-clamp-2 text-xs text-slate-500
                  dark:text-slate-400"
              >
                {schedule.note}
              </p>
            )}
          </div>

          <ChevronDown
            className={cn(
              "mt-1 size-4 shrink-0 text-slate-400 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="flex items-center gap-2 border-t border-slate-200
                  px-4 py-3 dark:border-slate-800"
              >
                {schedule.status === "partial" && (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-xl
                      bg-violet-500 px-3 py-2 text-xs font-bold text-white
                      transition hover:bg-violet-600"
                  >
                    <Plus className="size-3.5" />
                    Add payment
                  </button>
                )}
                {schedule.status !== "paid" && (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-xl
                      bg-emerald-500 px-3 py-2 text-xs font-bold text-white
                      transition hover:bg-emerald-600"
                  >
                    <CheckCircle2 className="size-3.5" />
                    Mark paid
                  </button>
                )}
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-xl border
                    border-slate-200 px-3 py-2 text-xs font-bold text-slate-600
                    transition hover:bg-slate-50 dark:border-slate-700
                    dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <FileText className="size-3.5" />
                  Note
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}

function ScheduleTimeline() {
  const nextIndex = schedules.findIndex((s) => s.status !== "paid");
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="mx-auto max-w-3xl px-4 pt-6"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2
          className="text-sm font-extrabold uppercase tracking-wide
            text-slate-900 dark:text-slate-100"
        >
          Payment schedule
        </h2>
        <span className="text-xs font-semibold text-slate-400">
          {schedules.length} installments
        </span>
      </div>
      <ul className="space-y-4">
        {schedules.map((schedule, index) => (
          <ScheduleTimelineItem
            key={schedule.id}
            schedule={schedule}
            index={index}
            isNext={index === nextIndex}
          />
        ))}
      </ul>
    </motion.section>
  );
}

function AccountBreakdown() {
  const [open, setOpen] = useState(false);
  const totalDue = schedules.reduce((s, x) => s + x.amount_due, 0);
  const interest = totalDue - account.principal;

  return (
    <section className="mx-auto max-w-3xl px-4 pt-6">
      <div
        className="rounded-2xl border border-slate-200 bg-white shadow-sm
          dark:border-slate-800 dark:bg-slate-900"
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-slate-400" />
            <span
              className="text-sm font-extrabold text-slate-900
                dark:text-slate-100"
            >
              Breakdown
            </span>
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-slate-400 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="border-t border-slate-200 px-4 py-3 text-sm
                  dark:border-slate-800"
              >
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Principal</span>
                  <span className="font-bold">
                    {formatMoney(account.principal)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Interest</span>
                  <span className="font-bold">{formatMoney(interest)}</span>
                </div>
                <div
                  className="flex justify-between border-t border-slate-200 py-1
                    dark:border-slate-800"
                >
                  <span className="font-bold">Total payable</span>
                  <span className="font-bold">{formatMoney(totalDue)}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

export default function TestAccountPage() {
  return (
    <main className="min-h-screen bg-slate-50 pb-24 dark:bg-slate-950">
      <AccountHeader />
      <AccountProgress />
      <ScheduleTimeline />
      <AccountBreakdown />
    </main>
  );
}
