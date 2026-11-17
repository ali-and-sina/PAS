"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const ReferralQrScanner = dynamic(() => import("./ReferralQrScanner"), {
  ssr: false,
  loading: () => <div className="min-h-48 animate-pulse rounded-xl border bg-muted/30" aria-hidden="true" />,
});

export default function DeferredReferralQrScanner({ type, scope = "center" }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <Camera className="size-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold">پذیرش با کد QR</p>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          اسکنر فقط هنگام نیاز بارگذاری می‌شود.
        </p>
        <Button type="button" variant="outline" className="mt-3 min-h-11 w-full" onClick={() => setOpen(true)}>
          <Camera className="size-4" aria-hidden="true" />
          باز کردن اسکنر
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <X className="size-4" aria-hidden="true" />
          بستن اسکنر
        </Button>
      </div>
      <ReferralQrScanner type={type} scope={scope} />
    </div>
  );
}
