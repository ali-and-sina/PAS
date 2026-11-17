"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RootError({ error, unstable_retry, reset }) {
  const retryAction = unstable_retry || reset;

  useEffect(() => {
    console.error("[PAS Route Error]", error);
  }, [error]);

  return (
    <main className="flex min-h-[70dvh] items-center justify-center px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border bg-card px-5 py-9 text-center shadow-sm sm:px-8">
        <p dir="ltr" className="mb-4 font-mono text-xs font-semibold tracking-[0.2em] text-muted-foreground">500 · PAS</p>
        <span className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-8" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold leading-8 sm:text-2xl">مشکلی در بارگذاری این صفحه پیش آمد</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">اطلاعات صفحه به‌درستی دریافت نشد. دوباره تلاش کنید؛ اگر مشکل ادامه داشت، بعداً مراجعه کنید.</p>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <Button type="button" onClick={() => retryAction?.()}>تلاش دوباره</Button>
          <Button asChild variant="outline"><Link href="/">بازگشت به صفحه اصلی</Link></Button>
        </div>
        {error?.digest ? <p dir="ltr" className="mt-5 font-mono text-[0.6875rem] text-muted-foreground">کد پیگیری: {error.digest}</p> : null}
      </section>
    </main>
  );
}
