export default function Loading() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span
            className="size-2.5 animate-bounce rounded-full bg-slate-800
              [animation-delay:-0.3s] dark:bg-slate-200"
          />
          <span
            className="size-2.5 animate-bounce rounded-full bg-slate-800
              [animation-delay:-0.15s] dark:bg-slate-200"
          />
          <span
            className="size-2.5 animate-bounce rounded-full bg-slate-800
              dark:bg-slate-200"
          />
        </div>
        <p
          className="text-xs font-black lowercase tracking-wide text-slate-400
            dark:text-muted-foreground"
        >
          loading
        </p>
      </div>
    </div>
  );
}
