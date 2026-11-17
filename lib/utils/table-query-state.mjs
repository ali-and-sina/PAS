function safePage(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10000) : fallback;
}

export function parseTableQuery(search, config = {}) {
  const params = new URLSearchParams(search || "");
  const filterKeys = Array.isArray(config.filterKeys) ? config.filterKeys : [];
  const sortableKeys = Array.isArray(config.sortableKeys) ? config.sortableKeys : [];
  const filters = { ...(config.defaultFilters || {}) };
  for (const key of filterKeys) filters[key] = params.get(key) || "";
  const requestedSort = params.get(config.sortKey || "sort") || config.defaultSort?.key || "";
  const sortKey = sortableKeys.includes(requestedSort) ? requestedSort : "";
  const directionValue = params.get(config.directionKey || "order");

  return {
    query: params.get(config.queryKey || "q") || config.defaultQuery || "",
    filters,
    sort: {
      key: sortKey,
      direction: sortKey && directionValue === "desc" ? "desc" : (config.defaultSort?.direction === "desc" ? "desc" : "asc"),
    },
    page: safePage(params.get(config.pageKey || "page"), config.defaultPage || 1),
  };
}

export function updateTableQuery(url, state, config = {}, options = {}) {
  const next = new URL(url, "http://localhost");
  const params = next.searchParams;
  const setOrDelete = (key, value) => {
    const normalized = String(value ?? "").trim();
    if (normalized) params.set(key, normalized);
    else params.delete(key);
  };

  if (options.syncQuery !== false) setOrDelete(config.queryKey || "q", state.query);
  setOrDelete(config.pageKey || "page", state.page > 1 ? state.page : "");

  for (const key of config.filterKeys || []) setOrDelete(key, state.filters?.[key]);

  const sort = state.sort || {};
  if (sort.key && (config.sortableKeys || []).includes(sort.key)) {
    params.set(config.sortKey || "sort", sort.key);
    if (sort.direction === "desc") params.set(config.directionKey || "order", "desc");
    else params.delete(config.directionKey || "order");
  } else {
    params.delete(config.sortKey || "sort");
    params.delete(config.directionKey || "order");
  }

  return `${next.pathname}${params.toString() ? `?${params.toString()}` : ""}${next.hash}`;
}
