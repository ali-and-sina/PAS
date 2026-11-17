"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import Spinner from "@/components/shared/Spinner";

export default function InfiniteScroll({
  children, hasMore = false, loading = false, onLoadMore,
  endMessage = "همهٔ موارد نمایش داده شده‌اند.", loadMoreLabel = "نمایش موارد بیشتر",
  rootMargin = "240px 0px", className,
}) {
  const sentinelRef = React.useRef(null);
  const pendingRef = React.useRef(false);
  const [observerSupported, setObserverSupported] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [internalLoading, setInternalLoading] = React.useState(false);

  const load = React.useCallback(() => {
    if (!hasMore || loading || pendingRef.current || typeof onLoadMore !== "function") return;
    pendingRef.current = true;
    setInternalLoading(true);
    setLoadError(false);
    Promise.resolve().then(() => onLoadMore()).then(
      () => { pendingRef.current = false; setInternalLoading(false); },
      () => { pendingRef.current = false; setInternalLoading(false); setLoadError(true); },
    );
  }, [hasMore, loading, onLoadMore]);

  React.useEffect(() => {
    if (!hasMore || loading || !sentinelRef.current) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setObserverSupported(false);
      return undefined;
    }
    setObserverSupported(true);
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) load();
    }, { rootMargin });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, load, rootMargin]);

  return (
    <div className={className} aria-busy={loading || internalLoading || undefined}>
      {children}
      <div ref={sentinelRef} className="flex min-h-12 items-center justify-center py-3" aria-live="polite">
        {loading || internalLoading ? <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Spinner size="sm" decorative label="در حال دریافت موارد بیشتر…" /><span>در حال دریافت موارد بیشتر…</span></span> : loadError ? (
          <div className="flex flex-wrap items-center justify-center gap-2"><span role="alert" className="text-xs text-destructive">دریافت موارد بیشتر انجام نشد.</span><Button type="button" size="sm" variant="outline" onClick={load}>تلاش دوباره</Button></div>
        ) : hasMore ? (
          observerSupported ? <span className="text-xs text-muted-foreground">برای نمایش موارد بیشتر ادامه دهید</span> : <Button type="button" size="sm" variant="outline" onClick={load}>{loadMoreLabel}</Button>
        ) : <p className="text-xs text-muted-foreground">{endMessage}</p>}
      </div>
    </div>
  );
}
