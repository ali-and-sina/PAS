import FlagBadge from "@/components/shared/FlagBadge";
import StatusBadge from "@/components/shared/StatusBadge";
import { getTestDisplayName } from "@/lib/medical/test-name";
import {
  formatReferenceRange,
  getReferenceSourceLabel,
} from "@/features/lab-results/reference-format";
import LabResultRow from "./LabResultRow";

function formatValue(observation) {
  if (observation.value_numeric != null) return String(observation.value_numeric);
  if (observation.value_text != null) return observation.value_text;
  if (observation.value_boolean != null) return observation.value_boolean ? "مثبت / بله" : "منفی / خیر";
  return "—";
}

function LabResultCard({ observation }) {
  const referenceRange = formatReferenceRange(observation);
  const referenceSource = getReferenceSourceLabel(observation.reference_source);

  return (
    <article className="min-w-0 rounded-xl border bg-card p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words font-semibold">{getTestDisplayName(observation.test)}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{observation.test?.internal_code || "بدون کد"}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <FlagBadge flag={observation.flag || "normal"} />
          {observation.status === "corrected" && <StatusBadge label="اصلاح‌شده" variant="amended" />}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-3">
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">نتیجه</dt>
          <dd className="mt-1 break-words text-base font-semibold tabular-nums">{formatValue(observation)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">واحد</dt>
          <dd className="mt-1 break-words text-sm">{observation.unit || "—"}</dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-xs text-muted-foreground">محدودهٔ مرجع</dt>
          <dd className="mt-1 break-words text-sm leading-6">{referenceRange || "محدوده مرجع ثبت نشده"}</dd>
        </div>
      </dl>
      {referenceSource && <div className="mt-3 border-t pt-3"><StatusBadge label={referenceSource} variant="neutral" /></div>}
    </article>
  );
}

export default function LabResultTable({ observations = [] }) {
  if (!observations.length) {
    return <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">موردی برای نمایش در این گزارش ثبت نشده است.</p>;
  }

  return (
    <div className="min-w-0">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:hidden">
        {observations.map((observation) => <LabResultCard key={observation.id} observation={observation} />)}
      </div>
      <div className="hidden overflow-hidden rounded-xl border bg-card lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th scope="col" className="p-3 text-start">آزمایش</th>
                <th scope="col" className="p-3 text-start">نتیجه</th>
                <th scope="col" className="p-3 text-start">واحد</th>
                <th scope="col" className="p-3 text-start">محدوده مرجع</th>
                <th scope="col" className="p-3 text-start">وضعیت</th>
              </tr>
            </thead>
            <tbody>{observations.map((observation) => <LabResultRow key={observation.id} observation={observation} />)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
