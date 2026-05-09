import { createSupabaseServer } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import BackButton from "@/components/back-button";

type AccountRow = {
  id: string;
  borrower_id: string;
  type: string;
  status: string;
  principal_amount: number | null;
  interest_rate: number | null;
  term_months: number | null;
  payment_frequency: string | null;
  created_at: string;
};

type BorrowerRow = {
  id: string;
  first_name: string;
  last_name: string;
};

type PaymentScheduleRow = {
  id: string;
  account_id: string;
  due_date: string;
  amount_due: number | null;
  status: string;
};

type AccountDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AccountDetailPage({
  params,
}: AccountDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select(
      "id, borrower_id, type, status, principal_amount, interest_rate, term_months, payment_frequency, created_at"
    )
    .eq("id", id)
    .single();

  if (accountError || !account) {
    notFound();
  }

  const { data: borrower } = await supabase
    .from("borrowers")
    .select("id, first_name, last_name")
    .eq("id", account.borrower_id)
    .single<BorrowerRow>();

  const { data: schedulesData } = await supabase
    .from("payment_schedules")
    .select("id, account_id, due_date, amount_due, status")
    .eq("account_id", account.id)
    .order("due_date", { ascending: true });

  const schedules = (schedulesData ?? []) as PaymentScheduleRow[];
  const accountRow = account as AccountRow;

  return (
    <div className="">
      <div className="mb-6">
        <BackButton
          fallbackHref={`/borrowers/${accountRow.borrower_id}`}
          className="mb-10"
        />
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-sm text-gray-500">
          View account details and payment schedules
        </p>
      </div>

      <article className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold capitalize">
              {accountRow.type.replace("_", " ")}
            </h2>
            <p className="text-sm text-gray-500">
              Borrower:{" "}
              {borrower
                ? `${borrower.first_name} ${borrower.last_name}`
                : "Unknown borrower"}
            </p>
          </div>
          <div className="text-right text-sm">
            <p>
              Status:{" "}
              <span className="font-medium capitalize">{accountRow.status}</span>
            </p>
            <p>
              Principal:{" "}
              <span className="font-medium">
                ₱{Number(accountRow.principal_amount ?? 0).toLocaleString()}
              </span>
            </p>
            <p>
              Interest:{" "}
              <span className="font-medium">{accountRow.interest_rate ?? 0}%</span>
            </p>
            <p>
              Term/Frequency:{" "}
              <span className="font-medium">
                {accountRow.term_months ?? 0} /{" "}
                {accountRow.payment_frequency ?? "-"}
              </span>
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-900 bg-white shadow-[6px_6px_0px_0px_#1e293b]">
          <div className="border-b border-slate-900 bg-green-300 px-4 py-2 text-sm font-black lowercase tracking-wide text-slate-900">
            Payment schedules
          </div>
          {schedules.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-600">
              No payment schedules yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-900">
                <thead className="bg-slate-100">
                  <tr className="border-b border-slate-900">
                    <th className="border-r border-slate-900 px-4 py-2 font-black lowercase tracking-wide">
                      Due date
                    </th>
                    <th className="border-r border-slate-900 px-4 py-2 font-black lowercase tracking-wide">
                      Amount due
                    </th>
                    <th className="px-4 py-2 font-black lowercase tracking-wide">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule) => (
                    <tr key={schedule.id} className="border-b border-slate-900 last:border-b-0">
                      <td className="border-r border-slate-900 px-4 py-2">
                        {new Date(schedule.due_date).toLocaleDateString()}
                      </td>
                      <td className="border-r border-slate-900 px-4 py-2">
                        ₱{Number(schedule.amount_due ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 font-medium capitalize">
                        {schedule.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
