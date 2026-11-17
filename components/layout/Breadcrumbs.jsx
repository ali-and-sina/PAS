import Link from "next/link";
import { ChevronLeft, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Breadcrumbs({ items = [], className, homeHref = "/", homeLabel = "صفحهٔ اصلی" }) {
  if (!items.length) return null;
  return (
    <nav aria-label="مسیر صفحه" className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <li className="flex shrink-0 items-center gap-1.5">
          <Link href={homeHref} className="inline-flex min-h-8 items-center gap-1 rounded-md px-1 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={homeLabel}><Home className="size-3.5" aria-hidden="true" /><span className="sr-only">{homeLabel}</span></Link>
        </li>
        {items.map((item, index) => {
          const current = index === items.length - 1 || item.current;
          return <li key={`${item.href || item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
            <ChevronLeft className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
            {item.href && !current ? <Link href={item.href} className="min-h-8 truncate rounded-md px-1 py-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{item.label}</Link> : <span aria-current={current ? "page" : undefined} className={cn("min-h-8 truncate px-1 py-2", current && "font-medium text-foreground")}>{item.label}</span>}
          </li>;
        })}
      </ol>
    </nav>
  );
}
