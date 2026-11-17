"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

export default function ConfirmActionButton({
  children,
  onConfirm,
  confirmTitle = "تأیید عملیات",
  confirmDescription = "از انجام این عملیات مطمئن هستید؟",
  confirmLabel = "تأیید و ادامه",
  cancelLabel = "انصراف",
  fallbackErrorMessage = "عملیات انجام نشد؛ دوباره تلاش کنید.",
  destructive = false,
  variant = "outline",
  size = "default",
  className,
  disabled = false,
  loading = false,
  loadingText = "در حال انجام…",
  buttonProps = {},
}) {
  const [open, setOpen] = React.useState(false);

  const handleConfirm = React.useCallback(async () => {
    if (typeof onConfirm !== "function") return;
    const result = await onConfirm();
    if (result === false || result?.ok === false) {
      const failure = new Error("CONFIRMED_ACTION_FAILED");
      failure.userMessage = result?.message || fallbackErrorMessage;
      throw failure;
    }
  }, [fallbackErrorMessage, onConfirm]);

  return (
    <>
      <Button
        {...buttonProps}
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || loading}
        loading={loading}
        loadingText={loadingText}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        destructive={destructive}
        fallbackErrorMessage={fallbackErrorMessage}
        getErrorMessage={(cause) => cause?.userMessage || fallbackErrorMessage}
        onConfirm={handleConfirm}
      />
    </>
  );
}
