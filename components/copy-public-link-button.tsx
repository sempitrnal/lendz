"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

export function CopyPublicLinkButton({ accountId }: { accountId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}/accounts/${accountId}/view`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="dark:border-border flex items-center gap-1.5 rounded border-2 border-slate-900 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-900 shadow-[2px_2px_0px_0px_#0f172a] transition hover:bg-slate-50 active:translate-y-px active:shadow-none dark:bg-card dark:text-foreground dark:hover:bg-muted"
      title="Copy public view link"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-600" />
      ) : (
        <Link2 className="size-3.5" />
      )}
      <span>{copied ? "Copied!" : "Public link"}</span>
    </button>
  );
}
