import { AlertCircle } from "lucide-react";

/** Form-level error. Icon + text, announced by screen readers (role="alert"). */
export default function FormError({ id, children }) {
  if (!children) return null;

  return (
    <div
      id={id}
      role="alert"
      className="flex items-start gap-2 rounded-md border border-status-critical-border bg-status-critical-bg px-3 py-2.5 text-sm text-red-800"
    >
      <AlertCircle
        className="mt-0.5 size-4 shrink-0 text-status-critical"
        aria-hidden="true"
      />
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}
