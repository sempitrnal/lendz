"use client";

import { useEffect, useState } from "react";
import { useOnline } from "@/hooks/use-online";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const isOnline = useOnline();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isOnline) return null;

  return (
    <div className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 print:hidden">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You&apos;re offline — browsing cached data (read-only)</span>
    </div>
  );
}
