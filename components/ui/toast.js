import { toast } from "sonner";

/** Show a toast with a safe, explicit Undo action supplied by the caller. */
export function toastWithUndo(message, onUndo, options = {}) {
  const { undoLabel = "بازگردانی", action, ...toastOptions } = options;
  return toast(message, {
    ...toastOptions,
    action: typeof onUndo === "function" ? { label: undoLabel, onClick: onUndo } : action,
  });
}

export const notify = {
  success: (message, options) => toast.success(message, options),
  error: (message, options) => toast.error(message, options),
  warning: (message, options) => toast.warning(message, options),
  info: (message, options) => toast.info(message, options),
  message: (message, options) => toast(message, options),
};
