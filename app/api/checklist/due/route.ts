import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { loadDueGroups } from "@/lib/checklist/due-groups";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  // Also carry over unpaid schedules due before `date`: `back=all` for any
  // number of days, or `back=<days>` for a limit.
  const backParam = params.get("back");
  const back = backParam === "all" ? null : Math.max(0, Number(backParam) || 0);

  try {
    const supabase = await createSupabaseServer();
    const groups = await loadDueGroups(supabase, date, back);
    return NextResponse.json({ date, groups });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
