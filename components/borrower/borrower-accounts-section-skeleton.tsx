export default function BorrowerAccountsSectionSkeleton() {
  return (
    <div
      className="rounded-lg border bg-white p-6 shadow-sm"
      aria-busy="true"
      aria-label="Loading accounts"
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 animate-pulse rounded-md bg-slate-200" />
          <div className="h-4 w-48 animate-pulse rounded-md bg-slate-100" />
        </div>
        <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
      </div>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex gap-2 rounded-xl border border-slate-100 p-4"
          >
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="space-y-2 text-right">
              <div className="ml-auto h-5 w-24 animate-pulse rounded bg-slate-200" />
              <div className="ml-auto h-4 w-20 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
