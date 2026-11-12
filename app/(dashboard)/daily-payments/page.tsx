import { createSupabaseServer } from "@/lib/supabase/server";
import { logPageView } from "@/lib/audit";
import { DailyPaymentsView } from "@/components/components-2/dashboard/daily-payments-view";
import { loadDayPayments } from "@/lib/dashboard/day-payments";

const TZ = "Asia/Manila";

export default async function DailyPaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  await logPageView("/daily-payments");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") && params.date! <= today;
  const date = valid ? params.date! : today;

  const supabase = await createSupabaseServer();
  const payments = await loadDayPayments(supabase, date);

  return (
    <DailyPaymentsView
      key={date}
      payments={payments}
      date={date}
      today={today}
    />
  );
}
