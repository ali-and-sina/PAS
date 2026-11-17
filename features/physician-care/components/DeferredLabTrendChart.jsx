"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const LabTrendChart = dynamic(() => import("./LabTrendChart"), {
  ssr: false,
  loading: () => (
    <div className="min-h-48 w-full rounded-xl border bg-muted/30 motion-safe:animate-pulse" aria-hidden="true" />
  ),
});

export default function DeferredLabTrendChart({ points = [], unit = null }) {
  const containerRef = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (points.length < 2) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        برای نمایش روند عددی، دست‌کم دو نتیجهٔ ثبت‌شده لازم است.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-48 min-w-0" aria-busy={!shouldLoad}>
      {shouldLoad ? (
        <LabTrendChart points={points} unit={unit} />
      ) : (
        <div className="min-h-48 w-full rounded-xl border bg-muted/20" aria-hidden="true" />
      )}
    </div>
  );
}
