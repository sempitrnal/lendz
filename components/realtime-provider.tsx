"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const refreshTimerRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

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
        (payload: unknown) => {
          console.log(`[realtime] ${table} change:`, payload);
          refresh();
        },
      );
    });

    channel.subscribe((status: string, err?: Error) => {
      if (err) {
        console.error("[realtime] subscription error:", err);
      } else {
        console.log("[realtime] subscription status:", status);
      }
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    const onOnline = () => refresh();
    window.addEventListener("online", onOnline);

    // Fallback polling for pages where schedule/borrower data must stay current
    if (
      pathname === "/accounts" ||
      pathname?.startsWith("/accounts/") ||
      pathname === "/borrowers" ||
      pathname?.startsWith("/borrowers/")
    ) {
      pollRef.current = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          refresh();
        }
      }, 10000) as unknown as number;
    }

    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
      }
    };
  }, [router, pathname]);

  return <>{children}</>;
}
