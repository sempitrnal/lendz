/** A card filling the game's space, for loading and error states. */
export function Message({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center
        rounded-2xl wg-card px-4 text-center text-sm font-bold wg-muted"
    >
      {children}
    </div>
  );
}

/** "couldn't load" with a retry button. */
export function LoadError({ onRetry }: { onRetry(): void }) {
  return (
    <Message>
      <p>couldn&apos;t load, try when online</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-full bg-emerald-600 px-4 py-1.5 text-xs
          font-bold text-white active:bg-emerald-700"
      >
        retry
      </button>
    </Message>
  );
}
