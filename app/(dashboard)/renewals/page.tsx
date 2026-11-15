import { connection } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { logPageView } from "@/lib/audit";
import { loadRenewals } from "@/lib/renewals-data";
import { RenewalsView } from "@/components/renewals/renewals-view";

const TZ = "Asia/Manila";

export default async function RenewalsPage() {
  await connection();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const supabase = await createSupabaseServer();
  const [groups] = await Promise.all([
    loadRenewals(supabase, today),
    logPageView("/renewals"),
  ]);
  return <RenewalsView groups={groups} />;
}
