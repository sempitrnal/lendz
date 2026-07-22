import { createSupabaseServer } from "@/lib/supabase/server";

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

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const sb = await createSupabaseServer();
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

export async function logPageView(path: string): Promise<void> {
  await logAudit({
    action: "page.viewed",
    entity_type: "page",
    entity_id: null,
    description: `Page viewed: ${path}`,
    metadata: { path },
  });
}
