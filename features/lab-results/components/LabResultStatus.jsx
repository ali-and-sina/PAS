import StatusBadge from "@/components/shared/StatusBadge";

const CONFIG = {
  draft: {
    label: "پیش‌نویس نتیجه",
    variant: "neutral",
  },

  preliminary: {
    label: "نتیجه اولیه",
    variant: "preliminary",
  },

  final: {
    label: "نهایی",
    variant: "normal",
  },

  corrected: {
    label: "اصلاح‌شده",
    variant: "amended",
  },

  superseded: {
    label: "جایگزین‌شده",
    variant: "superseded",
  },

  amended: {
    label: "اصلاح‌شده",
    variant: "amended",
  },
};

export default function LabResultStatus({ status }) {
  const item = CONFIG[status] || {
    label: "نامشخص",
    variant: "neutral",
  };

  return <StatusBadge label={item.label} variant={item.variant} />;
}
