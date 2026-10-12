import StatusBadge from "@/components/shared/StatusBadge";

const CONFIG = {
  draft: {
    label: "پیش‌نویس",
    variant: "neutral",
  },

  preliminary: {
    label: "پیش‌نویس",
    variant: "neutral",
  },

  final: {
    label: "نهایی",
    variant: "normal",
  },

  corrected: {
    label: "اصلاح‌شده",
    variant: "normal",
  },

  superseded: {
    label: "منسوخ‌شده",
    variant: "neutral",
  },

  amended: {
    label: "اصلاح‌شده",
    variant: "normal",
  },
};

export default function LabResultStatus({ status }) {
  const item = CONFIG[status] || {
    label: "نامشخص",
    variant: "neutral",
  };

  return <StatusBadge label={item.label} variant={item.variant} />;
}
