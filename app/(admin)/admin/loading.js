export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="در حال بارگذاری">
      <div className="h-10 w-56 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border bg-muted/50" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-xl border bg-muted/50" />
    </div>
  );
}
