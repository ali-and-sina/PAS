"use client";

import * as React from "react";
import useUnsavedChangesWarning from "@/hooks/useUnsavedChangesWarning";

/**
 * Debounced server-backed draft persistence.
 * This hook never writes form values to browser storage. Callers must provide
 * an authorized server action; do not use it for medical/patient forms until
 * that action has explicit ownership, role, and version checks.
 */
export default function useDraftAutosave({
  values,
  saveDraft,
  enabled = true,
  debounceMs = 900,
  onSaved,
  getErrorMessage,
  warnOnUnsavedChanges = true,
} = {}) {
  const serialized = React.useMemo(() => {
    try {
      return JSON.stringify(values ?? null);
    } catch {
      return null;
    }
  }, [values]);

  const saveRef = React.useRef(saveDraft);
  const savedKeyRef = React.useRef(serialized);
  const latestKeyRef = React.useRef(serialized);
  const latestValuesRef = React.useRef(values);
  const onSavedRef = React.useRef(onSaved);
  const errorMessageRef = React.useRef(getErrorMessage);
  const queueRef = React.useRef(Promise.resolve());
  const sequenceRef = React.useRef(0);
  const timerRef = React.useRef(null);
  const mountedRef = React.useRef(true);
  const [status, setStatus] = React.useState("idle");
  const [error, setError] = React.useState("");
  const [lastSavedAt, setLastSavedAt] = React.useState(null);

  React.useEffect(() => { saveRef.current = saveDraft; }, [saveDraft]);
  React.useEffect(() => { latestValuesRef.current = values; latestKeyRef.current = serialized; }, [values, serialized]);
  React.useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);
  React.useEffect(() => { errorMessageRef.current = getErrorMessage; }, [getErrorMessage]);

  const isDirty = serialized !== null && serialized !== savedKeyRef.current;

  const persist = React.useCallback(() => {
    if (!enabled || typeof saveRef.current !== "function") return Promise.resolve({ ok: false, reason: "unavailable" });

    // Serialize writes. When several edits happen during a request, the next
    // queued task reads the newest snapshot rather than racing older writes.
    const task = queueRef.current.catch(() => ({ ok: false })).then(async () => {
      if (!mountedRef.current) return { ok: false, stale: true };
      const key = latestKeyRef.current;
      if (key === null) return { ok: false, reason: "invalid-values" };
      if (key === savedKeyRef.current) return { ok: true, unchanged: true };

      const requestId = ++sequenceRef.current;
      setStatus("saving");
      setError("");
      try {
        const result = await saveRef.current(latestValuesRef.current);
        if (result === false || result?.ok === false) {
          const failure = new Error("DRAFT_SAVE_FAILED");
          failure.userMessage = result?.message;
          throw failure;
        }
        if (!mountedRef.current || requestId !== sequenceRef.current) return { ok: true, stale: true };

        savedKeyRef.current = key;
        const stillLatest = latestKeyRef.current === key;
        setStatus(stillLatest ? "saved" : "pending");
        setLastSavedAt(new Date());
        try { onSavedRef.current?.(result); } catch { /* presentation callbacks do not affect persistence */ }
        return { ok: true, result, stale: !stillLatest };
      } catch (cause) {
        if (!mountedRef.current || requestId !== sequenceRef.current) return { ok: false, stale: true };
        // An older failed draft should not replace feedback for newer values.
        if (latestKeyRef.current !== key) {
          setStatus("pending");
          return { ok: false, stale: true };
        }
        let message = "ذخیرهٔ پیش‌نویس انجام نشد؛ اتصال را بررسی و دوباره تلاش کنید.";
        try {
          const provided = errorMessageRef.current?.(cause);
          if (typeof provided === "string" && provided.trim()) message = provided.trim();
          else if (typeof cause?.userMessage === "string" && cause.userMessage.trim()) message = cause.userMessage.trim();
        } catch {
          // Keep the safe fallback message.
        }
        setStatus("error");
        setError(message);
        return { ok: false, error: message };
      }
    });

    queueRef.current = task.catch(() => ({ ok: false }));
    return task;
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled || !isDirty || serialized === null || typeof saveRef.current !== "function") return undefined;
    const delay = Number.isFinite(Number(debounceMs)) ? Math.max(0, Number(debounceMs)) : 900;
    setStatus("pending");
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void persist();
    }, delay);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [debounceMs, enabled, isDirty, persist, serialized]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sequenceRef.current += 1;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  useUnsavedChangesWarning(warnOnUnsavedChanges && (isDirty || status === "saving" || status === "error"));

  const flush = React.useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    return persist();
  }, [persist]);

  const markSaved = React.useCallback(async (nextValues = latestValuesRef.current) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    await queueRef.current.catch(() => ({ ok: false }));
    let nextKey;
    try { nextKey = JSON.stringify(nextValues ?? null); } catch { nextKey = null; }
    if (nextKey === null) return false;
    sequenceRef.current += 1;
    savedKeyRef.current = nextKey;
    setStatus("saved");
    setError("");
    setLastSavedAt(new Date());
    return true;
  }, []);

  return { status, error, isDirty, lastSavedAt, flush, markSaved };
}
