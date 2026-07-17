import DailyChecklistCategoryList from "@/components/dashboard/daily-checklist-category-list";

export default function DailyChecklistCategoriesPage() {
  return (
    <main className="mx-auto max-w-2xlpy-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex items-center gap-3">
        <h1
          className="text-2xl font-bold tracking-tight text-slate-800
            dark:text-foreground"
        >
          Categories
        </h1>
      </div>
      <div className="max-w-xl">
        <DailyChecklistCategoryList />
      </div>
    </main>
  );
}
