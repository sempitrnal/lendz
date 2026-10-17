"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useOnline } from "@/hooks/use-online";
import { warmChecklistCache } from "@/lib/checklist/offline-cache";
import { requestOutboxReplay } from "@/lib/offline/outbox";
import { readStored, writeStored } from "@/lib/offline/storage";
import { urlsToRefresh, type OfflineManifest } from "@/lib/offline/route-diff";

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // how often to check while app is open
const LAST_SYNC_HASH_KEY = "lendz-offline-sync-hash";
/** Route fingerprints of the app version the cached pages were saved from. */
const SYNCED_MANIFEST_KEY = "lendz-offline-manifest";
/** Written after each build by scripts/offline-manifest.mjs. */
const MANIFEST_URL = "/_next/static/offline-manifest.json";

/** This deploy's manifest, or null (dev, or not reachable right now). */
async function fetchManifest(): Promise<OfflineManifest | null> {
  try {
    const res = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as OfflineManifest;
    return data?.buildId && data.routes ? data : null;
  } catch {
    return null;
  }
}

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
  /** The new version a pass is updating the saved pages to, if any. */
  const pendingManifest = useRef<OfflineManifest | null>(null);

  useEffect(() => {
    if (!enabled || !isOnline) return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    // The SW marks a prefetch pass done only when its persisted queue is
    // empty — until then each tick re-posts the list and the drain resumes.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PREFETCH_DONE" && event.data.hash) {
        const manifest = pendingManifest.current;
        if (manifest) {
          // A worker from before this change ignores `refresh`, so its
          // "done" doesn't mean the pages were updated: ask again next tick.
          if (!event.data.refreshed) return;
          writeStored(SYNCED_MANIFEST_KEY, { ...manifest, assets: [] });
          pendingManifest.current = null;
        }
        localStorage.setItem(LAST_SYNC_HASH_KEY, String(event.data.hash));
        if (pendingHash.current === event.data.hash) {
          pendingHash.current = null;
        }
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    const tick = async () => {
      // Flush the mutation outbox and resume any interrupted prefetch pass
      void requestOutboxReplay();
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

        // A new app version re-downloads only the pages whose route code
        // changed (and the new JS/CSS they need); everything else keeps its
        // saved copy. Without a manifest (dev) versions aren't tracked.
        const manifest = await fetchManifest();
        if (cancelled) return;
        const synced = readStored<OfflineManifest>(SYNCED_MANIFEST_KEY);
        const newVersion =
          manifest !== null && manifest.buildId !== synced?.buildId;
        const refresh = newVersion ? urlsToRefresh(urls, manifest, synced) : [];

        // Otherwise prefetch only when the route list changed (new entity or
        // route). Visited pages refresh themselves via the SW's network-first
        // strategy, so periodic full recaches would just burn Supabase
        // requests re-rendering pages nobody looks at.
        const listHash = hashUrlList([manifest?.buildId ?? "", ...urls]);
        if (
          !newVersion &&
          localStorage.getItem(LAST_SYNC_HASH_KEY) === listHash
        ) {
          return;
        }

        pendingHash.current = listHash;
        pendingManifest.current = newVersion ? manifest : null;
        postToWorker({
          type: "PREFETCH_URLS",
          urls,
          hash: listHash,
          refresh,
          assets: manifest?.assets ?? null,
        });
      } catch {
        // Queries failed — retry on next tick
      }
    };

    tick();
    const interval = setInterval(tick, CHECK_INTERVAL_MS);

    // Backgrounding the app freezes in-flight downloads. Stop them cleanly
    // when the page is hidden (what's left stays queued) and pick the queue
    // back up the moment it's visible again.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        postToWorker({ type: "PAUSE_PREFETCH" });
      } else {
        void requestOutboxReplay();
        postToWorker({ type: "RESUME_PREFETCH" });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [enabled, isOnline]);

  return null;
}
