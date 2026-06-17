"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function ResetCacheButton() {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const res = await fetch("/api/reset-cache");
      if (res.ok) {
        toast.success("Cache cleared");
      } else {
        toast.error("Failed to clear cache");
      }
    } catch {
      toast.error("Failed to clear cache");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleReset}
      disabled={isResetting}
      className="dark:border-border dark:bg-card dark:hover:bg-muted
        dark:text-foreground inline-flex items-center gap-1.5 rounded-lg
        border-2 border-slate-900 bg-white px-3 py-1.5 text-xs font-bold
        text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
    >
      {isResetting ? "resetting…" : "reset cache"}
    </button>
  );
}
