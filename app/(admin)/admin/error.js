"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, unstable_retry, reset }) {
  const retryAction = unstable_retry || reset;

  useEffect(() => {
    console.error("[AdminError]", error);
  }, [error]);

  return (
    <section role="alert" className="mx-auto flex min-h-[55dvh] w-full max-w-xl flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-card px-5 py-10 text-center sm:px-8">
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-7" aria-hidden="true" />
      </span>
      <h1 className="text-lg font-semibold">بارگذاری پنل مدیریت انجام نشد</h1>
      <p className="mt-2 max-w-md text-sm leading-7 text-muted-foreground">اتصال داده یا دسترسی این صفحه با مشکل مواجه شد. دوباره تلاش کنید؛ جزئیات فنی در پیام به کاربر نمایش داده نمی‌شود.</p>
      {error?.digest ? <p dir="ltr" className="mt-3 font-mono text-[0.6875rem] text-muted-foreground">کد پیگیری: {error.digest}</p> : null}
      <Button className="mt-5" onClick={() => retryAction?.()}>تلاش دوباره</Button>
    </section>
  );
}
