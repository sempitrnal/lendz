import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getNextCollectionPageData } from "@/lib/cache/next-collection";
import { remainingOnInstallment } from "@/lib/payment-schedule/schedule-balances";
import NextCollectionPanel from "@/components/dashboard/next-collection-panel";

type BorrowerRef = {
  id: string;
  first_name: string;
  last_name: string;
  borrower_categories?: Array<{
    category:
      | { id: string; name: string; color: string | null }
      | Array<{ id: string; name: string; color: string | null }>
      | null;
  }>;
};

export default async function NextCollectionPage() {
  const {
    nextCollectionDate,
    nextCollectionTotal,
    nextCollectionSchedules,
    accountsById,
    borrowersById,
  } = await getNextCollectionPageData();

  const borrowerCategoryMeta = (borrower?: BorrowerRef | null) => {
    const entries =
      borrower?.borrower_categories
        ?.flatMap((row) => {
          const category = row.category;
          if (!category) return [];
          return Array.isArray(category) ? category : [category];
        })
        .filter(Boolean) ?? [];

    const label =
      entries.length > 0
        ? entries.map((entry) => entry.name).filter(Boolean).join(" / ")
        : "uncategorized";
    const color = entries.find((entry) => entry.color)?.color ?? null;
    return { label, color };
  };

  const nextCollectionRows = (() => {
    const grouped = new Map<
      string,
      {
        borrowerId: string | null;
        name: string;
        category: string;
        categoryColor: string | null;
        schedules: Array<{ id: string; amountDue: number | null; amount: number }>;
      }
    >();

    for (const schedule of nextCollectionSchedules) {
      const account = accountsById.get(schedule.account_id);
      const borrower = account ? borrowersById.get(account.borrower_id) : null;
      const borrowerId = borrower?.id ?? null;
      const key = borrowerId ?? `unknown-${schedule.account_id}`;

      const existing = grouped.get(key);
      if (!existing) {
        const categoryMeta = borrowerCategoryMeta(borrower);
        grouped.set(key, {
          borrowerId,
          name: borrower
            ? `${borrower.first_name} ${borrower.last_name}`
            : "Unknown borrower",
          category: categoryMeta.label,
          categoryColor: categoryMeta.color,
          schedules: [],
        });
      }

      grouped.get(key)!.schedules.push({
        id: schedule.id,
        amountDue: schedule.amount_due,
        amount: remainingOnInstallment(schedule),
      });
    }

    return Array.from(grouped.entries()).map(([key, row]) => {
      const amount = row.schedules.reduce((sum, s) => sum + s.amount, 0);
      return {
        id: `${key}-${nextCollectionDate ?? "none"}`,
        borrowerId: row.borrowerId,
        name: row.name,
        amount,
        amounts: row.schedules.map((s) => s.amount),
        category: row.category,
        categoryColor: row.categoryColor,
        schedules: row.schedules,
      };
    });
  })();

  return (
    <main className="mx-auto w-full max-w-5xl px-1 py-2 sm:px-0">
      <div className="mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          back to dashboard
        </Link>
      </div>

      <NextCollectionPanel
        nextCollectionDate={nextCollectionDate}
        nextCollectionTotal={nextCollectionTotal}
        entries={nextCollectionRows}
      />
    </main>
  );
}
