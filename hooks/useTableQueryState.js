"use client";

import * as React from "react";
import { parseTableQuery, updateTableQuery } from "@/lib/utils/table-query-state.mjs";

const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_OBJECT = Object.freeze({});
const EMPTY_SORT = Object.freeze({ key: "", direction: "asc" });

/**
 * URL state for non-sensitive list views. Do not sync patient names, identifiers,
 * clinical terms, or other sensitive search text into the browser URL/history.
 */
export default function useTableQueryState({
  queryKey = "q",
  pageKey = "page",
  sortKey = "sort",
  directionKey = "order",
  filterKeys = EMPTY_ARRAY,
  sortableKeys = EMPTY_ARRAY,
  defaultQuery = "",
  defaultFilters = EMPTY_OBJECT,
  defaultSort = EMPTY_SORT,
  defaultPage = 1,
  debounceMs = 300,
  syncQuery = true,
} = {}) {
  const [state, setState] = React.useState(() => ({
    query: defaultQuery,
    filters: { ...defaultFilters },
    sort: { ...defaultSort },
    page: defaultPage,
  }));
  const stateRef = React.useRef(state);
  const timerRef = React.useRef(null);
  const config = React.useMemo(() => ({
    queryKey, pageKey, sortKey, directionKey, filterKeys, sortableKeys,
    defaultQuery, defaultFilters, defaultSort, defaultPage,
  }), [queryKey, pageKey, sortKey, directionKey, filterKeys, sortableKeys, defaultQuery, defaultFilters, defaultSort, defaultPage]);

  const commit = React.useCallback((nextState, immediate = true) => {
    stateRef.current = nextState;
    setState(nextState);
    if (typeof window === "undefined") return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const write = () => {
      const nextUrl = updateTableQuery(window.location.href, nextState, config, { syncQuery });
      window.history.replaceState(window.history.state, "", nextUrl);
    };
    if (immediate) write();
    else timerRef.current = window.setTimeout(write, Math.max(0, Number(debounceMs) || 0));
  }, [config, debounceMs, syncQuery]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const syncFromUrl = () => {
      const parsed = parseTableQuery(window.location.search, config);
      stateRef.current = parsed;
      setState(parsed);
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [config]);

  const setQuery = React.useCallback((query) => {
    const next = { ...stateRef.current, query: String(query ?? ""), page: 1 };
    commit(next, !syncQuery ? true : false);
  }, [commit, syncQuery]);

  const setFilter = React.useCallback((key, value) => {
    if (!filterKeys.includes(key)) return;
    const next = {
      ...stateRef.current,
      filters: { ...stateRef.current.filters, [key]: String(value ?? "") },
      page: 1,
    };
    commit(next, true);
  }, [commit, filterKeys]);

  const setSort = React.useCallback((key, direction = "asc") => {
    if (key && !sortableKeys.includes(key)) return;
    const next = {
      ...stateRef.current,
      sort: { key: key || "", direction: direction === "desc" ? "desc" : "asc" },
      page: 1,
    };
    commit(next, true);
  }, [commit, sortableKeys]);

  const setPage = React.useCallback((page) => {
    const parsed = Number.parseInt(page, 10);
    const next = { ...stateRef.current, page: Number.isFinite(parsed) ? Math.max(1, parsed) : 1 };
    commit(next, true);
  }, [commit]);

  const reset = React.useCallback(() => {
    commit({ query: defaultQuery, filters: { ...defaultFilters }, sort: { ...defaultSort }, page: defaultPage }, true);
  }, [commit, defaultQuery, defaultFilters, defaultSort, defaultPage]);

  return { ...state, setQuery, setFilter, setSort, setPage, reset };
}
