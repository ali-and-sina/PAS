/**
 * Small shared helpers for URL-driven server pagination.
 * Keep the page size bounded so a query cannot be expanded by user input.
 */
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const MAX_PAGE_NUMBER = 1_000;

export function normalizePage(value, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_PAGE_NUMBER) : fallback;
}

export function normalizePageSize(value, fallback = DEFAULT_PAGE_SIZE) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

export function getPageBounds(page, pageSize = DEFAULT_PAGE_SIZE) {
  const safePage = normalizePage(page);
  const safePageSize = normalizePageSize(pageSize);
  return {
    page: safePage,
    pageSize: safePageSize,
    from: (safePage - 1) * safePageSize,
    to: safePage * safePageSize - 1,
  };
}

export function makePagination({ page, pageSize = DEFAULT_PAGE_SIZE, totalCount = 0 }) {
  const safePageSize = normalizePageSize(pageSize);
  const safeTotal = Math.max(0, Number(totalCount) || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  return {
    page: Math.min(normalizePage(page), totalPages),
    pageSize: safePageSize,
    totalCount: safeTotal,
    totalPages,
  };
}
