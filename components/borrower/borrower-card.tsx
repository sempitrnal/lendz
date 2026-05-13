"use client";

import { useRouter } from "next/navigation";
import { useTransition, type SyntheticEvent } from "react";
import { isDarkColor } from "@/lib/utils";
import { Phone } from "lucide-react";
import Link from "next/link";

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

};

export function BorrowerCard({
  borrower,
  quickAction,
  showScheduleSummary = false,
  onBorrowerUpdated,

}: BorrowerCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const categories = [...(borrower.borrower_categories ?? [])].sort((a, b) =>
    a.category.name.localeCompare(b.category.name)
  );
  console.log(borrower);
  const hasAccounts = borrower.has_accounts === true;
  const nextDate = borrower.next_collection_date;
  const nextAmount = borrower.next_collection_amount ?? 0;
  const nextAmounts = borrower.next_collection_amounts;
  const nextStatus = borrower.next_collection_status;
  const hasNextUnpaid = Boolean(nextDate);

  function openBorrower(e: SyntheticEvent) {
    if (isPending) return;
    if (
      (e.target as HTMLElement).closest("[data-prevent-borrower-card-open]")
    ) {
      return;
    }
    startTransition(() => {
      router.push(`/borrowers/${borrower.id}`);
    });
  }

  return (
    <div
      className={`relative w-full  min-w-0 max-w-full rounded-xl border-2 border-slate-900 bg-linear-to-br from-sky-50 via-white to-indigo-50 text-left shadow-[4px_4px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:from-sky-100 hover:to-indigo-100 ${isPending ? "cursor-wait opacity-80" : ""}`}
      aria-busy={isPending}
    >
      <div
        className="absolute right-2 top-2 z-10 flex items-center gap-1"
        data-prevent-borrower-card-open
      >
        {borrower.contact ? (
          <Link
            href={`tel:${borrower.contact}`}
            className="rounded-md border-2  border-slate-900 bg-indigo-100 p-2 text-indigo-700 transition hover:bg-indigo-200"
            aria-label={`Call ${borrower.first_name} ${borrower.last_name}`}
          >
            <Phone className="size-4" />
          </Link>
        ) : null}
        <BorrowerDetailMenu
          borrowerId={borrower.id}
          onDeleted={showScheduleSummary ? onBorrowerUpdated : undefined}
        />
      </div>

      <div
        role="button"
        tabIndex={isPending ? -1 : 0}
        onClick={openBorrower}
        onKeyDown={(e) => {
          if (isPending) return;
          if (e.key !== "Enter" && e.key !== " ") return;
          if (
            (e.target as HTMLElement).closest(
              "[data-prevent-borrower-card-open]"
            )
          ) {
            return;
          }
          e.preventDefault();
          startTransition(() => {
            router.push(`/borrowers/${borrower.id}`);
          });
        }}
        aria-disabled={isPending}
        className="box-border  block w-full min-w-0 max-w-full cursor-pointer rounded-xl p-4  pt-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        aria-label={`Open ${borrower.first_name} ${borrower.last_name}`}
      >
        <div className="flex w-full min-w-0 flex-col">
          <h2 className="text-xl pr-4 font-black uppercase text-slate-900">
            {borrower.first_name} {borrower.last_name}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((e: { category: { id: string; color: string | null; name: string } }) => {
              const { id, color, name } = e.category;
              return (
                <div
                  key={id}
                  className="flex items-center rounded-md border border-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_#1e293b]"
                  style={{
                    backgroundColor: color ?? "#333",
                    color: isDarkColor(color ?? "333") ? "white" : "#1e1a4d",
                  }}
                >
                  {name}
                </div>
              );
            })}
          </div>
        </div>

        {showScheduleSummary && hasAccounts ? (
          <div
            className="mt-4 w-full min-w-0 self-stretch rounded-lg border-2 border-slate-900 bg-sky-100/70 p-3 shadow-[2px_2px_0px_0px_rgb(15_23_42/0.85)]"
            data-prevent-borrower-card-open
          >
            <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Next collection
                </p>
                {hasNextUnpaid ? (
                  <div className="mt-2 space-y-1.5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Date
                      </p>
                      <p className="text-sm font-black text-slate-900 flex  items-center gap-2">
                        {new Date(nextDate!).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {nextStatus ? (
                          <span className={`ml-1 text-[10px]  font-black text-black px-1 shadow-[2px_2px_0px_0px_#333] rounded-xs border border-slate-900   uppercase ${nextStatus === "overdue" ? "bg-red-500/70" : nextStatus === "paid" ? "bg-green-500/70" : nextStatus === "pending" ? "bg-yellow-500/70" : nextStatus === "partial" ? "bg-purple-500/70" : "bg-blue-500/70"}`}>
                             {nextStatus}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Amount
                      </p>
                      <p className="text-sm font-black tabular-nums text-slate-900">
                        {`₱${nextAmount.toLocaleString()}`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    All schedules paid
                  </p>
                )}
              </div>

       
            </div>
          </div>
        ) : null}
       {borrower.overdue_total && borrower.overdue_count ? (
                <div className="min-w-0 mt-2 shadow-md p-2 border-2 border-red-900 bg-red-50 rounded-lg ">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Overdue 
                  </p>
                  <p className="text-[12px] mt-2 font-black">
                     {borrower.overdue_count ?? "0"} due dates
                  </p>
                  <p className="text-sm font-black text-slate-900">
                    <span className="font-semibold">total:</span> ₱{borrower.overdue_total?.toLocaleString() ?? "0"}
                  </p>
               
                </div>
              ) : null}

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
              className="rounded-md border-2 border-slate-900 bg-emerald-200 px-2 py-1 text-[11px] font-bold uppercase text-slate-900 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70"
            >
              {quickAction.isLoading ? "Updating..." : quickAction.label}
            </button>
          </div>
        ) : null}

        {isPending ? (
          <p className="mt-3 text-xs font-semibold text-slate-600">Opening…</p>
        ) : null}
      </div>
    </div >
  );
}
