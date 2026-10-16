"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useOnline } from "@/hooks/use-online";
import { warmChecklistCache } from "@/lib/checklist/offline-cache";

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // how often to check while app is open
const LAST_SYNC_HASH_KEY = "lendz-offline-sync-hash";
/** The app version the cached pages were last downloaded for. */
const SYNCED_BUILD_KEY = "lendz-offline-synced-build";
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

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
  /** True while a pass that must replace old-build pages is outstanding. */
  const needsForce = useRef(false);

  useEffect(() => {
    if (!enabled || !isOnline) return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    // The SW marks a prefetch pass done only when its persisted queue is
    // empty — until then each tick re-posts the list and the drain resumes.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PREFETCH_DONE" && event.data.hash) {
        // A worker from before this build ignores `force`, so its "done"
        // doesn't count: leave it unrecorded and the next tick asks again.
        if (needsForce.current && !event.data.forced) return;
        localStorage.setItem(LAST_SYNC_HASH_KEY, String(event.data.hash));
        localStorage.setItem(SYNCED_BUILD_KEY, BUILD_ID);
        needsForce.current = false;
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
      void warmChecklistCache().catch(() => {});

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
        // The build is part of the hash so a new deploy always starts a pass,
        // and `force` makes that pass replace pages cached by the old build.
        const listHash = hashUrlList([BUILD_ID, ...urls]);
        if (
          localStorage.getItem(LAST_SYNC_HASH_KEY) === listHash &&
          localStorage.getItem(SYNCED_BUILD_KEY) === BUILD_ID
        ) {
          return;
        }

        pendingHash.current = listHash;
        const force = localStorage.getItem(SYNCED_BUILD_KEY) !== BUILD_ID;
        needsForce.current = force;
        postToWorker({ type: "PREFETCH_URLS", urls, hash: listHash, force });
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
