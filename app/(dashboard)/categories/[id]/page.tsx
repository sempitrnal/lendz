import AssignBorrower from "@/components/category/assign-borrower";
import CategoryBorrowersGrid from "@/components/category/category-borrowers-grid";
import { getCategoryDetailPageData } from "@/lib/cache/category-detail";
import type { Borrower } from "@/components/borrower/borrower-list";

const peso = (v: number) => `₱${Math.round(v).toLocaleString()}`;

/** "2026-11-08" → "Nov 8". */
const shortDate = (date: string) =>
  new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

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
  const color = category?.color ?? "#94a3b8";

  const chips = [
    `${typedBorrowers.length} borrower${typedBorrowers.length === 1 ? "" : "s"}`,
    `${borrowersWithAccountsCount} with accounts`,
    nextCollectionDate
      ? `next ${shortDate(nextCollectionDate)} · ${peso(nextCollectionTotal)}`
      : "nothing due next",
  ];

  return (
    <div className="pb-16">
      {/* The green band; the search above it is the mobile top bar. */}
      <div
        data-settle-group="band"
        className="relative -mt-16 px-4 pt-[4.75rem] pb-14 text-white sm:mt-0
          sm:px-6 sm:pt-6"
      >
        <div
          aria-hidden="true"
          data-nav-band
          className="band-bg absolute inset-0 rounded-b-3xl"
        />
        <div className="relative z-20 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full ring-2 ring-white/70"
              style={{ backgroundColor: color }}
            />
            <p className="truncate text-xs font-bold tracking-wider uppercase">
              {category?.name ?? "Category"}
            </p>
          </div>
          <AssignBorrower
            initialAssigned={typedBorrowers}
            categoryId={categoryId}
            categoryName={category?.name}
            categoryColor={category?.color}
            key={categoryId}
          />
        </div>
        <div className="relative z-20 mt-4">
          <p className="text-xs font-semibold opacity-80">Left to collect</p>
          <p
            className="text-[40px] leading-tight font-black tracking-tight
              tabular-nums"
          >
            {peso(moneyToCollect)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip}
                className="rounded-full bg-white/20 px-2.5 py-1 text-[11px]
                  font-semibold"
              >
                {chip}
              </span>
            ))}
            {overdueCount > 0 && (
              <span
                className="rounded-full bg-white px-2.5 py-1 text-[11px]
                  font-bold text-rose-600"
              >
                {overdueCount} overdue · {peso(overdueTotal)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div data-settle className="relative z-10 -mt-8 px-3 sm:px-6">
        {typedBorrowers.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-1
              rounded-3xl border border-border bg-card py-16 shadow-sm"
          >
            <p className="text-sm font-semibold text-muted-foreground">
              No borrowers in this category yet
            </p>
            <p className="text-xs text-muted-foreground/70">
              Tap + to assign some.
            </p>
          </div>
        ) : (
          <CategoryBorrowersGrid
            borrowers={typedBorrowers}
            borrowerAccountCountById={borrowerAccountCountById}
            borrowerNextCollectionById={borrowerNextCollectionById}
          />
        )}
      </div>
    </div>
  );
}
