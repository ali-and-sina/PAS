import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }) {
  return <div aria-hidden="true" className={cn("pas-skeleton rounded-lg bg-muted", className)} {...props} />;
}

export { Skeleton };
