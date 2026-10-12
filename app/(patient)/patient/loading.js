export default function PatientLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="در حال بارگذاری">
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-2xl bg-card" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-card" />
    </div>
  );
}
