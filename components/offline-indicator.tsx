"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CloudUpload, SignalLow, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useOnline } from "@/hooks/use-online";
import { useConnectionQuality } from "@/lib/offline/connection";
import { getPendingOutboxCount } from "@/lib/offline/outbox";

export function OfflineIndicator() {
  const isOnline = useOnline();
  const quality = useConnectionQuality();
  const reduceMotion = useReducedMotion();
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
      } else if (
        data?.type === "PREFETCH_DONE" ||
        data?.type === "PREFETCH_PAUSED"
      ) {
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

  // What the pill says, most urgent first.
  const offline = !isOnline || quality === "offline";
  const content = offline
    ? {
        key: "offline",
        icon: <WifiOff className="size-3.5" />,
        text: `Offline${
          pending > 0
            ? ` — ${pending} change${pending === 1 ? "" : "s"} queued`
            : " — cached data"
        }`,
      }
    : quality === "slow"
      ? {
          key: "slow",
          icon: <SignalLow className="size-3.5" />,
          text:
            pending > 0
              ? `Slow connection — ${pending} change${pending === 1 ? "" : "s"} queued`
              : "Slow connection — using saved data",
        }
      : pending > 0
        ? {
            key: "syncing",
            icon: <CloudUpload className="size-3.5" />,
            text: `Syncing ${pending} change${pending === 1 ? "" : "s"}…`,
          }
        : caching
          ? {
              key: "caching",
              icon: <CloudUpload className="size-3.5" />,
              text: `Caching pages ${caching.done}/${caching.total}…`,
            }
          : null;

  // Appears and leaves with a soft slide, and the words crossfade as the state
  // changes, so a connection that wobbles never makes the pill jump.
  return (
    <AnimatePresence>
      {content && (
        <motion.div
          key="status-pill"
          role="status"
          layout
          initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={
            reduceMotion
              ? undefined
              : {
                  opacity: 0,
                  y: 10,
                  scale: 0.97,
                  transition: { duration: 0.2 },
                }
          }
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed bottom-16 right-4 z-50 flex items-center gap-2
            overflow-hidden rounded-full border-2 border-slate-900 bg-amber-100
            px-3 py-1.5 text-xs font-bold text-slate-900
            shadow-[3px_3px_0px_0px_#0f172a] sm:bottom-4"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={content.key}
              className="flex items-center gap-2"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {content.icon}
              <span>{content.text}</span>
            </motion.span>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
