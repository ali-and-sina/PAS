import Link from "next/link";
import { Button } from "@/components/ui/button";

function buildHref(pathname, query, page, pageParam) {
  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(query || {})) {
    if (key === pageParam || rawValue === undefined || rawValue === null) continue;
    const value = String(rawValue);
    if (!value || (key === "role" && value === "all") || (key === "status" && value === "all")) continue;
    params.set(key, value);
  }
  if (page > 1) params.set(pageParam, String(page));
  const suffix = params.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}

export default function Pagination({
  pathname,
  page = 1,
  pageSize = 25,
  totalCount = 0,
  totalPages = 1,
  hasNextPage,
  pageParam = "page",
  query = {},
}) {
  const hasExactPageCount = Number.isFinite(totalPages);
  const safeTotalPages = hasExactPageCount ? Math.max(1, totalPages) : null;
  const safePage = hasExactPageCount ? Math.min(Math.max(1, page), safeTotalPages) : Math.max(1, page);
  const canGoNext = hasExactPageCount ? safePage < safeTotalPages : Boolean(hasNextPage);
  if (!canGoNext && safePage <= 1) return null;
  const start = totalCount === null ? (safePage - 1) * pageSize + 1 : (totalCount ? (safePage - 1) * pageSize + 1 : 0);
  const end = totalCount === null ? safePage * pageSize : Math.min(safePage * pageSize, totalCount);

  return (
    <nav aria-label="صفحه‌بندی فهرست" className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {totalCount === null ? "نمایش موارد این صفحه؛ تعداد کل با این فیلتر محاسبه نمی‌شود" : `نمایش ${start.toLocaleString("fa-IR")} تا ${end.toLocaleString("fa-IR")} از ${totalCount.toLocaleString("fa-IR")} مورد`}
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        {safePage > 1 ? (
          <Button asChild size="sm" variant="outline">
            <Link href={buildHref(pathname, query, safePage - 1, pageParam)} prefetch={false}>صفحهٔ قبل</Link>
          </Button>
        ) : <Button size="sm" variant="outline" disabled>صفحهٔ قبل</Button>}
        <span className="min-w-max text-xs text-muted-foreground">{safeTotalPages ? `صفحهٔ ${safePage.toLocaleString("fa-IR")} از ${safeTotalPages.toLocaleString("fa-IR")}` : `صفحهٔ ${safePage.toLocaleString("fa-IR")}`}</span>
        {canGoNext ? (
          <Button asChild size="sm" variant="outline">
            <Link href={buildHref(pathname, query, safePage + 1, pageParam)} prefetch={false}>صفحهٔ بعد</Link>
          </Button>
        ) : <Button size="sm" variant="outline" disabled>صفحهٔ بعد</Button>}
      </div>
    </nav>
  );
}
