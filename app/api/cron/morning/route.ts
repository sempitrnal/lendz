import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createSupabaseServer } from "@/lib/supabase/server";
import { purgeOldDeletedItems } from "@/lib/purge-deleted";
import { cookies } from "next/headers";

function initVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export async function GET(req: NextRequest) {
  await cookies();
  initVapid();
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = await createSupabaseServer();
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (!subs?.length) {
    const purge = await purgeOldDeletedItems();
    return NextResponse.json({ sent: 0, ...purge });
  }

  const payload = JSON.stringify({
    title: "Utangz 🌅",
    body: "maayong buntag pilar!",
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      ),
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  const purge = await purgeOldDeletedItems();

  return NextResponse.json({ sent, failed, ...purge });
}
