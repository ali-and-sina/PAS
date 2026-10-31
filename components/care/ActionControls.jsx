"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { runCareCommand } from "@/features/care/actions";

export function useCareAction() {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState(null);
  const router = useRouter();
  function run(action, payload, onSuccess) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await runCareCommand(action, payload);
        setFeedback(result);
        if (result.ok) {
          onSuccess?.(result);
          router.refresh();
        }
      } catch {
        setFeedback({ ok: false, message: "ارتباط برقرار نشد؛ دوباره تلاش کنید." });
      }
    });
  }
  return { pending, feedback, run };
}
export function CareFeedback({ value }) {
  if (!value?.message) return null;
  return <p role={value.ok ? "status" : "alert"} className={value.ok ? "text-sm leading-7 text-emerald-800" : "text-sm leading-7 text-destructive"}>{value.message}</p>;
}
export function CommandButton({ action, payload, children, variant = "outline", disabled = false }) {
  const { run, pending, feedback } = useCareAction();
  return <div className="space-y-2"><Button type="button" variant={variant} disabled={disabled || pending} loading={pending} onClick={() => run(action, payload)}>{children}</Button><CareFeedback value={feedback} /></div>;
}
