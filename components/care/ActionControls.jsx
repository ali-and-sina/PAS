"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import ConfirmActionButton from "@/components/shared/ConfirmActionButton";
import { runCareCommand } from "@/features/care/actions";

export function useCareAction() {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const pendingRef = useRef(false);
  const router = useRouter();

  async function run(action, payload, onSuccess) {
    if (pendingRef.current) return { ok: false, message: "درخواست قبلی هنوز در حال انجام است." };
    pendingRef.current = true;
    setFeedback(null);
    setPending(true);
    try {
      const result = await runCareCommand(action, payload);
      setFeedback(result);
      if (result?.ok) {
        onSuccess?.(result);
        router.refresh();
      }
      return result || { ok: false, message: "پاسخ معتبری از سرور دریافت نشد." };
    } catch {
      const failure = { ok: false, message: "ارتباط برقرار نشد؛ دوباره تلاش کنید." };
      setFeedback(failure);
      return failure;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return { pending, feedback, run };
}

export function CareFeedback({ value }) {
  if (!value?.message) return null;
  return <p role={value.ok ? "status" : "alert"} className={value.ok ? "text-sm leading-7 text-status-normal" : "text-sm leading-7 text-destructive"}>{value.message}</p>;
}

export function CommandButton({ action, payload, children, variant = "outline", size = "default", disabled = false, confirm = null, className }) {
  const { run, pending, feedback } = useCareAction();
  const perform = async () => run(action, payload);

  return (
    <div className="space-y-2">
      {confirm ? (
        <ConfirmActionButton
          variant={variant}
          size={size}
          className={className}
          disabled={disabled || pending}
          loading={pending}
          destructive={Boolean(confirm.destructive)}
          confirmTitle={confirm.title || "تأیید عملیات"}
          confirmDescription={confirm.description || "از انجام این عملیات مطمئن هستید؟"}
          confirmLabel={confirm.confirmLabel || "تأیید و ادامه"}
          cancelLabel={confirm.cancelLabel || "انصراف"}
          fallbackErrorMessage={confirm.fallbackErrorMessage || "عملیات انجام نشد؛ دوباره تلاش کنید."}
          onConfirm={perform}
        >
          {children}
        </ConfirmActionButton>
      ) : (
        <Button type="button" variant={variant} size={size} className={className} disabled={disabled || pending} loading={pending} onClick={() => { void run(action, payload); }}>
          {children}
        </Button>
      )}
      <CareFeedback value={feedback} />
    </div>
  );
}
