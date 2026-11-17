import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorState({
  title = "دریافت اطلاعات با مشکل مواجه شد.",
  description = "لطفاً دوباره تلاش کنید.",
  onRetry, code, retryLabel = "تلاش دوباره", className,
}) {
  return (
    <div role="alert" className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-12 text-center ${className || ""}`}>
      <span className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><AlertTriangle className="size-6" aria-hidden="true" /></span>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
        {code ? <p className="pt-1 text-xs text-muted-foreground">کد پیگیری: <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono">{code}</code></p> : null}
      </div>
      {onRetry ? <Button type="button" size="sm" variant="outline" className="mt-1" onClick={onRetry}>{retryLabel}</Button> : null}
    </div>
  );
}
