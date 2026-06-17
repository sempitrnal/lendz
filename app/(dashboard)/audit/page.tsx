import { createSupabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import type { AuditAction } from "@/lib/audit";

type AuditLog = {
  id: string;
  created_at: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  account_id: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
};

const ACTION_STYLES: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  "schedule.payment_applied": {
    label: "Payment",
    bg: "bg-emerald-100",
    text: "text-emerald-800",
  },
  "schedule.status_changed": {
    label: "Status",
    bg: "bg-sky-100",
    text: "text-sky-800",
  },
  "schedule.batch_paid": {
    label: "Batch Paid",
    bg: "bg-violet-100",
    text: "text-violet-800",
  },
  "schedule.payment_deleted": {
    label: "Payment Del.",
    bg: "bg-red-100",
    text: "text-red-800",
  },
  "schedule.deleted": {
    label: "Sched. Del.",
    bg: "bg-red-100",
    text: "text-red-800",
  },
  "schedule.added": {
    label: "Sched. Added",
    bg: "bg-lime-100",
    text: "text-lime-800",
  },
  "account.created": {
    label: "Account +",
    bg: "bg-lime-100",
    text: "text-lime-800",
  },
  "account.updated": {
    label: "Account Edit",
    bg: "bg-amber-100",
    text: "text-amber-800",
  },
  "account.deleted": {
    label: "Account Del.",
    bg: "bg-red-100",
    text: "text-red-800",
  },
  "borrower.created": {
    label: "Borrower +",
    bg: "bg-lime-100",
    text: "text-lime-800",
  },
  "borrower.updated": {
    label: "Borrower Edit",
    bg: "bg-amber-100",
    text: "text-amber-800",
  },
  "borrower.deleted": {
    label: "Borrower Del.",
    bg: "bg-red-100",
    text: "text-red-800",
  },
};

function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const filterAction = params.action ?? "";
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  const sb = await createSupabaseServer();
  let query = sb
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (filterAction) {
    query = query.eq("action", filterAction);
  }

  const { data, count } = await query;
  const logs = (data ?? []) as AuditLog[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));

  const actionOptions = Object.entries(ACTION_STYLES).map(([k, v]) => ({
    value: k,
    label: v.label,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8">
      <div className="mb-6 flex flex-col gap-1">
        <h1
          className="text-2xl font-black uppercase tracking-tight
            text-slate-600"
        >
          Audit Trail
        </h1>
        <p className="text-sm text-slate-500">
          {count ?? 0} total event{count !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/audit"
          className={`rounded-md border-2 px-2.5 py-1 text-[11px] font-black
            uppercase tracking-wide transition ${
              !filterAction
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-600 hover:border-slate-900"
            }`}
        >
          All
        </Link>
        {actionOptions.map((opt) => (
          <Link
            key={opt.value}
            href={`/audit?action=${opt.value}`}
            className={`rounded-md border-2 px-2.5 py-1 text-[11px] font-black
            uppercase tracking-wide transition ${
              filterAction === opt.value
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-600 hover:border-slate-900"
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {/* Log list */}
      {logs.length === 0 ? (
        <div
          className="rounded-xl border-2 border-dashed border-slate-300 px-6
            py-16 text-center text-sm text-slate-400"
        >
          No audit events yet.
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="flex flex-col gap-2 sm:hidden">
            {logs.map((log) => {
              const style = ACTION_STYLES[log.action] ?? {
                label: log.action,
                bg: "bg-slate-100",
                text: "text-slate-700",
              };
              return (
                <div
                  key={log.id}
                  className="rounded-xl border-2 border-slate-900 bg-white p-3
                    shadow-[3px_3px_0px_0px_#0f172a]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-block shrink-0 rounded-md border px-2
                        py-0.5 text-[10px] font-black uppercase tracking-wide
                        ${style.bg} ${style.text}`}
                    >
                      {style.label}
                    </span>
                    {log.account_id ? (
                      <Link
                        href={`/accounts/${log.account_id}`}
                        className="shrink-0 rounded border border-slate-300
                          px-1.5 py-0.5 text-[11px] font-mono text-slate-500
                          hover:border-slate-900 hover:text-slate-600"
                      >
                        {log.account_id.slice(0, 8)}…
                      </Link>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {log.description}
                  </p>
                  <p className="mt-1 text-[11px] tabular-nums text-slate-400">
                    {formatTs(log.created_at)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div
            className="hidden overflow-hidden rounded-xl border-2
              border-slate-900 shadow-[4px_4px_0px_0px_#0f172a] sm:block"
          >
            <table className="w-full text-sm">
              <thead className="border-b-2 border-slate-900 bg-slate-100">
                <tr>
                  <th
                    className="px-4 py-2.5 text-left text-[10px] font-black
                      uppercase tracking-wide text-slate-600"
                  >
                    Time
                  </th>
                  <th
                    className="px-4 py-2.5 text-left text-[10px] font-black
                      uppercase tracking-wide text-slate-600"
                  >
                    Action
                  </th>
                  <th
                    className="px-4 py-2.5 text-left text-[10px] font-black
                      uppercase tracking-wide text-slate-600"
                  >
                    Description
                  </th>
                  <th
                    className="px-4 py-2.5 text-left text-[10px] font-black
                      uppercase tracking-wide text-slate-600"
                  >
                    Account
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {logs.map((log) => {
                  const style = ACTION_STYLES[log.action] ?? {
                    label: log.action,
                    bg: "bg-slate-100",
                    text: "text-slate-700",
                  };
                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td
                        className="whitespace-nowrap px-4 py-3 text-xs
                          tabular-nums text-slate-500"
                      >
                        {formatTs(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5
                            text-[10px] font-black uppercase tracking-wide
                            ${style.bg} ${style.text}`}
                        >
                          {style.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        {log.description}
                      </td>
                      <td className="px-4 py-3">
                        {log.account_id ? (
                          <Link
                            href={`/accounts/${log.account_id}`}
                            className="rounded border border-slate-300 px-1.5
                              py-0.5 text-[11px] font-mono text-slate-500
                              hover:border-slate-900 hover:text-slate-600"
                          >
                            {log.account_id.slice(0, 8)}…
                          </Link>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-4 text-center text-xs text-slate-400">
        Showing latest {logs.length} of {count ?? 0} event
        {count !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
