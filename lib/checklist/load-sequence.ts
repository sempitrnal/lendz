/**
 * Numbers each load so a slow response for an earlier day can tell it has been
 * superseded and must not overwrite the day now showing.
 */
export function createLoadSequence() {
  let latest = 0;
  return {
    next(): number {
      latest += 1;
      return latest;
    },
    isCurrent(seq: number): boolean {
      return seq === latest;
    },
  };
}
