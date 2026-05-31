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
  const [status, setStatus] = useState<"loading" | "unsupported" | "denied" | "off" | "on">("loading");
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
      if (permission !== "granted") { setStatus("denied"); return; }

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
    <div className="flex items-center justify-between rounded-xl border-2 border-slate-900 bg-white px-4 py-3 shadow-[3px_3px_0px_0px_#0f172a] dark:border-border dark:bg-card dark:shadow-none">
      <div className="flex items-center gap-3">
        {status === "on" ? (
          <Bell className="size-5 text-emerald-600" strokeWidth={2.5} />
        ) : (
          <BellOff className="size-5 text-slate-400" strokeWidth={2} />
        )}
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-foreground">Morning reminder</p>
          <p className="text-[11px] text-slate-500 dark:text-muted-foreground">
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
          className={`shrink-0 rounded-lg border-2 border-slate-900 px-3 py-1.5 text-xs font-black uppercase tracking-wide shadow-[2px_2px_0px_0px_#0f172a] transition active:shadow-none disabled:opacity-50 dark:border-border dark:shadow-none ${
            status === "on"
              ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/40"
              : "bg-emerald-200 text-slate-900 hover:bg-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
          }`}
        >
          {busy ? "…" : status === "on" ? "Turn off" : "Turn on"}
        </button>
      )}
    </div>
  );
}
