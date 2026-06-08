"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-400 bg-slate-50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/30",
        className,
      )}
    >
      <div className="mb-4 flex size-16 items-center justify-center rounded-full border-2 border-slate-900 bg-white shadow-[3px_3px_0px_0px_#0f172a] dark:border-zinc-700 dark:bg-slate-800 dark:shadow-none">
        <Icon className="size-7 text-slate-500 dark:text-slate-400" />
      </div>
      <h3 className="text-base font-black text-slate-900 dark:text-slate-200">
        {title}
      </h3>
      <p className="mt-1 max-w-xs text-sm font-semibold text-slate-500 dark:text-slate-400">
        {description}
      </p>
      {action ? (
        <Link
          href={action.href}
          className="dark:border-border dark:bg-card dark:text-foreground mt-4 inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-900 bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:bg-slate-50 active:translate-y-0 active:shadow-none dark:shadow-none"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
