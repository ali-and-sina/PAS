import Link from "next/link";
import { ArrowLeft, FileCheck2 } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const KIND_LABELS = {
  laboratory: "نتیجه آزمایش",
  imaging: "گزارش تصویربرداری",
  pharmacy: "گزارش تحویل دارو",
  therapy: "گزارش درمان",
  other: "گزارش خدمت درمانی",
};

const ABNORMAL_LABELS = {
  normal: "طبیعی",
  low: "کمتر از محدوده",
  high: "بیشتر از محدوده",
  critical_low: "کمبود بحرانی",
  critical_high: "افزایش بحرانی",
  unknown: "مشخص نشده",
};

const DISPENSE_LABELS = {
  dispensed: "تحویل کامل",
  partially_dispensed: "تحویل بخشی از مقدار",
  substituted: "داروی جایگزین تحویل شد",
  unavailable: "دارو موجود نبود",
  not_dispensed: "تحویل نشد",
};

function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

function formatScalar(value) {
  const isNumericString = typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value.trim());
  if ((typeof value === "number" && Number.isFinite(value)) || isNumericString) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 4 }).format(numericValue);
    }
  }
  return String(value);
}

function Value({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm leading-6">{formatScalar(value)}</dd></div>;
}

function ResultList({ items }) {
  if (!items?.length) return null;
  return (
    <Card>
      <CardHeader className="p-4 sm:p-5"><CardTitle>نتایج خدمات بیمه‌ای</CardTitle></CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
        {items.map((item) => (
          <Link
            key={item.result_id}
            href={`/patient/insurance-results/${item.result_id}`}
            className="group flex min-w-0 flex-col gap-3 rounded-xl border p-4 transition-colors hover:border-primary/40 hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{KIND_LABELS[item.result_kind] || "نتیجه خدمت درمانی"}</p>
                <StatusBadge label={item.result_kind === "imaging" ? "تصویربرداری" : item.result_kind === "pharmacy" ? "داروخانه" : item.result_kind === "laboratory" ? "آزمایشگاه" : "مرکز درمانی"} variant="neutral" />
                {Number(item.version_number) > 1 ? <StatusBadge label={`اصلاحیه ${Number(item.version_number).toLocaleString("fa-IR")}`} variant="amended" /> : null}
              </div>
              <p className="text-sm text-muted-foreground">{item.provider?.display_name || "مرکز ارائه‌دهنده خدمت"}</p>
              <p className="text-xs text-muted-foreground">نهایی‌شدن: {formatDate(item.finalized_at || item.performed_at, true)}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">مشاهده گزارش <ArrowLeft className="size-4" aria-hidden="true" /></span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function LabResultDetails({ values }) {
  if (!values?.length) return <p className="text-sm text-muted-foreground">مقدار ساختاریافته‌ای برای نمایش ثبت نشده است.</p>;
  return (
    <div className="space-y-2">
      {values.map((value, index) => {
        const currentValue = value.value_numeric ?? value.value_text ?? (value.value_boolean === null || value.value_boolean === undefined ? "—" : value.value_boolean ? "بله" : "خیر");
        const hasMin = value.reference_min !== null && value.reference_min !== undefined;
        const hasMax = value.reference_max !== null && value.reference_max !== undefined;
        const reference = value.reference_text || (
          hasMin && hasMax
            ? `${formatScalar(value.reference_min)} تا ${formatScalar(value.reference_max)}`
            : hasMin
              ? `حداقل ${formatScalar(value.reference_min)}`
              : hasMax
                ? `حداکثر ${formatScalar(value.reference_max)}`
                : "ثبت نشده"
        );
        const valueStatusLabel = { preliminary: "موقت", final: "نهایی", corrected: "اصلاح‌شده" }[value.value_status];
        const isNormal = value.abnormal_flag === "normal";
        return (
          <div key={`${value.test_name || "test"}-${index}`} className="grid min-w-0 gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(5.625rem,0.6fr)_minmax(5.625rem,0.7fr)] sm:items-center">
            <div className="min-w-0"><p className="break-words text-sm font-medium">{value.test_name_fa || value.test_name || "آزمایش"}</p><p className="mt-1 text-xs text-muted-foreground">محدوده مرجع: {reference}</p></div>
            <div><p className="text-xs text-muted-foreground">نتیجه</p><p className="mt-1 text-sm font-semibold tabular-nums">{formatScalar(currentValue)} {value.unit || ""}</p>{valueStatusLabel ? <p className="mt-1 text-xs text-muted-foreground">{valueStatusLabel}</p> : null}</div>
            <div><StatusBadge label={ABNORMAL_LABELS[value.abnormal_flag] || "مشخص نشده"} variant={isNormal ? "normal" : value.abnormal_flag?.startsWith("critical") ? "critical" : value.abnormal_flag === "high" ? "high" : value.abnormal_flag === "low" ? "low" : "neutral"} /></div>
          </div>
        );
      })}
    </div>
  );
}

function PharmacyDetails({ items }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground">جزئیات تحویل دارو ثبت نشده است.</p>;
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={`${item.item || "medicine"}-${index}`} className="rounded-xl border p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="font-medium">{item.item || "دارو"}</p><StatusBadge label={DISPENSE_LABELS[item.dispense_status] || "وضعیت ثبت‌شده"} variant={item.dispense_status === "dispensed" ? "normal" : "preliminary"} /></div>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3"><Value label="مقدار تجویزشده" value={item.prescribed_quantity} /><Value label="مقدار تحویل‌شده" value={item.dispensed_quantity} /><Value label="داروی جایگزین" value={item.substitute_display} /><Value label="توضیح عدم تحویل" value={item.not_dispensed_reason} /></dl>
        </div>
      ))}
    </div>
  );
}

function ServiceDetails({ items }) {
  const rows = (items || []).flatMap((item) => Object.entries(item.data || {}).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).map(([key, value]) => ({ key, value: typeof value === "boolean" ? (value ? "بله" : "خیر") : value })));
  if (!rows.length) return <p className="text-sm text-muted-foreground">شرح ساختاریافته دیگری برای این خدمت ثبت نشده است.</p>;
  const labels = { procedure: "اقدام انجام‌شده", findings: "یافته‌ها", impression: "جمع‌بندی", outcome: "نتیجه", assessment: "ارزیابی", goals: "اهداف", plan: "برنامه درمان", duration: "مدت درمان", sessions: "تعداد جلسات", performed_at: "زمان انجام" };
  return <dl className="grid gap-3 sm:grid-cols-2">{rows.map((row, index) => <Value key={`${row.key}-${index}`} label={labels[row.key] || "جزئیات تکمیلی"} value={row.value} />)}</dl>;
}

