"use client";

import { useDelayedLoading, SpinnerGraphic } from "@/components/shared/Spinner";

/**
 * Loading overlay for a relative card/section, or a full-viewport blocking
 * state when fullScreen is true. A section parent should be position: relative.
 */
export default function LoadingOverlay({
  active = true,
  fullScreen = false,
  label = "در حال بارگذاری…",
  size = "lg",
  className = "",
}) {
  const visible = useDelayedLoading(active, 250, 400);
  if (!visible) return null;

  return (
    <div
      className={[
        "z-30 grid place-items-center bg-background/70 p-4 text-center backdrop-blur-[0.125rem]",
        fullScreen ? "fixed inset-0 z-[1100]" : "absolute inset-0 rounded-[inherit]",
        className,
      ].join(" ")}
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card/95 px-5 py-4 shadow-lg" role="status" aria-live="polite">
        <SpinnerGraphic size={size} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
