"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useOnline } from "@/hooks/use-online";
import { warmChecklistCache } from "@/lib/checklist/offline-cache";
import { requestOutboxReplay } from "@/lib/offline/outbox";
import { readStored, writeStored } from "@/lib/offline/storage";

/** Written after each build by scripts/offline-manifest.mjs. */
type OfflineManifest = {
  buildId: string;
  /** Every static file of the build (`/_next/static/...`). */
  assets: string[];
};

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // how often to check while app is open
const LAST_SYNC_HASH_KEY = "lendz-offline-sync-hash";
/** The app version the saved pages were last brought up to. */
const SYNCED_MANIFEST_KEY = "lendz-offline-manifest";
/**
 * The pass bringing saved pages up to a new version: its hash and build.
 * Stored (not just in memory) so a reload mid-pass still recognises its end.
 */
const PENDING_VERSION_KEY = "lendz-offline-pending-version";
const MANIFEST_URL = "/offline-manifest.json";

/** This deploy's manifest, or null (dev, or not reachable right now). */
async function fetchManifest(): Promise<OfflineManifest | null> {
  try {
    const res = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as OfflineManifest;
    return data?.buildId && Array.isArray(data.assets) ? data : null;
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
  "/daily-checklist/v2",
  "/daily-checklist/categories",
  "/test-account",
];

/** Calendar months saved for offline: two back, three ahead. */
function calendarMonthUrls(now = new Date()): string[] {
  const urls: string[] = [];
  for (let offset = -2; offset <= 3; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    urls.push(`/calendar?year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
  }
  return urls;
}

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

  useEffect(() => {
    if (!enabled || !isOnline) return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    // The SW marks a prefetch pass done only when its persisted queue is
    // empty — until then each tick re-posts the list and the drain resumes.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PREFETCH_DONE" && event.data.hash) {
        const hash = String(event.data.hash);
        const pending = readStored<{ hash: string; buildId: string }>(
          PENDING_VERSION_KEY,
        );
        // Only the pass started for the new version can mark it synced: a
        // pass from before the deploy finishing now left old pages behind.
        // A worker from before this change ignores `refresh`/`prune`, so its
        // "done" doesn't count either: ask again next tick.
        if (pending?.hash === hash) {
          if (!event.data.refreshed || !event.data.pruned) return;
          writeStored(SYNCED_MANIFEST_KEY, { buildId: pending.buildId });
          localStorage.removeItem(PENDING_VERSION_KEY);
        }
        localStorage.setItem(LAST_SYNC_HASH_KEY, hash);
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
            // Deleted accounts 404, so saving their pages is wasted work.
            supabase.from("accounts").select("id").is("deleted_at", null),
            supabase.from("categories").select("id"),
          ]);
        if (cancelled) return;

        const urls = [
          ...STATIC_ROUTES,
          ...calendarMonthUrls(),
          "/api/borrowers",
          "/api/categories",
          // Edit pages aren't saved: editing a borrower needs a connection.
          ...(borrowers ?? []).flatMap((b: { id: string }) => [
            `/borrowers/${b.id}`,
            `/api/borrowers/${b.id}/details`,
          ]),
          ...(accounts ?? []).map((a: { id: string }) => `/accounts/${a.id}`),
          ...(categories ?? []).map(
            (c: { id: string }) => `/categories/${c.id}`,
          ),
        ];

        // A new app version re-downloads every saved page (and the JS/CSS
        // they need). Each page carries the build it was saved from, and the
        // router turns a mismatch into a full reload of that old page, old
        // code and all, so none can be kept. Saved pages outside the list
        // are dropped once the pass is done. Without a manifest (dev)
        // versions aren't tracked.
        const manifest = await fetchManifest();
        if (cancelled) return;
        const synced = readStored<OfflineManifest>(SYNCED_MANIFEST_KEY);
        const newVersion =
          manifest !== null && manifest.buildId !== synced?.buildId;
        const refresh = newVersion
          ? urls.filter((url) => !url.startsWith("/api/"))
          : [];

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

        if (newVersion) {
          writeStored(PENDING_VERSION_KEY, {
            hash: listHash,
            buildId: manifest.buildId,
          });
        }
        postToWorker({
          type: "PREFETCH_URLS",
          urls,
          hash: listHash,
          refresh,
          assets: manifest?.assets ?? null,
          prune: newVersion,
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
