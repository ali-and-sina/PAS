"use client";

import { useEffect, useRef, useState } from "react";

const SIZE_MAP = Object.freeze({ xs: 12, sm: 16, md: 20, lg: 32, xl: 48 });

function resolveSize(size) {
  if (typeof size === "number" && Number.isFinite(size)) {
    return Math.min(96, Math.max(8, size));
  }
  return SIZE_MAP[size] || SIZE_MAP.md;
}

/** Delay the indicator to prevent flashing, then keep it visible briefly. */
export function useDelayedLoading(active, delay = 250, minDuration = 400) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);
  const visibleAtRef = useRef(0);

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (active) {
      if (!visible) {
        timerRef.current = window.setTimeout(() => {
          visibleAtRef.current = Date.now();
          setVisible(true);
          timerRef.current = null;
        }, Math.max(0, delay));
      }
    } else if (visible) {
      const elapsed = visibleAtRef.current ? Date.now() - visibleAtRef.current : minDuration;
      const remaining = Math.max(0, minDuration - elapsed);
      timerRef.current = window.setTimeout(() => {
        visibleAtRef.current = 0;
        setVisible(false);
        timerRef.current = null;
      }, remaining);
    }

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, delay, minDuration, visible]);

  return visible;
}

/** SVG-only indicator for buttons and other already-labelled controls. */
export function SpinnerGraphic({ size = "md", className = "" }) {
  const pixels = resolveSize(size);
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 40 40"
      width={pixels}
      height={pixels}
      className={`pas-spinner__svg ${className}`.trim()}
    >
      <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="4" opacity="0.25" />
      <circle
        cx="20"
        cy="20"
        r="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="25 101"
        transform="rotate(-90 20 20)"
      />
    </svg>
  );
}

export default function Spinner({
  size = "md",
  label = "در حال بارگذاری…",
  active = true,
  delay = 250,
  minDuration = 400,
  decorative = false,
  className = "",
}) {
  const visible = useDelayedLoading(active, delay, minDuration);
  if (!visible) return null;

  return (
    <span
      className={`pas-spinner ${className}`.trim()}
      role={decorative ? undefined : "status"}
      aria-live={decorative ? undefined : "polite"}
    >
      <SpinnerGraphic size={size} />
      {!decorative ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