export function PatientReferralResults({ items }) {
  if (!items?.length) {
    return <Card><CardContent className="p-0"><EmptyState icon={FileCheck2} title="نتیجه بیمه‌ای منتشرشده‌ای ندارید" description="پس از انجام خدمت و نهایی‌شدن گزارش توسط مرکز درمانی، نتیجه در این قسمت نمایش داده می‌شود." /></CardContent></Card>;
  }
  return <ResultList items={items} />;
}

export function PatientReferralResultDetail({ result }) {
  const provider = result.provider || {};
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2"><CardTitle>{KIND_LABELS[result.result_kind] || "نتیجه خدمت درمانی"}</CardTitle><StatusBadge label={Number(result.version_number) > 1 ? "اصلاح‌شده" : "نهایی"} variant={Number(result.version_number) > 1 ? "amended" : "normal"} /></div>
          <p className="text-sm text-muted-foreground">{provider.display_name || "مرکز ارائه‌دهنده خدمت"}</p>
        </CardHeader>
        <CardContent className="grid gap-4 border-t p-4 text-sm sm:grid-cols-3 sm:p-5">
          <Value label="نوع ارائه‌دهنده" value={provider.provider_kind === "pharmacy" ? "داروخانه" : provider.provider_kind === "medical_center" ? "مرکز درمانی" : provider.provider_kind} />
          <Value label="تاریخ انجام خدمت" value={formatDate(result.performed_at, true)} />
          <Value label="تاریخ نهایی‌شدن" value={formatDate(result.finalized_at, true)} />
          <Value label="شماره نسخه نتیجه" value={Number(result.version_number).toLocaleString("fa-IR")} />
        </CardContent>
      </Card>

      {result.laboratory_values?.length ? <Card><CardHeader className="p-4 sm:p-5"><CardTitle>نتایج آزمایش</CardTitle></CardHeader><CardContent className="p-4 pt-0 sm:p-5 sm:pt-0"><LabResultDetails values={result.laboratory_values} /></CardContent></Card> : null}

      {result.imaging_report ? (
        <Card>
          <CardHeader className="p-4 sm:p-5"><CardTitle>گزارش تصویربرداری</CardTitle></CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
            <div className="whitespace-pre-wrap rounded-xl bg-muted/20 p-4 text-sm leading-8">{result.imaging_report.report_text || "متن گزارش ثبت نشده است."}</div>
            <dl className="grid gap-4 sm:grid-cols-2"><Value label="یافته‌ها" value={result.imaging_report.findings} /><Value label="جمع‌بندی گزارش" value={result.imaging_report.impression} /></dl>
            {result.imaging_report.images_available ? <p className="text-xs text-muted-foreground">تصاویر پزشکی در سامانه ذخیره‌سازی مرکز موجود است؛ نمایش مستقیم تصویر در این نسخه از رابط فعال نشده است.</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {result.pharmacy_dispenses?.length ? <Card><CardHeader className="p-4 sm:p-5"><CardTitle>وضعیت تحویل دارو</CardTitle></CardHeader><CardContent className="p-4 pt-0 sm:p-5 sm:pt-0"><PharmacyDetails items={result.pharmacy_dispenses} /></CardContent></Card> : null}

      {result.service_results?.length ? <Card><CardHeader className="p-4 sm:p-5"><CardTitle>گزارش خدمت درمانی</CardTitle></CardHeader><CardContent className="p-4 pt-0 sm:p-5 sm:pt-0"><ServiceDetails items={result.service_results} /></CardContent></Card> : null}
    </div>
  );
}
