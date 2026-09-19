"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useOnline } from "@/hooks/use-online";

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // how often to check while app is open
const LAST_SYNC_HASH_KEY = "lendz-offline-sync-hash";

const STATIC_ROUTES = [
  "/offline",
  "/",
  "/login",
  "/dashboard",
  "/borrowers",
  "/accounts",
  "/categories",
  "/calendar",
  "/audit",
  "/deleted",
  "/due-this-month",
  "/next-collection",
  "/settings",
  "/upcoming",
  "/daily-checklist",
  "/daily-checklist/categories",
  "/test-account",
];

function hashUrlList(urls: string[]): string {
  const joined = urls.join("|");
  let hash = 5381;
  for (let i = 0; i < joined.length; i++) {
    hash = ((hash << 5) + hash + joined.charCodeAt(i)) | 0;
  }
  return String(hash);
}

function postToWorker(message: Record<string, unknown>) {
  navigator.serviceWorker.ready
    .then((reg) => reg.active?.postMessage(message))
    .catch(() => {});
}

export function OfflineSyncManager({ enabled }: { enabled: boolean }) {
  const isOnline = useOnline();
  const pendingHash = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !isOnline) return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    // The SW marks a prefetch pass done only when its persisted queue is
    // empty — until then each tick re-posts the list and the drain resumes.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PREFETCH_DONE" && event.data.hash) {
        localStorage.setItem(LAST_SYNC_HASH_KEY, String(event.data.hash));
        if (pendingHash.current === event.data.hash) {
          pendingHash.current = null;
        }
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    const tick = async () => {
      // Flush the mutation outbox and resume any interrupted prefetch pass
      postToWorker({ type: "REPLAY_OUTBOX" });
      postToWorker({ type: "RESUME_PREFETCH" });

      try {
        const [{ data: borrowers }, { data: accounts }, { data: categories }] =
          await Promise.all([
            supabase.from("borrowers").select("id").is("deleted_at", null),
            supabase.from("accounts").select("id"),
            supabase.from("categories").select("id"),
          ]);
        if (cancelled) return;

        const urls = [
          ...STATIC_ROUTES,
          "/api/borrowers",
          ...(borrowers ?? []).flatMap((b: { id: string }) => [
            `/borrowers/${b.id}`,
            `/api/borrowers/${b.id}/details`,
          ]),
          ...(accounts ?? []).map((a: { id: string }) => `/accounts/${a.id}`),
          ...(categories ?? []).map(
            (c: { id: string }) => `/categories/${c.id}`,
          ),
        ];

        // Prefetch only when the route list changed (new entity or route).
        // Visited pages refresh themselves via the SW's network-first
        // strategy, so periodic full recaches would just burn Supabase
        // requests re-rendering pages nobody looks at.
        const listHash = hashUrlList(urls);
        if (localStorage.getItem(LAST_SYNC_HASH_KEY) === listHash) return;

        pendingHash.current = listHash;
        postToWorker({ type: "PREFETCH_URLS", urls, hash: listHash });
      } catch {
        // Queries failed — retry on next tick
      }
    };

    tick();
    const interval = setInterval(tick, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [enabled, isOnline]);

  return null;
}
