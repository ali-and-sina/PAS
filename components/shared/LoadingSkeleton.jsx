import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Generic row skeleton for list/table pages. */
export function ListSkeleton({ rows = 4, className }) {
  return <div className={cn("space-y-3", className)} aria-hidden="true">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>;
}

export function CardSkeleton({ className }) {
  return <div className={cn("space-y-3 rounded-xl border bg-card p-4", className)} aria-hidden="true"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-7 w-2/3" /><Skeleton className="h-3 w-1/2" /></div>;
}

export function TableRowSkeleton({ columns = 4, className }) {
  return <div className={cn("grid items-center gap-4 rounded-lg border p-3", className)} style={{ gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))` }} aria-hidden="true">{Array.from({ length: columns }, (_, i) => <Skeleton key={i} className="h-4 w-full" />)}</div>;
}

export function ListItemSkeleton({ className }) {
  return <div className={cn("flex items-center gap-3 rounded-xl border p-3", className)} aria-hidden="true"><Skeleton className="size-10 shrink-0 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /></div></div>;
}

export function AvatarSkeleton({ size = "md", className }) {
  const sizeClass = size === "sm" ? "size-8" : size === "lg" ? "size-14" : "size-10";
  return <Skeleton className={cn(sizeClass, "shrink-0 rounded-full", className)} aria-hidden="true" />;
}

export function TextLinesSkeleton({ lines = 3, className }) {
  return <div className={cn("space-y-2", className)} aria-hidden="true">{Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />)}</div>;
}
