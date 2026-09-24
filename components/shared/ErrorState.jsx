import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * @param {{ title?: string, description?: string, onRetry?: () => void }} props
 */
export default function ErrorState({
  title = "دریافت اطلاعات با مشکل مواجه شد.",
  description = "لطفاً دوباره تلاش کنید.",
  onRetry,
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border px-6 py-14 text-center"
    >
      <AlertTriangle
        className="size-8 text-status-critical"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
          تلاش دوباره
        </Button>
      )}
    </div>
  );
}
