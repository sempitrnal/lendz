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
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
  "schedule.status_changed": {
    label: "Status",
    bg: "bg-sky-50",
    text: "text-sky-700",
  },
  "schedule.batch_paid": {
    label: "Batch Paid",
    bg: "bg-violet-50",
    text: "text-violet-700",
  },
  "schedule.payment_deleted": {
    label: "Payment Deleted",
    bg: "bg-rose-50",
    text: "text-rose-700",
  },
  "schedule.deleted": {
    label: "Schedule Deleted",
    bg: "bg-rose-50",
    text: "text-rose-700",
  },
  "schedule.added": {
    label: "Schedule Added",
    bg: "bg-lime-50",
    text: "text-lime-700",
  },
  "account.created": {
    label: "Account Created",
    bg: "bg-lime-50",
    text: "text-lime-700",
  },
  "account.updated": {
    label: "Account Updated",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
  "account.deleted": {
    label: "Account Deleted",
    bg: "bg-rose-50",
    text: "text-rose-700",
  },
  "borrower.created": {
    label: "Borrower Created",
    bg: "bg-lime-50",
    text: "text-lime-700",
  },
  "borrower.updated": {
    label: "Borrower Updated",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
  "borrower.deleted": {
    label: "Borrower Deleted",
    bg: "bg-rose-50",
    text: "text-rose-700",
  },
  "page.viewed": {
    label: "Page View",
    bg: "bg-slate-100",
    text: "text-slate-700",
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
  } else {
    query = query.neq("action", "page.viewed");
  }

  const { data, count } = await query;
  const logs = (data ?? []) as AuditLog[];

  const trackedPagePaths = [
    "/dashboard",
    "/borrowers",
    "/due-this-month",
  ] as const;
  const pathLabels: Record<(typeof trackedPagePaths)[number], string> = {
    "/dashboard": "Dashboard",
    "/borrowers": "Borrowers",
    "/due-this-month": "Due This Month",
  };

  const pageVisitCounts = await Promise.all(
    trackedPagePaths.map((path) =>
      sb
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .eq("action", "page.viewed")
        .eq("metadata->>path", path),
    ),
  );

  const pageVisitMap = Object.fromEntries(
    trackedPagePaths.map((path, i) => [path, pageVisitCounts[i].count ?? 0]),
  ) as Record<(typeof trackedPagePaths)[number], number>;

  const actionOptions = Object.entries(ACTION_STYLES).map(([k, v]) => ({
    value: k,
    label: v.label,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8">
      <div className="mb-8 flex flex-col gap-1">
        <h1
          className="text-3xl font-semibold text-slate-800 dark:text-slate-100"
        >
          Audit trail
        </h1>
        <p className="text-sm font-medium text-slate-500">
          {count ?? 0} total event{count !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Page visit counts */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-slate-500">Page visits</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {trackedPagePaths.map((path) => (
            <div
              key={path}
              className="rounded-2xl border border-slate-200 bg-white p-5
                shadow-sm transition hover:shadow-md dark:border-slate-700/50
                dark:bg-slate-800/50"
            >
              <p className="text-xs font-medium text-slate-500">
                {pathLabels[path]}
              </p>
              <p
                className="mt-2 text-3xl font-semibold text-slate-800
                  dark:text-slate-100"
              >
                {pageVisitMap[path].toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/audit"
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition
            ${
              !filterAction
                ? `bg-slate-900 text-white shadow-sm dark:bg-slate-100
                  dark:text-slate-900`
                : `border border-slate-200 bg-white text-slate-600
                  hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700
                  dark:bg-slate-800 dark:text-slate-300
                  dark:hover:bg-slate-700/50`
            }`}
        >
          All
        </Link>
        {actionOptions.map((opt) => (
          <Link
            key={opt.value}
            href={`/audit?action=${opt.value}`}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium
            transition ${
              filterAction === opt.value
                ? `bg-slate-900 text-white shadow-sm dark:bg-slate-100
                  dark:text-slate-900`
                : `border border-slate-200 bg-white text-slate-600
                  hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700
                  dark:bg-slate-800 dark:text-slate-300
                  dark:hover:bg-slate-700/50`
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {/* Log list */}
      {logs.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-slate-200
            bg-slate-50/50 px-6 py-20 text-center text-sm font-medium
            text-slate-400"
        >
          No audit events yet.
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {logs.map((log) => {
              const style = ACTION_STYLES[log.action] ?? {
                label: log.action,
                bg: "bg-slate-100",
                text: "text-slate-700",
              };
              return (
                <div
                  key={log.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4
                    shadow-sm dark:border-slate-700/50 dark:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full
                        px-2.5 py-1 text-xs font-medium ${style.bg}
                        ${style.text}`}
                    >
                      {style.label}
                    </span>
                    {log.account_id ? (
                      <Link
                        href={`/accounts/${log.account_id}`}
                        className="shrink-0 rounded-md bg-slate-100 px-2 py-1
                          text-[11px] font-medium text-slate-600 transition
                          hover:bg-slate-200 dark:bg-slate-700/50
                          dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        {log.account_id.slice(0, 8)}…
                      </Link>
                    ) : null}
                  </div>
                  <p
                    className="mt-3 text-sm font-medium text-slate-700
                      dark:text-slate-200"
                  >
                    {log.description}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-slate-400">
                    {formatTs(log.created_at)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div
            className="hidden overflow-hidden rounded-2xl border
              border-slate-200 bg-white shadow-sm dark:border-slate-700/50
              dark:bg-slate-800/50 sm:block"
          >
            <table className="w-full text-sm">
              <thead
                className="border-b border-slate-100 bg-slate-50/80
                  dark:border-slate-700/50 dark:bg-slate-800/80"
              >
                <tr>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium
                      text-slate-500"
                  >
                    Time
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium
                      text-slate-500"
                  >
                    Action
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium
                      text-slate-500"
                  >
                    Description
                  </th>
                  <th
                    className="px-5 py-3 text-left text-xs font-medium
                      text-slate-500"
                  >
                    Account
                  </th>
                </tr>
              </thead>
              <tbody
                className="divide-y divide-slate-100 dark:divide-slate-700/50"
              >
                {logs.map((log) => {
                  const style = ACTION_STYLES[log.action] ?? {
                    label: log.action,
                    bg: "bg-slate-100",
                    text: "text-slate-700",
                  };
                  return (
                    <tr
                      key={log.id}
                      className="transition hover:bg-slate-50/60
                        dark:hover:bg-slate-700/30"
                    >
                      <td
                        className="whitespace-nowrap px-5 py-3.5 text-xs
                          tabular-nums text-slate-500"
                      >
                        {formatTs(log.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full
                            px-2.5 py-1 text-xs font-medium ${style.bg}
                            ${style.text}`}
                        >
                          {style.label}
                        </span>
                      </td>
                      <td
                        className="px-5 py-3.5 font-medium text-slate-700
                          dark:text-slate-200"
                      >
                        {log.description}
                      </td>
                      <td className="px-5 py-3.5">
                        {log.account_id ? (
                          <Link
                            href={`/accounts/${log.account_id}`}
                            className="rounded-md bg-slate-100 px-2 py-1 text-xs
                              font-medium text-slate-600 transition
                              hover:bg-slate-200 dark:bg-slate-700/50
                              dark:text-slate-300 dark:hover:bg-slate-700"
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

      <p className="mt-6 text-center text-xs font-medium text-slate-400">
        Showing latest {logs.length} of {count ?? 0} event
        {count !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
