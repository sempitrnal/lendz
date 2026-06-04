"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useOnline } from "@/hooks/use-online";

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const LAST_SYNC_KEY = "lendz-offline-last-sync";

export function OfflineSyncManager() {
  const isOnline = useOnline();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!isOnline) return;
    if (!("serviceWorker" in navigator)) return;
    if (hasSynced.current) return;

    const lastSync = Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0);
    if (Date.now() - lastSync < SYNC_INTERVAL_MS) return;

    hasSynced.current = true;

    const run = async () => {
      const [{ data: borrowers }, { data: accounts }] = await Promise.all([
        supabase.from("borrowers").select("id").is("deleted_at", null),
        supabase.from("accounts").select("id"),
      ]);

      const urls = [
        "/dashboard",
        "/borrowers",
        "/categories",
        ...(borrowers ?? []).map((b: { id: string }) => `/borrowers/${b.id}`),
        ...(accounts ?? []).map((a: { id: string }) => `/accounts/${a.id}`),
      ];

      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage({ type: "PREFETCH_URLS", urls });

      localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    };

    run().catch(() => {
      hasSynced.current = false;
    });
  }, [isOnline]);

  return null;
}
