import { useSyncExternalStore } from "react";

export type ConnectionQuality = "good" | "slow" | "offline";

/** A probe slower than this counts as a slow connection... */
export const SLOW_RTT_MS = 1500;
/** ...and once slow, it has to beat this before we call it good again. */
export const RECOVER_RTT_MS = 900;
export const PROBE_TIMEOUT_MS = 4000;
const PROBE_INTERVAL_MS = 15_000;

export type ProbeResult = { ok: boolean; ms: number; timedOut: boolean };

/** What a single probe says, before any smoothing. */
export function classifyProbe(
  current: ConnectionQuality,
  probe: ProbeResult,
  opts: { onLine?: boolean; effectiveType?: string } = {},
): ConnectionQuality {
  if (opts.onLine === false) return "offline";
  if (opts.effectiveType === "slow-2g" || opts.effectiveType === "2g") {
    return probe.ok || probe.timedOut ? "slow" : "offline";
  }
  if (!probe.ok) return probe.timedOut ? "slow" : "offline";
  // Different bars for entering and leaving "slow" so it doesn't flicker
  // around one threshold.
  const bar = current === "good" ? SLOW_RTT_MS : RECOVER_RTT_MS;
  return probe.ms >= bar ? "slow" : "good";
}

export type ConnectionState = {
  quality: ConnectionQuality;
  /** A different reading seen recently, not yet believed. */
  pending: ConnectionQuality | null;
  streak: number;
};

export const INITIAL_CONNECTION_STATE: ConnectionState = {
  quality: "good",
  pending: null,
  streak: 0,
};

/**
 * Smooths readings: a change only takes hold after two in a row, so one
 * unlucky probe doesn't flip the whole app. `immediate` skips that wait for
 * things the browser states outright (it says it's offline).
 */
export function nextConnectionState(
  state: ConnectionState,
  reading: ConnectionQuality,
  opts: { immediate?: boolean } = {},
): ConnectionState {
  if (reading === state.quality) {
    return { quality: state.quality, pending: null, streak: 0 };
  }
  if (opts.immediate) return { quality: reading, pending: null, streak: 0 };
  const streak = state.pending === reading ? state.streak + 1 : 1;
  if (streak >= 2) return { quality: reading, pending: null, streak: 0 };
  return { quality: state.quality, pending: reading, streak };
}

// --- Shared store ---

let state: ConnectionState = INITIAL_CONNECTION_STATE;
const listeners = new Set<() => void>();

function setState(next: ConnectionState) {
  const changed = next.quality !== state.quality;
  state = next;
  if (changed) listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConnectionQuality(): ConnectionQuality {
  return state.quality;
}

/**
 * Whether a server round trip is worth trying. `router.refresh()` on a dead
 * or crawling link can end in a full page reload, which throws away whatever
 * the page was in the middle of, so callers check this first.
 */
export function isConnectionGood(): boolean {
  return (
    (typeof navigator === "undefined" || navigator.onLine) &&
    state.quality === "good"
  );
}

/** The app's current idea of the connection: good, slow or offline. */
export function useConnectionQuality(): ConnectionQuality {
  return useSyncExternalStore(subscribe, getConnectionQuality, () => "good");
}

// --- Monitor (browser only) ---

async function probe(): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const started = performance.now();
  try {
    await fetch(`/api/ping?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    return { ok: true, ms: performance.now() - started, timedOut: false };
  } catch {
    return {
      ok: false,
      ms: performance.now() - started,
      timedOut: controller.signal.aborted,
    };
  } finally {
    clearTimeout(timer);
  }
}

function tellWorker(message: Record<string, unknown>) {
  navigator.serviceWorker?.ready
    .then((reg) => reg.active?.postMessage(message))
    .catch(() => {});
}

/**
 * Probes the connection now and then, keeps the shared state current, and
 * keeps the service worker informed (it queues edits and serves saved copies
 * while the connection isn't good). Returns a cleanup.
 */
export function startConnectionMonitor(): () => void {
  let stopped = false;
  let stableTimer: ReturnType<typeof setTimeout> | undefined;

  const run = async (burst = false) => {
    if (stopped || document.visibilityState === "hidden") return;
    const before = state.quality;
    const onLine = navigator.onLine;
    const effectiveType = (
      navigator as Navigator & { connection?: { effectiveType?: string } }
    ).connection?.effectiveType;

    const result = onLine
      ? await probe()
      : { ok: false, ms: 0, timedOut: false };
    if (stopped) return;
    const reading = classifyProbe(before, result, { onLine, effectiveType });
    setState(nextConnectionState(state, reading, { immediate: !onLine }));
    tellWorker({ type: "CONNECTION", quality: state.quality });

    // After a change of heart, take a second reading soon rather than
    // waiting out the whole interval.
    if (burst && state.pending) setTimeout(() => void run(false), 700);

    if (before !== "good" && state.quality === "good") {
      // Back to good: let it prove stable for a moment, then flush what was
      // queued and resume downloads.
      clearTimeout(stableTimer);
      stableTimer = setTimeout(() => {
        if (state.quality !== "good") return;
        tellWorker({ type: "REPLAY_OUTBOX" });
        tellWorker({ type: "RESUME_PREFETCH" });
      }, 1200);
    }
  };

  const onEvent = () => void run(true);
  const interval = setInterval(() => void run(false), PROBE_INTERVAL_MS);
  window.addEventListener("online", onEvent);
  window.addEventListener("offline", onEvent);
  document.addEventListener("visibilitychange", onEvent);
  const connection = (navigator as Navigator & { connection?: EventTarget })
    .connection;
  connection?.addEventListener("change", onEvent);
  void run(true);

  return () => {
    stopped = true;
    clearInterval(interval);
    clearTimeout(stableTimer);
    window.removeEventListener("online", onEvent);
    window.removeEventListener("offline", onEvent);
    document.removeEventListener("visibilitychange", onEvent);
    connection?.removeEventListener("change", onEvent);
  };
}
