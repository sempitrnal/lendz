import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center  px-4">
      {/* Big stacked number */}
      <div className="relative select-none">
        <span className="block text-[160px] font-black leading-none tracking-tighter text-slate-900 sm:text-[220px]">
          404
        </span>
        {/* offset shadow layer */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-[6px] top-[6px] block text-[160px] font-black leading-none tracking-tighter text-sky-300 sm:text-[220px]"
          style={{ zIndex: -1 }}
        >
          404
        </span>
      </div>

      {/* Card */}
      <div className="mt-2 w-full max-w-sm rounded-xl border-2 border-slate-900 bg-white p-6 shadow-[6px_6px_0px_0px_#0f172a]">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Error · Page not found
        </p>
        <h1 className="mt-2 text-2xl font-black uppercase leading-tight tracking-tight text-slate-900">
          This page doesn&apos;t exist.
        </h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          The link may be broken, or the page may have been removed.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="flex items-center justify-between rounded-lg border-2 border-slate-900 bg-sky-200 px-4 py-2.5 text-sm font-black uppercase tracking-wide text-slate-900 shadow-[3px_3px_0px_0px_#0f172a] transition hover:translate-y-[-1px] hover:shadow-[3px_4px_0px_0px_#0f172a] active:translate-y-[1px] active:shadow-none"
          >
            Go to Dashboard
            <span className="text-lg leading-none">→</span>
          </Link>
          <Link
            href="/borrowers"
            className="flex items-center justify-between rounded-lg border-2 border-slate-900 bg-white px-4 py-2.5 text-sm font-black uppercase tracking-wide text-slate-900 shadow-[3px_3px_0px_0px_#0f172a] transition hover:translate-y-[-1px] hover:bg-slate-50 hover:shadow-[3px_4px_0px_0px_#0f172a] active:translate-y-[1px] active:shadow-none"
          >
            View Borrowers
            <span className="text-lg leading-none">→</span>
          </Link>
        </div>
      </div>

      {/* Bottom label */}
      <p className="mt-6 text-[10px] font-black  tracking-widest text-slate-300">
        *utangz
      </p>
    </div>
  );
}
