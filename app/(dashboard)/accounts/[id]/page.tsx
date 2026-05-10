import { createSupabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import BackButton from "@/components/back-button";
import ScheduleStatusSubmitButton from "@/components/schedule-status-submit-button";

type AccountRow = {
  id: string;
  borrower_id: string;
  type: string;
  status: string;
  release_date: string | null;
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

const scheduleStatuses = ["pending", "paid", "overdue"] as const;
type ScheduleStatus = (typeof scheduleStatuses)[number];

function getAccountStatusClasses(status: string) {
  if (status === "paid") {
    return {
      card: "border-emerald-300 bg-emerald-50/40",
      badge: "border-emerald-600 bg-emerald-100 text-emerald-800",
    };
  }
  if (status === "overdue") {
    return {
      card: "border-rose-300 bg-rose-50/40",
      badge: "border-rose-600 bg-rose-100 text-rose-800",
    };
  }

  return {
    card: "border-slate-200 bg-white",
    badge: "border-slate-500 bg-slate-100 text-slate-700",
  };
}

function getScheduleStatusClasses(status: string) {
  if (status === "paid") {
    return {
      badge: "border-emerald-600 bg-emerald-100 text-emerald-800",
      row: "bg-emerald-50/40",
    };
  }
  if (status === "overdue") {
    return {
      badge: "border-rose-600 bg-rose-100 text-rose-800",
      row: "bg-rose-50/40",
    };
  }
  return {
    badge: "border-amber-600 bg-amber-100 text-amber-800",
    row: "bg-amber-50/40",
  };
}

export default async function AccountDetailPage({
  params,
}: AccountDetailPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select(
      "id, borrower_id, type, status, release_date, principal_amount, interest_rate, term_months, payment_frequency, created_at"
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
  const accountStatusClasses = getAccountStatusClasses(accountRow.status);

  async function updateScheduleStatus(formData: FormData) {
    "use server";
    const scheduleId = String(formData.get("scheduleId") ?? "");
    const status = String(formData.get("status") ?? "");

    if (!scheduleId || !scheduleStatuses.includes(status as ScheduleStatus)) {
      return;
    }

    const updateSupabase = await createSupabaseServer();
    await updateSupabase
      .from("payment_schedules")
      .update({ status })
      .eq("id", scheduleId)
      .select("*");


    revalidatePath(`/accounts/${accountRow.id}`);
  }

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

      <article className={`rounded-lg border p-5 shadow-sm ${accountStatusClasses.card}`}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold capitalize">
              {accountRow.type.replace("_", " ")}
            </h2>
            <p className="text-2xl">

              {borrower
                ? `${borrower.first_name} ${borrower.last_name}`
                : "Unknown borrower"}
            </p>
            <p className="text-sm text-stone-500">
              Released on {" "}
              <span className="font-medium">
                {accountRow.release_date
                  ? new Date(accountRow.release_date).toLocaleDateString()
                  : "-"}
              </span>
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="flex items-center justify-end gap-2">

              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${accountStatusClasses.badge}`}
              >
                {accountRow.status}
              </span>
            </p>
            <p className="text-lg">
              Principal:{" "}
              <span className="font-medium">
                ₱{Number(accountRow.principal_amount ?? 0).toLocaleString()}
              </span>
            </p>
            <p className="text-lg">
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
            <>
              <div className="md:hidden">
                {schedules.map((schedule) => (
                  <article
                    key={schedule.id}
                    className={`border-b border-slate-900 p-4 last:border-b-0 ${getScheduleStatusClasses(schedule.status).row
                      }`}
                  >
                    <p className="text-xs font-black lowercase tracking-wide text-slate-500">
                      Due date
                    </p>
                    <p className="font-medium">
                      {new Date(schedule.due_date).toLocaleDateString()}
                    </p>
                    <p className="mt-3 text-xs font-black lowercase tracking-wide text-slate-500">
                      Amount due
                    </p>
                    <p className="font-medium">
                      ₱{Number(schedule.amount_due ?? 0).toLocaleString()}
                    </p>
                    {/* <p className="mt-3 text-xs font-black lowercase tracking-wide text-slate-500">
                      Status
                    </p> */}
                    <p>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getScheduleStatusClasses(schedule.status).badge
                          }`}
                      >
                        {schedule.status}
                      </span>
                    </p>
                    <form action={updateScheduleStatus} className="mt-3 flex flex-wrap gap-2">
                      <input type="hidden" name="scheduleId" value={schedule.id} />
                      {scheduleStatuses.map((status) => {
                        const isActive = schedule.status === status;
                        return (
                          <ScheduleStatusSubmitButton
                            key={status}
                            status={status}
                            isActive={isActive}
                          />
                        );
                      })}
                    </form>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-left text-sm text-slate-900">
                  <thead className="bg-slate-100">
                    <tr className="border-b border-slate-900">
                      <th className="border-r border-slate-900 px-4 py-2 font-black lowercase tracking-wide">
                        Due date
                      </th>
                      <th className="border-r border-slate-900 px-4 py-2 font-black lowercase tracking-wide">
                        Amount due
                      </th>
                      <th className="border-r border-slate-900 px-4 py-2 font-black lowercase tracking-wide">
                        Status
                      </th>
                      <th className="px-4 py-2 font-black lowercase tracking-wide ">
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((schedule) => (
                      <tr
                        key={schedule.id}
                        className={`border-b border-slate-900 last:border-b-0 ${getScheduleStatusClasses(schedule.status).row
                          }`}
                      >
                        <td className="border-r border-slate-900 px-4 py-2">
                          {new Date(schedule.due_date).toLocaleDateString()}
                        </td>
                        <td className="border-r border-slate-900 px-4 py-2">
                          ₱{Number(schedule.amount_due ?? 0).toLocaleString()}
                        </td>
                        <td className="border-r border-slate-900 px-4 py-2">
                          <p className="">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getScheduleStatusClasses(schedule.status).badge
                                }`}
                            >
                              {schedule.status}
                            </span>
                          </p>

                        </td>
                        <td className="px-4 py-2">
                          <form action={updateScheduleStatus} className="mt-2 flex flex-wrap gap-2 justify-center">
                            <input type="hidden" name="scheduleId" value={schedule.id} />
                            {scheduleStatuses.map((status) => {
                              const isActive = schedule.status === status;
                              return (
                                <ScheduleStatusSubmitButton
                                  key={status}
                                  status={status}
                                  isActive={isActive}
                                />
                              );
                            })}
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </article>
    </div>
  );
}
