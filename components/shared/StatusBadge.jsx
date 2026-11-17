import { cn } from "@/lib/utils";

// Status colors read from the design tokens in globals.css so semantic
// colors stay aligned with the brand palette (teal) instead of competing
// with it through parallel Tailwind greens/ambers/violets.
const VARIANTS = {
  neutral: "bg-muted text-muted-foreground border-border",
  normal: "bg-status-normal-bg text-status-normal border-status-normal-border",
  preliminary: "bg-status-low-bg text-status-low border-status-low-border",
  amended: "bg-status-superseded-bg text-status-superseded border-status-superseded-border",
  low: "bg-status-low-bg text-status-low border-status-low-border",
  high: "bg-status-high-bg text-status-high border-status-high-border",
  critical:
    "bg-status-critical-bg text-status-critical border-status-critical-border",
  superseded:
    "bg-status-superseded-bg text-status-superseded border-status-superseded-border",
};

/**
 * Generic pill for any status vocabulary (order status, prescription
 * status, ...). Always icon/label driven — color is never the only signal.
 * @param {{ variant?: keyof typeof VARIANTS, label: string, icon?: import("react").ComponentType }} props
 */
export default function StatusBadge({ variant = "neutral", label, icon: Icon }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-5",
        VARIANTS[variant] ?? VARIANTS.neutral,
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {label}
    </span>
  );
}
