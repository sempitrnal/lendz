"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CloudUpload, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useOnline } from "@/hooks/use-online";
import { getPendingOutboxCount } from "@/lib/offline/outbox";

export function OfflineIndicator() {
  const isOnline = useOnline();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(0);
  const [caching, setCaching] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const refreshCount = useCallback(() => {
    getPendingOutboxCount().then(setPending);
  }, []);

  useEffect(() => {
    refreshCount();

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === "OUTBOX_QUEUED") {
        refreshCount();
        toast.info("Saved offline — will sync when you're back online.");
      } else if (data?.type === "OUTBOX_RESULT") {
        refreshCount();
        if (data.synced > 0) {
          toast.success(
            `Synced ${data.synced} offline change${data.synced === 1 ? "" : "s"}.`,
          );
        }
        if (data.failed > 0) {
          toast.error(
            `${data.failed} offline change${data.failed === 1 ? "" : "s"} couldn't be synced.`,
          );
        }
        queryClient.invalidateQueries();
        router.refresh();
      } else if (data?.type === "PREFETCH_PROGRESS") {
        setCaching({ done: data.done, total: data.total });
      } else if (data?.type === "PREFETCH_DONE") {
        setCaching(null);
      }
    };

    navigator.serviceWorker?.addEventListener("message", onMessage);
    window.addEventListener("online", refreshCount);
    window.addEventListener("offline", refreshCount);

    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      window.removeEventListener("online", refreshCount);
      window.removeEventListener("offline", refreshCount);
    };
  }, [refreshCount, queryClient, router]);

  if (isOnline && pending === 0 && !caching) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 right-4 z-50 flex items-center gap-2
        rounded-full border-2 border-slate-900 bg-amber-100 px-3 py-1.5 text-xs
        font-bold text-slate-900 shadow-[3px_3px_0px_0px_#0f172a] sm:bottom-4"
    >
      {isOnline ? (
        pending === 0 && caching ? (
          <>
            <CloudUpload className="size-3.5" />
            <span>
              Caching pages {caching.done}/{caching.total}…
            </span>
          </>
        ) : (
          <>
            <CloudUpload className="size-3.5" />
            <span>
              Syncing {pending} change{pending === 1 ? "" : "s"}…
            </span>
          </>
        )
      ) : (
        <>
          <WifiOff className="size-3.5" />
          <span>
            Offline
            {pending > 0
              ? ` — ${pending} change${pending === 1 ? "" : "s"} queued`
              : " — cached data"}
          </span>
        </>
      )}
    </div>
  );
}
