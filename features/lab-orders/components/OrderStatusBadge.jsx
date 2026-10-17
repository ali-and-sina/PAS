import StatusBadge from "@/components/shared/StatusBadge";

const CONFIG = {
  pending: { label: "در انتظار پذیرش", variant: "neutral" },
  received_by_lab: { label: "پذیرفته‌شده", variant: "normal" },
  in_progress: { label: "در حال انجام", variant: "neutral" },
  completed: { label: "تکمیل‌شده", variant: "normal" },
  cancelled: { label: "لغوشده", variant: "neutral" },
};

export default function OrderStatusBadge({ status }) {
  const item = CONFIG[status] || { label: "نامشخص", variant: "neutral" };
  return <StatusBadge label={item.label} variant={item.variant} />;
}
