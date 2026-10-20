const inFlight = new Map<string, Promise<unknown>>();

/**
 * Runs `run` unless a call with the same `key` is already under way, in which
 * case that call's promise is returned. Two parts of the app asking for the
 * same data at the same moment (the offline warm-up and the page itself) then
 * cost one request.
 */
export function shareInFlight<T>(
  key: string,
  run: () => Promise<T>,
): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = run().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
