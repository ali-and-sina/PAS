"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }) {
  useEffect(() => {
    console.error("[AdminError]", error);
  }, [error]);

  return (
    <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-10 text-center">
      <h2 className="text-lg font-semibold">بارگذاری پنل مدیریت انجام نشد</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        اتصال داده یا مجوز دسترسی را بررسی کنید و دوباره تلاش کنید.
      </p>
      <Button className="mt-5" onClick={() => reset()}>تلاش دوباره</Button>
    </div>
  );
}
