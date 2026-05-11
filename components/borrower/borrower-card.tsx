"use client"

import { useRouter } from "next/navigation";
import { Borrower } from "./borrower-list";
import { useTransition } from "react";
import { isDarkColor } from "@/lib/utils";
import { Phone } from "lucide-react";
import Link from "next/link";

type BorrowerCardProps = {
  borrower: Borrower;
  quickAction?: {
    label: string;
    onClick: () => void;
    isLoading?: boolean;
  };
};

export function BorrowerCard({ borrower, quickAction }: BorrowerCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const categories = [...(borrower.borrower_categories ?? [])].sort((a, b) =>
    a.category.name.localeCompare(b.category.name)
  );

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          router.push(`/borrowers/${borrower.id}`);
        })
      }
      className="w-full cursor-pointer rounded-xl border-2 border-slate-900 bg-linear-to-br from-sky-50 via-white to-indigo-50 p-4 text-left shadow-[4px_4px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:from-sky-100 hover:to-indigo-100 disabled:cursor-wait disabled:opacity-80"
      aria-busy={isPending}
      aria-label={`Open ${borrower.first_name} ${borrower.last_name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="text-xl font-black uppercase text-slate-900">
            {borrower.first_name} {borrower.last_name}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {categories.map((e: any) => {
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
        {borrower.contact ? (
          <Link
            href={`tel:${borrower.contact}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-md border-2 border-slate-900 bg-indigo-100 p-2 text-indigo-700 transition hover:bg-indigo-200"
            aria-label={`Call ${borrower.first_name} ${borrower.last_name}`}
          >
            <Phone className="size-4" />
          </Link>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>Created {new Date(borrower.created_at).toLocaleDateString()}</span>
        <div className="flex items-center gap-2">
          {quickAction ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                quickAction.onClick();
              }}
              className="rounded-md border-2 border-slate-900 bg-emerald-200 px-2 py-1 text-[11px] font-bold uppercase text-slate-900 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-70"
            >
              {quickAction.isLoading ? "Updating..." : quickAction.label}
            </div>
          ) : null}
          {isPending ? <span className="font-semibold text-slate-700">Opening...</span> : null}
        </div>
      </div>
    </button>
  );
}