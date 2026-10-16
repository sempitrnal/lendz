"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CloudUpload, SignalLow, TriangleAlert, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useOnline } from "@/hooks/use-online";
import {
  isConnectionGood,
  useConnectionQuality,
} from "@/lib/offline/connection";
import {
  clearOutbox,
  getOutboxStatus,
  retryFailedOutbox,
} from "@/lib/offline/outbox";
import { clearAllPendingAccounts } from "@/lib/offline/pending-accounts";

export function OfflineIndicator() {
  const isOnline = useOnline();
  const quality = useConnectionQuality();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [{ pending, failed }, setOutbox] = useState({ pending: 0, failed: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [caching, setCaching] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const refreshCount = useCallback(() => {
    getOutboxStatus().then(setOutbox);
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

  // Close the menu when something else is tapped.
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-queue-menu]")) {
        setMenuOpen(false);
        setConfirmClear(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  const replay = () =>
    navigator.serviceWorker?.ready
      .then((reg) => reg.active?.postMessage({ type: "REPLAY_OUTBOX" }))
      .catch(() => {});

  const retryFailed = async () => {
    await retryFailedOutbox();
    refreshCount();
    void replay();
    toast.info("Trying the stuck changes again.");
  };

  const clearQueue = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    const count = pending + failed;
    await clearOutbox();
    clearAllPendingAccounts();
    refreshCount();
    setMenuOpen(false);
    setConfirmClear(false);
    toast.success(
      `Cleared ${count} queued change${count === 1 ? "" : "s"} from this device.`,
    );
    queryClient.invalidateQueries();
    if (isConnectionGood()) router.refresh();
  };

  // What the pill says, most urgent first.
  const offline = !isOnline || quality === "offline";

  // While changes are waiting and the connection is good, keep nudging the
  // worker; a replay that lost a race or hit a blip would otherwise sit until
  // the next 15-minute check.
  useEffect(() => {
    if (pending === 0 || offline) return;
    const nudge = () => {
      if (isConnectionGood()) replay();
    };
    nudge();
    const id = window.setInterval(nudge, 8000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, offline]);
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
        : failed > 0
          ? {
              key: "failed",
              icon: <TriangleAlert className="size-3.5" />,
              text: `${failed} change${failed === 1 ? "" : "s"} couldn't sync`,
            }
          : caching
            ? {
                key: "caching",
                icon: <CloudUpload className="size-3.5" />,
                text: `Caching pages ${caching.done}/${caching.total}…`,
              }
            : null;
  // Only a pill that is about queued changes opens the menu.
  const interactive = pending > 0 || failed > 0;

  // Appears and leaves with a soft slide, and the words crossfade as the state
  // changes, so a connection that wobbles never makes the pill jump.
  return (
    <div
      data-queue-menu
      className="fixed right-4 bottom-16 z-50 flex flex-col items-end gap-2
        sm:bottom-4"
    >
      <AnimatePresence>
        {menuOpen && interactive && (
          <motion.div
            key="queue-menu"
            initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? undefined
                : { opacity: 0, y: 6, transition: { duration: 0.15 } }
            }
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="w-64 rounded-2xl border-2 border-slate-900 bg-white p-3
              text-slate-900 shadow-[3px_3px_0px_0px_#0f172a] dark:bg-slate-900
              dark:text-slate-100"
          >
            <p className="text-xs font-bold">
              {pending} waiting
              {failed > 0 ? ` · ${failed} couldn't sync` : ""}
            </p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              These edits are saved on this device and haven&apos;t reached the
              server yet.
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {pending > 0 && (
                <button
                  type="button"
                  onClick={() => void replay()}
                  className="rounded-lg border border-slate-300 px-3 py-1.5
                    text-left text-xs font-semibold hover:bg-slate-50
                    dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Sync now
                </button>
              )}
              {failed > 0 && (
                <button
                  type="button"
                  onClick={() => void retryFailed()}
                  className="rounded-lg border border-slate-300 px-3 py-1.5
                    text-left text-xs font-semibold hover:bg-slate-50
                    dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Try the stuck ones again
                </button>
              )}
              <button
                type="button"
                onClick={() => void clearQueue()}
                className={`rounded-lg border px-3 py-1.5 text-left text-xs
                font-semibold transition-colors ${
                  confirmClear
                    ? "border-rose-500 bg-rose-500 text-white"
                    : `border-rose-300 text-rose-700 hover:bg-rose-50
                      dark:border-rose-800 dark:text-rose-300
                      dark:hover:bg-rose-950/40`
                }`}
              >
                {confirmClear
                  ? `Tap again to discard ${pending + failed} change${pending + failed === 1 ? "" : "s"}`
                  : "Clear queue"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {content && (
          <motion.div
            key="status-pill"
            role={interactive ? "button" : "status"}
            tabIndex={interactive ? 0 : undefined}
            aria-expanded={interactive ? menuOpen : undefined}
            onClick={() => {
              if (!interactive) return;
              setMenuOpen((v) => !v);
              setConfirmClear(false);
            }}
            onKeyDown={(e) => {
              if (interactive && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                setMenuOpen((v) => !v);
                setConfirmClear(false);
              }
            }}
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
            className={`flex items-center gap-2 overflow-hidden rounded-full
            border-2 border-slate-900 bg-amber-100 px-3 py-1.5 text-xs font-bold
            text-slate-900 shadow-[3px_3px_0px_0px_#0f172a] ${
              interactive ? "cursor-pointer" : ""
            }`}
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
    </div>
  );
}
