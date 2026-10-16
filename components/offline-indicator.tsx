"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronUp,
  CloudCheck,
  CloudUpload,
  RefreshCw,
  SignalLow,
  Trash2,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  isConnectionGood,
  useConnectionQuality,
} from "@/lib/offline/connection";
import {
  clearOutbox,
  getOutboxStatus,
  requestOutboxReplay,
  retryFailedOutbox,
} from "@/lib/offline/outbox";
import type { QueuedTask } from "@/lib/offline/outbox-labels";
import { clearAllPendingAccounts } from "@/lib/offline/pending-accounts";
import { cn } from "@/lib/utils";

type Tone = "slate" | "amber" | "sky" | "rose" | "violet";

/** Icon badge colours per state. */
const TONES: Record<Tone, string> = {
  slate: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  sky: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
};

/** Frosted surface shared with the bottom nav. */
const GLASS =
  "border border-border/70 bg-card/85 shadow-lg shadow-black/10 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70 dark:shadow-black/30";

export function OfflineIndicator() {
  const quality = useConnectionQuality();
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [{ pending, failed, tasks }, setOutbox] = useState<{
    pending: number;
    failed: number;
    tasks: QueuedTask[];
  }>({ pending: 0, failed: 0, tasks: [] });
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

  const replay = () => void requestOutboxReplay();

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
  // The connection monitor probes for real, so it outranks the browser's
  // online flag, which phones are slow to flip back.
  const offline = quality === "offline";

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
  }, [pending, offline]);
  const plural = (n: number) => (n === 1 ? "" : "s");
  const content: {
    key: string;
    tone: Tone;
    icon: React.ReactNode;
    text: string;
  } | null = offline
    ? {
        key: "offline",
        tone: "slate",
        icon: <WifiOff className="size-3.5" />,
        text:
          pending > 0
            ? `Offline · ${pending} change${plural(pending)} waiting`
            : "Offline · showing saved data",
      }
    : quality === "slow"
      ? {
          key: "slow",
          tone: "amber",
          icon: <SignalLow className="size-3.5" />,
          text:
            pending > 0
              ? `Slow connection · ${pending} waiting`
              : "Slow connection · using saved data",
        }
      : pending > 0
        ? {
            key: "syncing",
            tone: "sky",
            icon: (
              <RefreshCw
                className={cn("size-3.5", !reduceMotion && "animate-spin")}
                style={{ animationDuration: "1.6s" }}
              />
            ),
            text: `Syncing ${pending} change${plural(pending)}`,
          }
        : failed > 0
          ? {
              key: "failed",
              tone: "rose",
              icon: <TriangleAlert className="size-3.5" />,
              text: `${failed} change${plural(failed)} couldn't sync`,
            }
          : caching
            ? {
                key: "caching",
                tone: "violet",
                icon: <CloudUpload className="size-3.5" />,
                text: `Saving pages for offline · ${caching.done}/${caching.total}`,
              }
            : null;
  // Only a pill that is about queued changes opens the menu.
  const interactive = pending > 0 || failed > 0;
  const total = pending + failed;

  const toggleMenu = () => {
    if (!interactive) return;
    if (!menuOpen) refreshCount();
    setMenuOpen((v) => !v);
    setConfirmClear(false);
  };

  // Sits just above the mobile bottom nav (its height plus the safe area),
  // and in the corner on wider screens where there is no nav.
  return (
    <div
      data-queue-menu
      className="fixed right-4
        bottom-[calc(max(env(safe-area-inset-bottom),12px)+82px)] z-50 flex
        flex-col items-end gap-2 md:bottom-4 print:hidden"
    >
      <AnimatePresence>
        {menuOpen && interactive && (
          <motion.div
            key="queue-menu"
            initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? undefined
                : {
                    opacity: 0,
                    y: 6,
                    scale: 0.98,
                    transition: { duration: 0.15 },
                  }
            }
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            style={{ transformOrigin: "bottom right" }}
            className={cn(
              `w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl
              text-foreground`,
              GLASS,
            )}
          >
            <div className="flex items-start gap-3 px-4 pt-4 pb-3">
              <span
                className={cn(
                  `flex size-8 shrink-0 items-center justify-center
                  rounded-full`,
                  pending > 0 ? TONES.sky : TONES.rose,
                )}
              >
                {pending > 0 ? (
                  <CloudUpload className="size-4" />
                ) : (
                  <TriangleAlert className="size-4" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {pending > 0
                    ? `${pending} change${plural(pending)} waiting`
                    : `${failed} change${plural(failed)} couldn't sync`}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Saved on this device and sent in order once the connection is
                  good.
                </p>
              </div>
            </div>

            <ul
              className="max-h-60 overflow-y-auto border-y border-border/60
                py-1"
            >
              {tasks.map((task, i) => (
                <li
                  key={`${task.label}-${i}`}
                  className="flex items-center gap-2.5 px-4 py-2 text-[13px]"
                >
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      task.failed ? "bg-rose-500" : "bg-sky-500",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{task.label}</span>
                  {task.count > 1 && (
                    <span
                      className="shrink-0 rounded-full bg-muted px-1.5
                        text-[11px] font-medium text-muted-foreground
                        tabular-nums"
                    >
                      ×{task.count}
                    </span>
                  )}
                  {task.failed && (
                    <span
                      className="shrink-0 text-[11px] font-medium text-rose-600
                        dark:text-rose-300"
                    >
                      stuck
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2 p-3">
              {pending > 0 ? (
                <button
                  type="button"
                  onClick={replay}
                  className="inline-flex h-9 flex-1 items-center justify-center
                    gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold
                    text-primary-foreground shadow-sm transition
                    active:scale-[0.98]"
                >
                  <CloudCheck className="size-3.5" />
                  Sync now
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void retryFailed()}
                  className="inline-flex h-9 flex-1 items-center justify-center
                    gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold
                    text-primary-foreground shadow-sm transition
                    active:scale-[0.98]"
                >
                  <RefreshCw className="size-3.5" />
                  Try again
                </button>
              )}
              {pending > 0 && failed > 0 && (
                <button
                  type="button"
                  onClick={() => void retryFailed()}
                  className="inline-flex h-9 items-center justify-center
                    rounded-xl bg-muted px-3 text-xs font-semibold transition
                    hover:bg-muted/70 active:scale-[0.98]"
                >
                  Retry stuck
                </button>
              )}
              <button
                type="button"
                onClick={() => void clearQueue()}
                aria-label={
                  confirmClear ? `Discard ${total} changes` : "Clear queue"
                }
                className={cn(
                  `inline-flex h-9 items-center justify-center gap-1.5
                  rounded-xl px-3 text-xs font-semibold transition
                  active:scale-[0.98]`,
                  confirmClear
                    ? "bg-rose-600 text-white"
                    : "text-rose-600 hover:bg-rose-500/10 dark:text-rose-300",
                )}
              >
                <Trash2 className="size-3.5" />
                {confirmClear ? `Discard ${total}?` : "Clear"}
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
            onClick={toggleMenu}
            onKeyDown={(e) => {
              if (interactive && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                toggleMenu();
              }
            }}
            layout
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? undefined
                : {
                    opacity: 0,
                    y: 8,
                    scale: 0.97,
                    transition: { duration: 0.2 },
                  }
            }
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={cn(
              `flex items-center overflow-hidden rounded-full py-1 pr-3 pl-1
              text-xs font-medium text-foreground`,
              GLASS,
              interactive && "cursor-pointer active:scale-[0.98]",
            )}
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
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full",
                    TONES[content.tone],
                  )}
                >
                  {content.icon}
                </span>
                <span>{content.text}</span>
                {interactive && (
                  <ChevronUp
                    className={cn(
                      `size-3.5 text-muted-foreground transition-transform
                      duration-200`,
                      !menuOpen && "rotate-180",
                    )}
                  />
                )}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
