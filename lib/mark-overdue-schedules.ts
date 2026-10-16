import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const SHARED_TAGS = [
  "account-detail",
  "account",
  "borrower-accounts",
  "borrowers",
  "accounts-page",
  "dashboard",
  "calendar",
  "next-collection",
];

// No grace period: a pending schedule becomes overdue as soon as its
// due_date is before today (Manila), i.e. on the first run after it passes.
function overdueCutoff() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
}

export async function markOverdueSchedules() {
  const sb = createSupabaseAdmin();
  const { data: flipped, error } = await sb
    .from("payment_schedules")
    .update({ status: "overdue" })
    .eq("status", "pending")
    .lt("due_date", overdueCutoff())
    .select("account_id");

  if (error) return { flipped: 0, error: error.message };
  if (!flipped?.length) return { flipped: 0 };

  const accountIds = [...new Set(flipped.map((r) => String(r.account_id)))];
  for (const tag of SHARED_TAGS) {
    revalidateTag(tag, { expire: 0 });
  }
  for (const id of accountIds) {
    revalidateTag(`account-${id}`, { expire: 0 });
    revalidatePath(`/accounts/${id}`);
  }

  return { flipped: flipped.length };
}
