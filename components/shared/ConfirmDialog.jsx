"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ConfirmDialog({
  open, onOpenChange, title = "تأیید عملیات", description = "آیا از انجام این عملیات مطمئن هستید؟",
  confirmLabel = "تأیید و ادامه", cancelLabel = "انصراف", destructive = false,
  onConfirm, children, busy: busyProp = false,
  getErrorMessage, fallbackErrorMessage = "عملیات انجام نشد. دوباره تلاش کنید.",
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const isBusy = busyProp || busy;
  const handleConfirm = async () => {
    if (isBusy || typeof onConfirm !== "function") return;
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onOpenChange?.(false);
    } catch (cause) {
      // Do not expose raw server/exception messages in the confirmation UI.
      let safeMessage = fallbackErrorMessage;
      try {
        if (typeof getErrorMessage === "function") safeMessage = getErrorMessage(cause);
      } catch {
        safeMessage = fallbackErrorMessage;
      }
      setError(typeof safeMessage === "string" && safeMessage.trim()
        ? safeMessage.trim()
        : "عملیات انجام نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenChange = (nextOpen) => {
    if (isBusy) return;
    if (!nextOpen) setError("");
    onOpenChange?.(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"><AlertTriangle className={destructive ? "size-5 text-destructive" : "size-5"} aria-hidden="true" /></div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children ? <div className="text-sm leading-6">{children}</div> : null}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isBusy} onClick={() => handleOpenChange(false)}>{cancelLabel}</Button>
          <Button type="button" variant={destructive ? "destructive" : "default"} loading={isBusy} loadingText="در حال انجام…" onClick={handleConfirm} disabled={!onConfirm || isBusy}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
