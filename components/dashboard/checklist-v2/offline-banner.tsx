"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { useConnectionQuality } from "@/lib/offline/connection";
import { getPendingOutboxCount } from "@/lib/offline/outbox";
import { offlineBannerText } from "@/lib/checklist/offline-banner";

/**
 * Under the sticky bar while offline: saved data, or how many edits wait to
 * sync. The count is re-read when the service worker queues or replays edits
 * and whenever the connection changes. Hidden online.
 */
export function OfflineBanner() {
  const offline = useConnectionQuality() === "offline";
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    let seq = 0;
    const refresh = () => {
      const mine = ++seq;
      void getPendingOutboxCount()
        .then((n) => {
          // A newer read supersedes this one, so a slow answer can't leave a
          // stale count behind.
          if (mine === seq) setWaiting(n);
        })
        .catch(() => {});
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (type === "OUTBOX_QUEUED" || type === "OUTBOX_RESULT") refresh();
    };
    refresh();
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      seq++;
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
    // Re-read when connectivity flips so the count is fresh on both edges.
  }, [offline]);

  const text = offlineBannerText(offline, waiting);
  if (!text) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-4 mt-3 flex items-center gap-2 rounded-xl border
        border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] font-medium
        text-amber-800 dark:text-amber-300"
    >
      <CloudOff className="size-4 shrink-0" aria-hidden />
      <span>{text}</span>
    </div>
  );
}
