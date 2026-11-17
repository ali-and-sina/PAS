"use client"
import * as React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const TableContext = React.createContext({ density: "comfortable", stickyHeader: false });

const Table = React.forwardRef(({ className, wrapperClassName, density = "comfortable", stickyHeader = false, maxHeight, children, ...props }, ref) => (
  <TableContext.Provider value={{ density, stickyHeader }}>
    <div className={cn("relative w-full overflow-x-auto rounded-xl border border-border/70", maxHeight && "overflow-y-auto", wrapperClassName)} style={maxHeight ? { maxHeight } : undefined}>
      <table ref={ref} data-density={density} className={cn("w-full caption-bottom text-sm", className)} {...props}>
        {children}
      </table>
    </div>
  </TableContext.Provider>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef(({ className, sticky, ...props }, ref) => {
  const context = React.useContext(TableContext);
  return <thead ref={ref} className={cn("bg-muted/60 [&_tr]:border-b", (sticky ?? context.stickyHeader) && "sticky top-0 z-sticky", className)} {...props} />;
});
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef(({ className, ...props }, ref) => (
  <tfoot ref={ref} className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef(({ className, selected, "data-state": dataState, ...props }, ref) => (
  <tr ref={ref} data-state={selected ? "selected" : dataState} className={cn("border-b border-border/75 transition-colors hover:bg-accent/35 data-[state=selected]:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", className)} {...props} />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef(({ className, sortable = false, sortDirection, onSort, children, ...props }, ref) => {
  const context = React.useContext(TableContext);
  const sortIcon = sortDirection === "asc" ? <ChevronUp className="size-3.5" aria-hidden="true" /> : sortDirection === "desc" ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden="true" />;
  const ariaSort = sortDirection === "asc" ? "ascending" : sortDirection === "desc" ? "descending" : sortable ? "none" : undefined;
  return (
    <th ref={ref} aria-sort={ariaSort} className={cn("h-12 whitespace-nowrap px-4 text-start align-middle text-xs font-semibold text-muted-foreground [&:has([role=checkbox])]:ps-0 [&>[role=checkbox]]:translate-y-[0.125rem]", context.density === "compact" && "h-9 px-3", className)} {...props}>
      {sortable ? <button type="button" onClick={onSort} className="inline-flex min-h-11 items-center gap-2 rounded-md text-start text-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring" aria-label={props["aria-label"] || `مرتب‌سازی بر اساس ${typeof children === "string" ? children : "این ستون"}`}>
        {children}{sortIcon}
      </button> : children}
    </th>
  );
});
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef(({ className, ...props }, ref) => {
  const context = React.useContext(TableContext);
  return <td ref={ref} className={cn("px-4 py-3.5 align-middle leading-6 [&:has([role=checkbox])]:ps-0 [&>[role=checkbox]]:translate-y-[0.125rem]", context.density === "compact" && "px-3 py-2", className)} {...props} />;
});
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
));
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
