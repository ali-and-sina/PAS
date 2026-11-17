"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import EmptyState from "@/components/shared/EmptyState";
import { TableRowSkeleton } from "@/components/shared/LoadingSkeleton";
import LoadingOverlay from "@/components/shared/LoadingOverlay";
import { cn } from "@/lib/utils";

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "fa", { numeric: true, sensitivity: "base" });
}

export default function DataTable({
  columns = [],
  data = [],
  rowKey = "id",
  loading = false,
  emptyTitle = "موردی برای نمایش وجود ندارد.",
  emptyDescription,
  density = "comfortable",
  selectable = false,
  selectedRows = [],
  onSelectionChange,
  selectionActions,
  selectionLabel = "ردیف انتخاب‌شده",
  sort: sortProp,
  defaultSort = { key: null, direction: "asc" },
  onSortChange,
  onRowClick,
  className,
  getRowClassName,
  caption,
  pagination = null,
  totalLabel = "ردیف",
  maxHeight = "min(70vh, 48rem)",
}) {
  const isSortControlled = sortProp !== undefined;
  const [internalSort, setInternalSort] = React.useState(defaultSort);
  const sort = isSortControlled ? (sortProp || { key: null, direction: "asc" }) : internalSort;

  const updateSort = (nextSort) => {
    if (!isSortControlled) setInternalSort(nextSort);
    onSortChange?.(nextSort);
  };

  const rows = React.useMemo(() => {
    if (!sort?.key) return data;
    const column = columns.find((item) => item.key === sort.key);
    if (!column?.sortable) return data;
    const direction = sort.direction === "desc" ? -1 : 1;
    return [...data].sort((a, b) => compareValues(
      column.sortValue ? column.sortValue(a) : a[sort.key],
      column.sortValue ? column.sortValue(b) : b[sort.key],
    ) * direction);
  }, [columns, data, sort]);

  const keys = rows.map((row, index) => row[rowKey] ?? index);
  const selected = new Set(selectedRows);
  const allSelected = keys.length > 0 && keys.every((key) => selected.has(key));
  const someSelected = keys.some((key) => selected.has(key));
  const toggleAll = (checked) => onSelectionChange?.(checked
    ? Array.from(new Set([...selectedRows, ...keys]))
    : selectedRows.filter((key) => !keys.includes(key)));
  const toggleRow = (key, checked) => onSelectionChange?.(checked
    ? [...selected, key]
    : [...selected].filter((item) => item !== key));
  const clearSelection = () => onSelectionChange?.([]);

  if (loading && !rows.length) {
    return (
      <div className="grid gap-2" role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">در حال بارگذاری جدول…</span>
        {Array.from({ length: 4 }, (_, index) => (
          <TableRowSkeleton key={index} columns={Math.max(1, columns.length + (selectable ? 1 : 0))} />
        ))}
      </div>
    );
  }

  const paginationUi = pagination && Number(pagination.pageCount) > 1 ? (
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="صفحه‌بندی جدول">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        صفحه {Number(pagination.page || 1).toLocaleString("fa-IR")} از {Number(pagination.pageCount).toLocaleString("fa-IR")}
        {Number.isFinite(Number(pagination.total)) ? ` · ${Number(pagination.total).toLocaleString("fa-IR")} ${totalLabel}` : ""}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={pagination.page <= 1 || pagination.disabled} onClick={() => pagination.onPageChange?.(Math.max(1, Number(pagination.page || 1) - 1))}>صفحهٔ قبل</Button>
        <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={pagination.page >= pagination.pageCount || pagination.disabled} onClick={() => pagination.onPageChange?.(Math.min(Number(pagination.pageCount), Number(pagination.page || 1) + 1))}>صفحهٔ بعد</Button>
      </div>
    </nav>
  ) : null;

  if (!rows.length) return <div className="space-y-2"><EmptyState title={emptyTitle} description={emptyDescription} />{paginationUi}</div>;

  return (
    <div className={cn("relative min-w-0", className)} aria-busy={loading || undefined}>
      {selectable && selectedRows.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2" role="group" aria-label="عملیات ردیف‌های انتخاب‌شده">
          <p className="text-sm font-medium" aria-live="polite">
            {selectedRows.length} {selectionLabel}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {typeof selectionActions === "function"
              ? selectionActions({ selectedRows, selectedCount: selectedRows.length, clearSelection })
              : selectionActions}
            <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>
              پاک‌کردن انتخاب
            </Button>
          </div>
        </div>
      ) : null}

      <Table density={density} stickyHeader maxHeight={maxHeight} wrapperClassName="max-w-full">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <TableHeader>
          <TableRow>
            {selectable ? (
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label="انتخاب همهٔ ردیف‌های این صفحه"
                />
              </TableHead>
            ) : null}
            {columns.map((column) => {
              const active = sort?.key === column.key;
              const direction = active ? sort.direction : undefined;
              return (
                <TableHead
                  key={column.key}
                  sortable={Boolean(column.sortable)}
                  sortDirection={direction}
                  onSort={() => updateSort({
                    key: column.key,
                    direction: active && direction === "asc" ? "desc" : "asc",
                  })}
                  className={column.headerClassName}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.header}
                  {column.sortable && !active ? <span className="sr-only"><ChevronsUpDown /></span> : active ? (
                    <span className="sr-only">{direction === "asc" ? "صعودی" : "نزولی"}</span>
                  ) : null}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const key = row[rowKey] ?? index;
            return (
              <TableRow
                key={key}
                selected={selected.has(key)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => {
                  if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onRowClick(row);
                  }
                } : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={getRowClassName?.(row)}
              >
                {selectable ? (
                  <TableCell className="w-12">
                    <Checkbox
                      checked={selected.has(key)}
                      onCheckedChange={(checked) => toggleRow(key, checked)}
                      aria-label={`انتخاب ردیف ${index + 1}`}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </TableCell>
                ) : null}
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.render ? column.render(row, index) : row[column.key]}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <span className="sr-only" role="status" aria-live="polite">
        {loading ? "در حال به‌روزرسانی جدول…" : "جدول به‌روزرسانی شد."}
      </span>
      <LoadingOverlay active={loading} label="در حال به‌روزرسانی جدول…" size="md" />
      {paginationUi}
    </div>
  );
}
