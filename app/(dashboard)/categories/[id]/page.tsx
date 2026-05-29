import BackButton from "@/components/back-button";
import AssignBorrower from "@/components/category/assign-borrower";
import CategoryBorrowersGrid from "@/components/category/category-borrowers-grid";
import { getCategoryDetailPageData } from "@/lib/cache/category-detail";
import { isDarkColor } from "@/lib/utils";
import type { Borrower } from "@/components/borrower/borrower-list";

export default async function CategoryDetailView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: categoryId } = await params;
  const {
    category,
    borrowers,
    borrowersWithAccountsCount,
    moneyToCollect,
    nextCollectionDate,
    nextCollectionTotal,
    overdueCount,
    overdueTotal,
    borrowerAccountCountById,
    borrowerNextCollectionById,
  } = await getCategoryDetailPageData(categoryId);

  const typedBorrowers = borrowers as unknown as Borrower[];

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/categories" />
      <div className="flex justify-center md:justify-start mt-5" >
        <h1 className="text-xl text-center font-black rounded-md uppercase w-max p-2 px-4 shadow-[4px_4px_0px_0px_rgb(15_23_42/0.85)]" style={{
          backgroundColor: category?.color || '#000000',
          color: isDarkColor(category?.color || '#000000') ? '#ffffff' : '#000000'
        }} >{category?.name}</h1>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border-2 border-slate-900 bg-linear-to-br from-cyan-50 via-white to-sky-100 p-4 shadow-[4px_4px_0px_0px_#0f172a]">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
            borrowers in category
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">{typedBorrowers.length}</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">Assigned borrowers</p>
        </article>

        <article className="rounded-xl border-2 border-slate-900 bg-linear-to-br from-emerald-50 via-white to-lime-100 p-4 shadow-[4px_4px_0px_0px_#0f172a]">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
            borrowers with accounts
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {borrowersWithAccountsCount}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            With at least one account
          </p>
        </article>

        <article className="rounded-xl border-2 border-slate-900 bg-linear-to-br from-amber-50 via-white to-orange-100 p-4 shadow-[4px_4px_0px_0px_#0f172a]">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
            money to collect
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            PHP {moneyToCollect.toLocaleString()}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            Unpaid schedules in this category
          </p>
        </article>

        <article className="rounded-xl border-2 border-slate-900 bg-linear-to-br from-violet-50 via-white to-fuchsia-100 p-4 shadow-[4px_4px_0px_0px_#0f172a]">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
            next collection
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {nextCollectionDate
              ? new Date(nextCollectionDate).toLocaleDateString()
              : "none"}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            PHP {nextCollectionTotal.toLocaleString()}
          </p>
        </article>

        {overdueCount > 0 ? (
          <article className="rounded-xl border-2 border-red-900 bg-linear-to-br from-red-50 via-white to-rose-100 p-4 shadow-[4px_4px_0px_0px_#0f172a]">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
              overdue
            </p>
            <p className="mt-1 text-2xl font-black text-red-700">
              {overdueCount} due date{overdueCount === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-600">
              PHP {overdueTotal.toLocaleString()}
            </p>
          </article>
        ) : null}
      </section>

      <div>
        <h2 className="mb-3 text-lg font-black lowercase">Borrowers</h2>

        {typedBorrowers.length === 0 ? (
          <p className="text-sm text-gray-500">No borrowers assigned yet</p>
        ) : (
          <CategoryBorrowersGrid
            borrowers={typedBorrowers}
            borrowerAccountCountById={borrowerAccountCountById}
            borrowerNextCollectionById={borrowerNextCollectionById}
          />
        )}
      </div>
      <AssignBorrower
        initialAssigned={typedBorrowers}
        categoryId={categoryId}
        key={categoryId}
      />
    </div>
  );
}