"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WifiOff } from "lucide-react";

/** Shows a truthful network-state notice; it does not claim the app is cached offline. */
export default function OfflineStatus() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-destructive/20 bg-destructive/5 px-3 py-2 text-center text-xs text-destructive sm:text-sm">
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      <span>مرورگر اتصال شبکه را از دست داده است؛ دریافت و ثبت اطلاعات ممکن است انجام نشود.</span>
      <Link href="/offline" className="min-h-8 rounded-md px-2 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">راهنما</Link>
    </div>
  );
}
