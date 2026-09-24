import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Generic row skeleton for list/table pages. Keeps the layout's shape so nothing jumps once real data arrives. */
export function ListSkeleton({ rows = 4, className }) {
  return (
    <div className={cn("space-y-3", className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

/** Skeleton for a single content card (e.g. a dashboard summary card). */
export function CardSkeleton({ className }) {
  return (
    <div
      className={cn("space-y-3 rounded-lg border p-4", className)}
      aria-hidden="true"
    >
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
