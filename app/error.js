"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Log to console in dev; wire to monitoring later
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <AlertTriangle
            className="h-12 w-12 text-muted-foreground"
            aria-hidden="true"
          />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">مشکلی پیش آمد</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            دریافت اطلاعات با مشکل مواجه شد. لطفاً دوباره تلاش کنید.
          </p>
        </div>

        <div className="flex justify-center gap-2">
          <Button type="button" onClick={() => reset()}>
            تلاش دوباره
          </Button>
          <Button asChild variant="outline">
            <Link href="/">بازگشت به داشبورد</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
