import { headers } from "next/headers";
import { after } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Sent by the service worker on its offline-sync downloads (see public/sw.js). */
export const PREFETCH_HEADER = "x-lendz-prefetch";

export type AuditAction =
  | "schedule.status_changed"
  | "schedule.payment_applied"
  | "schedule.payment_deleted"
  | "schedule.deleted"
  | "schedule.batch_paid"
  | "schedule.added"
  | "account.created"
  | "account.updated"
  | "account.activated"
  | "account.deleted"
  | "borrower.created"
  | "borrower.updated"
  | "borrower.deleted"
  | "page.viewed";

export type AuditEntry = {
  action: AuditAction;
  entity_type: string;
  entity_id?: string | null;
  account_id?: string | null;
  description: string;
  metadata?: Record<string, unknown> | null;
};

type AuditClient = Awaited<ReturnType<typeof createSupabaseServer>>;

export async function logAudit(
  entry: AuditEntry,
  client?: AuditClient,
): Promise<void> {
  try {
    const sb = client ?? (await createSupabaseServer());
    await sb.from("audit_logs").insert({
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      account_id: entry.account_id ?? null,
      description: entry.description,
      metadata: entry.metadata ?? null,
    });
  } catch {
    // Audit logging must never break the main flow
  }
}

/** Writes the audit row after the response, so the action doesn't wait on it. */
export function logAuditAfter(entry: AuditEntry): void {
  after(() => logAudit(entry));
}

export async function logPageView(path: string): Promise<void> {
  // The offline sync re-downloads pages nobody is looking at; those aren't
  // views, and logging them would add a write (and a log line) per page.
  if ((await headers()).has(PREFETCH_HEADER)) return;
  // The write goes out after the response, so it doesn't hold up the page.
  // The client is built now because cookies() can't be read inside after().
  const sb = await createSupabaseServer({ frozenCookies: true });
  after(() =>
    logAudit(
      {
        action: "page.viewed",
        entity_type: "page",
        entity_id: null,
        description: `Page viewed: ${path}`,
        metadata: { path },
      },
      sb,
    ),
  );
}
