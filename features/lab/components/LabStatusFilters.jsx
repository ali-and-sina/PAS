import Link from "next/link";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "", label: "همه پذیرش‌ها" },
  { value: "pending", label: "جدید" },
  { value: "received_by_lab", label: "پذیرفته‌شده" },
  { value: "in_progress", label: "در حال انجام" },
  { value: "completed", label: "تکمیل‌شده" },
  { value: "cancelled", label: "لغوشده" },
];

export default function LabStatusFilters({ active = "" }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" aria-label="فیلتر وضعیت پذیرش">
      {FILTERS.map((filter) => {
        const href = filter.value
          ? `/lab/orders?status=${encodeURIComponent(filter.value)}`
          : "/lab/orders";
        const selected = active === filter.value;

        return (
          <Link
            key={filter.value || "all"}
            href={href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
