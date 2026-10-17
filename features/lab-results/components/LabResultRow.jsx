import FlagBadge from "@/components/shared/FlagBadge";
import { getTestDisplayName } from "@/lib/medical/test-name";
import StatusBadge from "@/components/shared/StatusBadge";
import {
  formatReferenceRange,
  getReferenceSourceLabel,
} from "@/features/lab-results/reference-format";

function formatValue(observation) {
  if (observation.value_numeric != null)
    return String(observation.value_numeric);
  if (observation.value_text != null) return observation.value_text;
  if (observation.value_boolean != null) {
    return observation.value_boolean ? "مثبت / بله" : "منفی / خیر";
  }
  return "—";
}

export default function LabResultRow({ observation }) {
  const label = getTestDisplayName(observation.test);
  const value = formatValue(observation);
  const range = formatReferenceRange(observation);
  const referenceSourceLabel = getReferenceSourceLabel(
    observation.reference_source,
  );
  const flag = observation.flag || "normal";

  return (
    <tr className="border-b last:border-b-0">
      <td className="p-3 font-medium">
        <div>{label}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {observation.test?.internal_code || "بدون کد"}
        </div>
      </td>
      <td className="p-3 tabular-nums">{value}</td>
      <td className="p-3">{observation.unit || "—"}</td>
      <td className="p-3 text-muted-foreground">
        {range || "محدوده مرجع ثبت نشده"}
      </td>
      <td className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <FlagBadge flag={flag} />
          {observation.status === "corrected" ? (
            <StatusBadge label="اصلاح‌شده" variant="amended" />
          ) : null}
          {referenceSourceLabel ? (
            <StatusBadge label={referenceSourceLabel} variant="neutral" />
          ) : null}
        </div>
      </td>
    </tr>
  );
}
