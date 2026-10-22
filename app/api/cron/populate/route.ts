import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { manilaDate, populateDay } from "@/lib/checklist/auto-populate";

/** 6:00 AM Philippine time (22:00 UTC the day before), see vercel.json. */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = manilaDate(new Date());
  try {
    const { added } = await populateDay(createSupabaseAdmin(), date);
    return NextResponse.json({ date, added });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
