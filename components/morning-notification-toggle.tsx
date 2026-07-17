"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function MorningNotificationToggle() {
  const [status, setStatus] = useState<
    "loading" | "unsupported" | "denied" | "off" | "on"
  >("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    });
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });

      setStatus("on");
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return null;
  if (status === "unsupported") return null;

  return (
    <div
      className="flex items-center justify-between rounded-2xl border
        border-border/50 bg-background/60 px-4 py-3 backdrop-blur-sm"
    >
      <div className="flex items-center gap-3">
        {status === "on" ? (
          <Bell className="size-5 text-emerald-600" strokeWidth={2} />
        ) : (
          <BellOff className="size-5 text-slate-400" strokeWidth={1.75} />
        )}
        <div>
          <p
            className="text-sm font-semibold text-slate-700
              dark:text-foreground"
          >
            Morning reminder
          </p>
          <p className="text-xs text-slate-400 dark:text-muted-foreground">
            {status === "on"
              ? "You'll get a good morning at 8 AM"
              : status === "denied"
                ? "Notifications blocked by browser"
                : "Get a good morning at 8 AM"}
          </p>
        </div>
      </div>

      {status !== "denied" && (
        <button
          type="button"
          disabled={busy}
          onClick={status === "on" ? disable : enable}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold
          transition-all duration-200 disabled:opacity-50 ${
            status === "on"
              ? `bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20
                dark:text-rose-400 dark:hover:bg-rose-900/30`
              : `bg-emerald-50 text-emerald-600 hover:bg-emerald-100
                dark:bg-emerald-900/20 dark:text-emerald-400
                dark:hover:bg-emerald-900/30`
          }`}
        >
          {busy ? "…" : status === "on" ? "Turn off" : "Turn on"}
        </button>
      )}
    </div>
  );
}
