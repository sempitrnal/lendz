import { NextRequest, NextResponse } from "next/server";
import { markOverdueSchedules } from "@/lib/mark-overdue-schedules";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await markOverdueSchedules();
  return NextResponse.json(result);
}
