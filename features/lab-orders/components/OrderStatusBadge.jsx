import StatusBadge from "@/components/shared/StatusBadge";

const CONFIG = {
  pending: { label: "جدید", variant: "neutral" },
  received_by_lab: { label: "دریافت‌شده", variant: "normal" },
  in_progress: { label: "در حال انجام", variant: "neutral" },
  completed: { label: "تکمیل‌شده", variant: "normal" },
  cancelled: { label: "لغوشده", variant: "critical" },
};

export default function OrderStatusBadge({ status }) {
  const item = CONFIG[status] || { label: status || "نامشخص", variant: "neutral" };
  return <StatusBadge label={item.label} variant={item.variant} />;
}
