import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * @param {{ filters: Array<{value: string, label: string}>, active?: string, pathname: string, ariaLabel: string }} props
 */
export default function StatusFilterLinks({
  filters,
  active = "",
  pathname,
  ariaLabel,
}) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label={ariaLabel}>
      {filters.map((filter) => {
        const selected = active === filter.value;
        const href = filter.value
          ? `${pathname}?status=${encodeURIComponent(filter.value)}`
          : pathname;

        return (
          <Link
            key={filter.value || "all"}
            href={href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 max-w-full items-center justify-center rounded-full border px-3 py-2 text-center text-xs font-medium leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {filter.label}
          </Link>
        );
      })}
    </nav>
  );
}
