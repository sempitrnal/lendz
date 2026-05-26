"use server";

import { logAudit, type AuditAction } from "@/lib/audit";

export async function logAuditAction(
  action: AuditAction,
  entityType: string,
  entityId: string | null,
  description: string,
  metadata?: Record<string, unknown>,
  accountId?: string | null
): Promise<void> {
  await logAudit({ action, entity_type: entityType, entity_id: entityId, account_id: accountId ?? null, description, metadata });
}
