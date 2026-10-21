export type ToastId = string | number;

/**
 * The toasts with an Undo on screen, so changing the day can close just
 * those (their Undo belongs to the day they came from) and leave the error
 * toasts that tell the owner to act.
 */
export function createToastRegistry() {
  const ids = new Set<ToastId>();
  return {
    add(id: ToastId) {
      ids.add(id);
    },
    /** It closed by itself or was dismissed. */
    remove(id: ToastId) {
      ids.delete(id);
    },
    /** Every registered id, once: the registry is empty afterwards. */
    takeAll(): ToastId[] {
      const out = [...ids];
      ids.clear();
      return out;
    },
    has(id: ToastId) {
      return ids.has(id);
    },
  };
}
