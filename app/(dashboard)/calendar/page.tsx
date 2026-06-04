import CalendarPageClient from "@/components/calendar/calendar-page-client";
import { getCalendarEvents } from "@/lib/cache/calendar-events";
import { createSupabaseServer } from "@/lib/supabase/server";
import { connection } from "next/server";
import { revalidatePath, updateTag } from "next/cache";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  const [events, supabase] = await Promise.all([
    getCalendarEvents(year, month),
    createSupabaseServer(),
  ]);

  const { data: borrowersData } = await supabase
    .from("borrowers")
    .select("id, first_name, last_name")
    .order("last_name", { ascending: true });

  const borrowerIds = (borrowersData ?? []).map((b) => b.id);
  const { data: accountsData } = await supabase
    .from("accounts")
    .select("id, borrower_id, principal_amount, status")
    .in("borrower_id", borrowerIds.length ? borrowerIds : [""])
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const borrowers = (borrowersData ?? []).map((b) => ({
    id: b.id,
    first_name: b.first_name,
    last_name: b.last_name,
  }));

  const accountsByBorrower: Record<
    string,
    Array<{ id: string; principal_amount: number | null; status: string }>
  > = {};
  for (const a of accountsData ?? []) {
    const list = accountsByBorrower[a.borrower_id] ?? [];
    list.push({
      id: a.id,
      principal_amount: a.principal_amount,
      status: a.status,
    });
    accountsByBorrower[a.borrower_id] = list;
  }

  async function createCalendarEvent(formData: FormData) {
    "use server";
    const borrower_id = String(formData.get("borrower_id") ?? "");
    const account_id_raw = String(formData.get("account_id") ?? "");
    const event_date = String(formData.get("event_date") ?? "");
    const amount = Number(formData.get("amount") ?? 0);
    const title = String(formData.get("title") ?? "").trim() || null;
    const note = String(formData.get("note") ?? "").trim() || null;

    if (!borrower_id || !event_date) {
      return { error: "Borrower and date are required" };
    }

    const sb = await createSupabaseServer();
    const { error } = await sb.from("calendar_events").insert({
      borrower_id,
      account_id: account_id_raw || null,
      event_date,
      amount,
      title,
      note,
    });

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/calendar");
    revalidatePath(`/borrowers/${borrower_id}`);
    updateTag("calendar");
    return {};
  }

  async function deleteCalendarEvent(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return { error: "Event ID is required" };

    const sb = await createSupabaseServer();
    const { data: evt } = await sb
      .from("calendar_events")
      .select("borrower_id")
      .eq("id", id)
      .single();
    const { error } = await sb.from("calendar_events").delete().eq("id", id);

    if (error) return { error: error.message };

    revalidatePath("/calendar");
    if (evt?.borrower_id) revalidatePath(`/borrowers/${evt.borrower_id}`);
    updateTag("calendar");
    return {};
  }

  return (
    <CalendarPageClient
      year={year}
      month={month}
      events={events}
      borrowers={borrowers}
      accountsByBorrower={accountsByBorrower}
      createEventAction={createCalendarEvent}
      deleteEventAction={deleteCalendarEvent}
    />
  );
}
