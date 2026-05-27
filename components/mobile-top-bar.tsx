"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const ROOT_PATHS = ["/dashboard", "/borrowers", "/categories", "/daily-checklist"];

export default function MobileTopBar() {
  const pathname = usePathname();
  const router = useRouter();

  const isRoot = ROOT_PATHS.some((p) => pathname === p);
  if (isRoot || pathname === "/login") return null;

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-40 flex h-10 items-center gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur sm:hidden print:hidden">
      <button
        type="button"
        onClick={handleBack}
        aria-label="Go back"
        className="flex items-center gap-1.5 rounded-lg border border-slate-900 bg-white px-2 py-1 text-xs font-black shadow-[2px_2px_0px_0px_#0f172a] transition active:shadow-none"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2.5} />
        back
      </button>
    </div>
  );
}
