import DailyChecklistCategoryList from "@/components/dashboard/daily-checklist-category-list";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function DailyChecklistCategoriesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/daily-checklist"
          className="inline-flex items-center gap-1 rounded-md border-2 border-slate-900 bg-white px-2 py-1 text-xs font-bold uppercase text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:-translate-y-0.5 hover:translate-x-0.5 dark:border-border dark:bg-card dark:text-foreground dark:shadow-none"
        >
          <ArrowLeft className="size-3" />
          back
        </Link>
        <h1 className="text-2xl font-black lowercase text-slate-900 dark:text-foreground">
          checklist categories
        </h1>
      </div>
      <div className="max-w-xl">
        <DailyChecklistCategoryList />
      </div>
    </main>
  );
}
