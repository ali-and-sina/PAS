import { Beaker, FlaskConical, ListChecks, PencilLine } from "lucide-react";
import StatCard from "@/components/shared/StatCard";

const ITEMS = [
  {
    key: "newOrders",
    label: "پذیرش جدید",
    icon: Beaker,
    href: "/lab/orders?status=pending",
    tone: "info",
  },
  {
    key: "inProgress",
    label: "در حال انجام",
    icon: FlaskConical,
    href: "/lab/orders?status=in_progress",
    tone: "warning",
  },
  {
    key: "draftReports",
    label: "پیش‌نویس نتیجه",
    icon: PencilLine,
    href: "/lab/results?status=draft",
    tone: "neutral",
  },
  {
    key: "readyToFinalize",
    label: "آماده نهایی‌سازی",
    icon: ListChecks,
    href: "/lab/results?status=ready_to_finalize",
    tone: "normal",
  },
];

export default function LabDashboardStats({ data }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {ITEMS.map((item) => {
        const value = Number(data?.[item.key] || 0);
        const { key, ...props } = item;
        return <StatCard key={key} {...props} value={value} />;
      })}
    </div>
  );
}
