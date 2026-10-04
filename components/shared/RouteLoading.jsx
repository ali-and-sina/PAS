import { Skeleton } from "@/components/ui/skeleton";

/** اسکلتون عمومی صفحه: هدر + گرید کارت + یک بلوک لیست. */
export default function RouteLoading() {
  return (
    <div aria-hidden="true">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-lg" />
    </div>
  );
}
