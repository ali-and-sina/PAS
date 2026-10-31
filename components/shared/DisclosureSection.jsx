import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Compact, accessible progressive-disclosure panel for long record details.
 * Uses native <details>/<summary>, so it works without client-side state.
 */
export default function DisclosureSection({
  title,
  description,
  meta,
  children,
  defaultOpen = false,
  stickySummary = false,
  className,
  contentClassName,
}) {
  return (
    <details
      open={defaultOpen || undefined}
      className={cn("group min-w-0", className)}
    >
      <summary
        className={cn(
          "flex min-h-14 min-w-0 cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/20 sm:flex-nowrap sm:gap-4 sm:p-5",
          stickySummary && "sticky top-16 z-30 bg-card shadow-sm backdrop-blur lg:top-20",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span className="min-w-32 flex-1">
          <span className="block font-semibold leading-6">{title}</span>
          {description ? (
            <span className="mt-1 block text-sm leading-6 text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>

        <span className="flex shrink-0 items-center gap-2 sm:gap-3">
          {meta ? (
            <span className="whitespace-nowrap rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground sm:px-2.5 sm:text-xs">
              {meta}
            </span>
          ) : null}
          <span className="hidden whitespace-nowrap text-xs font-medium text-primary group-open:inline sm:text-sm">
            مخفی‌کردن جزئیات
          </span>
          <span className="whitespace-nowrap text-xs font-medium text-primary group-open:hidden sm:text-sm">
            نمایش جزئیات
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
      </summary>

      <div className={cn("mt-3 space-y-4", contentClassName)}>{children}</div>
    </details>
  );
}
