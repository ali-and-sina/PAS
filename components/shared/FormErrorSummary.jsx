"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Focusable, linked summary for failed form submissions. */
export default function FormErrorSummary({
  errors = {},
  fieldLabels = {},
  fieldIds = {},
  title = "لطفاً موارد زیر را اصلاح کنید:",
  focusOnRender = false,
  focusKey = 0,
  className,
}) {
  const summaryRef = React.useRef(null);
  const summaryId = React.useId();
  const entries = React.useMemo(() => Object.entries(errors).filter(([, message]) => Boolean(message)), [errors]);

  React.useEffect(() => {
    if (focusOnRender && entries.length) summaryRef.current?.focus();
  }, [focusOnRender, focusKey]);

  if (!entries.length) return null;

  return (
    <section
      ref={summaryRef}
      tabIndex={-1}
      role="alert"
      aria-labelledby={summaryId}
      className={cn("rounded-xl border border-status-critical-border bg-status-critical-bg p-4 text-status-critical outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id={summaryId} className="text-sm font-semibold leading-6">{title}</h2>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm leading-6">
            {entries.map(([field, message]) => {
              const targetId = fieldIds[field] || `field-${field}`;
              const label = fieldLabels[field] || field;
              return (
                <li key={field}>
                  <a href={`#${targetId}`} className="underline decoration-current/50 underline-offset-2 hover:decoration-current focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {label}: {typeof message === "string"
                    ? message
                    : typeof message?.message === "string"
                      ? message.message
                      : "مقدار واردشده معتبر نیست."}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
