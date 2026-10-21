import { toast, type ExternalToast } from "sonner";
import {
  createToastRegistry,
  type ToastId,
} from "@/lib/checklist/toast-registry";

const registry = createToastRegistry();

/**
 * Shows a toast that belongs to the day on screen (one with an Undo, or the
 * confirmation that stands in for it) and registers it, so a day change
 * closes it with `dismissUndoToasts`. Error toasts are never registered.
 */
export function undoToast(
  message: string,
  data: ExternalToast = {},
  variant: "default" | "success" = "default",
): ToastId {
  const show = variant === "success" ? toast.success : toast;
  const id = show(message, {
    ...data,
    onDismiss: (t) => {
      registry.remove(t.id);
      data.onDismiss?.(t);
    },
    onAutoClose: (t) => {
      registry.remove(t.id);
      data.onAutoClose?.(t);
    },
  });
  registry.add(id);
  return id;
}

/** Closes every registered toast (day change); error toasts stay. */
export function dismissUndoToasts() {
  for (const id of registry.takeAll()) toast.dismiss(id);
}
