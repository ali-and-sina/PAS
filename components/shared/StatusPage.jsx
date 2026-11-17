import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Shared, theme-token-based presentation for standalone system states. */
export default function StatusPage({
  code,
  icon: Icon,
  title,
  description,
  primaryHref = "/",
  primaryLabel = "بازگشت به صفحه اصلی",
  secondaryHref,
  secondaryLabel,
}) {
  return (
    <main className="flex min-h-[75dvh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg border-border/80 shadow-sm">
        <CardContent className="flex flex-col items-center px-5 py-9 text-center sm:px-8 sm:py-11">
          {code ? <p dir="ltr" className="mb-4 font-mono text-xs font-semibold tracking-[0.2em] text-muted-foreground">{code}</p> : null}
          <span className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-muted text-primary">
            {Icon ? <Icon className="size-8" aria-hidden="true" /> : null}
          </span>
          <h1 className="text-balance text-xl font-bold leading-8 sm:text-2xl">{title}</h1>
          <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">{description}</p>
          <div className="mt-7 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
            <Button asChild className="min-h-11">
              <Link href={primaryHref}>{primaryLabel}<ArrowLeft className="size-4" aria-hidden="true" /></Link>
            </Button>
            {secondaryHref ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={secondaryHref}>{secondaryLabel || "بازگشت"}</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
