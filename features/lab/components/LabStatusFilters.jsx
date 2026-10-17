import StatusFilterLinks from "@/features/lab/components/StatusFilterLinks";

const FILTERS = [
  { value: "", label: "همه پذیرش‌ها" },
  { value: "pending", label: "در انتظار پذیرش" },
  { value: "received_by_lab", label: "پذیرفته‌شده" },
  { value: "in_progress", label: "در حال انجام" },
  { value: "completed", label: "تکمیل‌شده" },
  { value: "cancelled", label: "لغوشده" },
];

export default function LabStatusFilters({ active = "" }) {
  return (
    <StatusFilterLinks
      filters={FILTERS}
      active={active}
      pathname="/lab/orders"
      ariaLabel="فیلتر وضعیت پذیرش"
    />
  );
}
