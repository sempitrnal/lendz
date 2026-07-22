"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const REALTIME_TABLES = [
  "accounts",
  "borrower_categories",
  "borrower_notes",
  "borrowers",
  "calendar_events",
  "categories",
  "daily_checklist_categories",
  "daily_checklist_items",
  "payment_schedules",
  "schedule_payments",
];

export default function RealtimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        router.refresh();
      }, 300);
    };

    const channel = supabase.channel("global-crud-realtime");

    REALTIME_TABLES.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        refresh,
      );
    });

    channel.subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [router]);

  return <>{children}</>;
}
