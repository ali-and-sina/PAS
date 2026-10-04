import { cn } from "@/lib/utils";
import { getStatusLabel, getStatusTone } from "@/lib/constants/status";

/** Flag وضعیت هرگز رنگ-تنها نیست — همیشه Label متنی دارد (§43). */
export default function StatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium leading-5",
        getStatusTone(status),
        className,
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}
