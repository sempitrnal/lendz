import type {
  BorrowerNextData,
  ManualAccount,
  NextCollectionItem,
} from "@/lib/checklist/labels";
import { overdueCutoffDateValue } from "@/lib/checklist/dates";

export type BorrowerDetailsPayload = {
  accounts: Array<Record<string, unknown>>;
  metrics: Record<string, Record<string, unknown>>;
};

export function mapBorrowerNextAmounts(
  data: BorrowerDetailsPayload,
  overdueCutoff: string,
): BorrowerNextData {
  const items: NextCollectionItem[] = [];
  const manualAccounts: ManualAccount[] = [];
  for (const a of data.accounts) {
    if (a.type !== "loan" && a.type !== "cash_advance") continue;
    const isManual = a.schedule_mode === "manual";
    if (isManual && a.status === "pending") continue;
    const m = data.metrics[a.id as string];
    const collections =
      (m?.dueCollections as NextCollectionItem[] | undefined) ?? [];
    if (isManual) {
      const remaining = Number(m?.amountLeftToPay ?? 0);
      if (remaining > 0) {
        const open = collections.find((c) => Number(c.amount) > 0);
        manualAccounts.push({
          id: String(a.id),
          type: String(a.type),
          paid: Number(m?.totalPaid ?? 0),
          remaining,
          release_date: (a.release_date as string | null) ?? null,
          ...(a.interest_type === "rolling"
            ? {
                rolling: {
                  interestRate: Number(a.interest_rate ?? 0),
                  open: open
                    ? {
                        id: String(open.id),
                        due_date: String(open.due_date).slice(0, 10),
                        amount: Number(open.amount),
                      }
                    : null,
                },
              }
            : {}),
        });
      }
    }
    for (const c of collections) {
      const amount = Number(c.amount ?? 0);
      const due_date = String(c.due_date ?? "").slice(0, 10);
      if (amount <= 0 || !due_date) continue;
      items.push({
        id: String((c as { id?: unknown }).id ?? ""),
        due_date,
        amount,
        type: String(a.type ?? ""),
        ...(isManual ? { manual: true } : {}),
      });
    }
  }
  items.sort((a, b) => {
    const overdueDiff =
      (a.due_date < overdueCutoff ? 0 : 1) -
      (b.due_date < overdueCutoff ? 0 : 1);
    if (overdueDiff !== 0) return overdueDiff;
    const byDate = a.due_date.localeCompare(b.due_date);
    if (byDate !== 0) return byDate;
    return a.type.localeCompare(b.type);
  });
  return { items, manualAccounts };
}

export async function fetchBorrowerNextAmounts(
  borrowerId: string,
): Promise<BorrowerNextData> {
  const empty: BorrowerNextData = { items: [], manualAccounts: [] };
  try {
    const res = await fetch(`/api/borrowers/${borrowerId}/details`);
    if (!res.ok) return empty;
    const data = (await res.json()) as BorrowerDetailsPayload;
    return mapBorrowerNextAmounts(data, overdueCutoffDateValue());
  } catch {
    return empty;
  }
}
