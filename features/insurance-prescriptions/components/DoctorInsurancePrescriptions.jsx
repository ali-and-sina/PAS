import Link from "next/link";
import { ArrowLeft, FileCheck2 } from "lucide-react";
import DisclosureSection from "@/components/shared/DisclosureSection";
import StatusBadge from "@/components/shared/StatusBadge";

const PAYER_LABELS = {
  tamin: "تأمین اجتماعی",
  ihio: "بیمه سلامت",
  armed_forces: "نیروهای مسلح",
};

const ITEM_KIND_LABELS = {
  laboratory: "آزمایش",
  imaging: "تصویربرداری",
  medication: "دارو",
  medical_service: "خدمت درمانی",
  other: "خدمت دیگر",
};

const STATUS_LABELS = {
  ready_for_routing: "آماده ارجاع",
  partially_routed: "بخشی از خدمات ارجاع شده",
  routed: "ارجاع‌شده",
  completed: "خدمات تکمیل‌شده",
  assigned: "ارجاع‌شده به مرکز",
  accepted: "پذیرفته‌شده",
  in_progress: "در حال انجام",
  partially_completed: "تکمیل بخشی از خدمات",
  result_submitted: "نتیجه ارسال‌شده",
  finalized: "نتیجه نهایی",
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(date);
}

export default function DoctorInsurancePrescriptions({ data, patientId }) {
  if (!data?.scope_available) {
    const unavailable = data?.unavailable === true;
    return (
      <DisclosureSection
        title="نسخه‌ها و ارجاع‌های بیمه‌ای"
        description="دسترسی به این اطلاعات بر اساس مجوز پرونده کنترل می‌شود."
        meta={unavailable ? "سرویس موقتاً در دسترس نیست" : "محدود به مجوز پرونده"}
      >
        <p className="rounded-lg border border-dashed p-4 text-sm leading-6 text-muted-foreground">
          {unavailable
            ? "سرویس نسخه‌های بیمه‌ای پزشک هنوز در پایگاه داده در دسترس نیست. سایر بخش‌های پرونده بیمار قابل استفاده‌اند؛ برای فعال‌شدن این قسمت، تابع مخصوص پزشک باید در پایگاه داده منتشر و کش طرحواره به‌روزرسانی شود."
            : "این بخش با مجوز فعلی پرونده در دسترس نیست. برای مشاهده نسخه‌ها و نتایج بیمه‌ای، بیمار باید دامنه دسترسی مرتبط را فعال کند."}
        </p>
      </DisclosureSection>
    );
  }

  const prescriptions = Array.isArray(data.items) ? data.items : [];
  const total = Number(data.total || 0);
  const limit = Number(data.limit || 10);
  const offset = Number(data.offset || 0);
  return (
    <DisclosureSection
      title="نسخه‌ها و ارجاع‌های بیمه‌ای"
      description="فقط اقلام و نتایجی نمایش داده می‌شوند که دامنه دسترسی آن‌ها در پرونده فعال است."
      meta={`${total.toLocaleString("fa-IR")} نسخهٔ قابل مشاهده`}
    >
      {!prescriptions.length ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">نسخه بیمه‌ای قابل مشاهده‌ای در محدوده مجوز فعلی ثبت نشده است.</p>
      ) : (
        <div className="space-y-3">
          {prescriptions.map((prescription) => (
            <article key={prescription.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">نسخه {PAYER_LABELS[prescription.payer_key] || "بیمه‌گر"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">دریافت: {formatDate(prescription.source_received_at)}</p>
                </div>
                {prescription.status ? <StatusBadge label={prescription.is_expired ? "منقضی‌شده" : STATUS_LABELS[prescription.status] || "وضعیت ثبت‌شده"} variant={prescription.is_expired ? "neutral" : prescription.status === "completed" ? "normal" : "preliminary"} /> : null}
              </div>

              {prescription.items?.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {prescription.items.map((item) => (
                    <div key={item.id} className="rounded-lg bg-muted/25 p-3">
                      <p className="break-words text-sm font-medium">{item.display || "خدمت"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{ITEM_KIND_LABELS[item.item_kind] || "خدمت"} · {Number(item.quantity).toLocaleString("fa-IR")} {item.unit}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {prescription.referrals?.length ? (
                <div className="mt-3 space-y-2 border-t pt-3">
                  {prescription.referrals.map((referral) => (
                    <div key={referral.referral_id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{referral.provider?.display_name || "مرکز ارائه‌دهنده خدمت"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{referral.status ? (STATUS_LABELS[referral.status] || "وضعیت ثبت‌شده") : "وضعیت کلی خارج از دامنهٔ مجوز فعلی است."}</p>
                      </div>
                      {referral.results?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {referral.results.map((result) => (
                            <Link key={result.result_id} href={`/doctor/insurance-results/${result.result_id}`} className="inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 text-xs font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              مشاهده نتیجه <ArrowLeft className="size-3.5" aria-hidden="true" />
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">نتیجه نهایی منتشر نشده است.</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
      {total > limit && patientId ? (
        <nav className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3" aria-label="صفحه‌بندی نسخه‌های بیمه‌ای بیمار">
          <p className="text-xs text-muted-foreground">نمایش {(offset + 1).toLocaleString("fa-IR")} تا {Math.min(offset + prescriptions.length, total).toLocaleString("fa-IR")} از {total.toLocaleString("fa-IR")} نسخهٔ قابل مشاهده</p>
          <div className="flex items-center gap-2">
            {offset > 0 ? <Link href={`/doctor/patients/${patientId}?insuranceOffset=${Math.max(0, offset - limit)}`} className="inline-flex min-h-10 items-center rounded-lg border px-3 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">صفحهٔ قبل</Link> : null}
            {offset + limit < total ? <Link href={`/doctor/patients/${patientId}?insuranceOffset=${offset + limit}`} className="inline-flex min-h-10 items-center rounded-lg border px-3 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">صفحهٔ بعد</Link> : null}
          </div>
        </nav>
      ) : null}
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><FileCheck2 className="size-4" aria-hidden="true" /> نسخه‌های بیمه‌ای از نسخه‌هایی که پزشک در پاس ثبت می‌کند جدا هستند.</p>
    </DisclosureSection>
  );
}
