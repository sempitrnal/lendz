import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = {
  title: "Offline — Utangz",
};

export default function OfflinePage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div
        className="w-full max-w-md rounded-xl border-2 border-slate-900 bg-white
          p-6 text-center shadow-[4px_4px_0px_0px_#0f172a] dark:bg-background"
      >
        <div
          className="mx-auto flex size-12 items-center justify-center
            rounded-full border-2 border-slate-900 bg-amber-100"
        >
          <WifiOff className="size-6 text-slate-900" />
        </div>
        <h1
          className="mt-4 text-2xl font-black lowercase text-slate-600
            dark:text-foreground"
        >
          you&rsquo;re offline
        </h1>
        <p className="mt-2 text-sm text-slate-700 dark:text-muted-foreground">
          This page hasn&rsquo;t been cached yet. Pages you&rsquo;ve visited
          before are still available — reconnect to sync everything else.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg border-2 border-slate-900
            bg-emerald-300 px-4 py-2 text-sm font-bold text-slate-900
            shadow-[3px_3px_0px_0px_#0f172a] transition-transform
            hover:-translate-y-0.5"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
