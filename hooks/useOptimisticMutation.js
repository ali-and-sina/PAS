"use client";

import * as React from "react";
import { toast } from "sonner";

/**
 * Optimistic state helper for small, reversible UI mutations only.
 * Do not use for clinical, financial, access-control, or other irreversible state.
 */
export default function useOptimisticMutation({
  getSnapshot,
  applyOptimistic,
  mutate,
  rollback,
  successMessage = "تغییر ذخیره شد.",
  fallbackErrorMessage = "تغییر ذخیره نشد؛ وضعیت قبلی بازگردانده شد.",
  getErrorMessage,
} = {}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");
  const callbacksRef = React.useRef({});
  const pendingRef = React.useRef(false);
  React.useEffect(() => {
    callbacksRef.current = { getSnapshot, applyOptimistic, mutate, rollback, getErrorMessage };
  }, [getSnapshot, applyOptimistic, mutate, rollback, getErrorMessage]);

  const run = React.useCallback(async (...args) => {
    const callbacks = callbacksRef.current;
    if (pendingRef.current || typeof callbacks.mutate !== "function") return { ok: false, reason: "unavailable" };
    if (typeof callbacks.applyOptimistic === "function" && (
      typeof callbacks.getSnapshot !== "function" || typeof callbacks.rollback !== "function"
    )) {
      return { ok: false, reason: "rollback-required" };
    }
    pendingRef.current = true;
    setPending(true);
    setError("");
    let snapshot;
    try {
      snapshot = await callbacks.getSnapshot?.(...args);
      callbacks.applyOptimistic?.(...args);
      const result = await callbacks.mutate(...args);
      if (result === false || result?.ok === false) {
        const failure = new Error("OPTIMISTIC_MUTATION_FAILED");
        failure.userMessage = result?.message;
        throw failure;
      }
      toast.success(successMessage);
      return { ok: true, result };
    } catch (cause) {
      try { await callbacks.rollback?.(snapshot, cause, ...args); } catch { /* preserve original failure */ }
      let message = fallbackErrorMessage;
      try {
        const provided = callbacks.getErrorMessage?.(cause);
        if (typeof provided === "string" && provided.trim()) message = provided.trim();
        else if (typeof cause?.userMessage === "string" && cause.userMessage.trim()) message = cause.userMessage.trim();
      } catch { /* keep fallback */ }
      setError(message);
      toast.error(message);
      return { ok: false, error: message };
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [fallbackErrorMessage, successMessage]);

  const clearError = React.useCallback(() => setError(""), []);
  return { run, pending, error, clearError };
}
