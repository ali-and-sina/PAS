import Link from "next/link";
import { ArrowLeft, ClipboardList, FileCheck2 } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReferralQrDialog from "@/features/insurance-prescriptions/components/ReferralQrDialog";

const PAYER_LABELS = {
  tamin: "تأمین اجتماعی",
  ihio: "بیمه سلامت",
  armed_forces: "نیروهای مسلح",
};

const PRESCRIPTION_STATUS = {
  received: "دریافت‌شده",
  pending_identity_review: "در انتظار بررسی هویت",
  ready_for_routing: "آماده ارجاع",
  partially_routed: "بخشی از خدمات ارجاع شده",
  routed: "ارجاع‌شده به مراکز",
  partially_completed: "در حال تکمیل خدمات",
  completed: "خدمات تکمیل‌شده",
  cancelled: "لغوشده",
  rejected: "ردشده",
};

const REFERRAL_STATUS = {
  assigned: "ارجاع‌شده به مرکز",
  accepted: "پذیرفته‌شده",
  in_progress: "در حال انجام",
  partially_completed: "تکمیل بخشی از خدمات",
  completed: "خدمت انجام‌شده",
  result_submitted: "نتیجه ارسال‌شده",
  finalized: "نتیجه نهایی",
  rejected: "پذیرفته‌نشده",
  cancelled: "لغوشده",
};

const ITEM_KIND_LABELS = {
  laboratory: "آزمایش",
  imaging: "تصویربرداری",
  medication: "دارو",
  medical_service: "خدمت درمانی",
  other: "خدمت دیگر",
};

const ITEM_STATUS_LABELS = {
  active: "فعال",
  assigned: "ارجاع‌شده",
  accepted: "پذیرفته‌شده",
  in_progress: "در حال انجام",
  partially_completed: "تکمیل بخشی از مقدار",
  completed: "انجام‌شده",
  rejected: "پذیرفته‌نشده",
  cancelled: "لغوشده",
  replaced: "جایگزین‌شده",
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

function formatQuantity(value, unit) {
  const formatted = Number.isFinite(Number(value))
    ? new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 3 }).format(Number(value))
    : String(value ?? "—");
  return [formatted, unit].filter(Boolean).join(" ");
}

function ProviderKindLabel({ kind }) {
  const label = kind === "medical_center"
    ? "مرکز درمانی"
    : kind === "pharmacy"
      ? "داروخانه"
      : "ارائه‌دهنده خدمت";
  return <span className="text-xs text-muted-foreground">{label}</span>;
}

function ReferralCard({ prescription, referral }) {
  const canIssueQr = !prescription.is_expired
    && !["cancelled", "rejected"].includes(prescription.status)
    && ["assigned", "accepted", "in_progress", "partially_completed"].includes(referral.status);
  const items = Array.isArray(referral.items) ? referral.items : [];
  const results = Array.isArray(referral.results) ? referral.results : [];

  return (
    <div className="rounded-xl border bg-background p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{referral.provider?.display_name || "مرکز مقصد"}</p>
            <ProviderKindLabel kind={referral.provider?.provider_kind} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={REFERRAL_STATUS[referral.status] || "وضعیت ثبت‌شده"} variant={referral.status === "finalized" || referral.status === "completed" ? "normal" : referral.status === "rejected" || referral.status === "cancelled" ? "neutral" : "preliminary"} />
            <span className="text-xs text-muted-foreground">ارجاع: {formatDate(referral.assigned_at, true)}</span>
          </div>
          {referral.active_qr_expires_at ? (
        <p className="mt-2 text-xs text-muted-foreground">کد پذیرش فعال تا {formatDate(referral.active_qr_expires_at, true)} معتبر است؛ برای نمایش دوباره، کد تازه صادر کنید.</p>
      ) : null}
      {referral.provider_admission_reference ? (
            <p className="text-xs text-muted-foreground">شناسه پذیرش مرکز: <bdi dir="ltr" className="font-mono">{referral.provider_admission_reference}</bdi></p>
          ) : null}
        </div>
        <div className="shrink-0">
          <ReferralQrDialog mode="patient" referralId={referral.referral_id} disabled={!canIssueQr} />
        </div>
      </div>

      {items.length ? (
        <div className="mt-3 space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">خدمات همین مرکز</p>
          {items.map((item) => (
            <div key={item.referral_item_id} className="flex min-w-0 flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <span className="font-medium">{item.display || "خدمت"}</span>
                <span className="mr-2 text-xs text-muted-foreground">{ITEM_KIND_LABELS[item.item_kind] || "خدمت"}</span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatQuantity(item.quantity, item.unit)}</span>
                <span>{ITEM_STATUS_LABELS[item.item_status] || "در جریان"}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {results.length ? (
        <div className="mt-3 border-t pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">نتایج نهایی منتشرشده</p>
          <div className="flex flex-wrap gap-2">
            {results.map((result) => (
              <Link
                key={result.result_id}
                href={`/patient/insurance-results/${result.result_id}`}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 text-xs font-medium text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                مشاهده نتیجه {result.version_number > 1 ? `(اصلاحیه ${result.version_number})` : ""}
                <ArrowLeft className="size-3.5" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {!canIssueQr && !["completed", "result_submitted", "finalized", "rejected", "cancelled"].includes(referral.status) ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">به‌دلیل پایان اعتبار نسخه، صدور کد پذیرش تازه امکان‌پذیر نیست.</p>
      ) : null}
    </div>
  );
}

export default function PatientInsurancePrescriptions({ data, internalPage = 1 }) {
  const prescriptions = Array.isArray(data?.items) ? data.items : [];
  const total = Number(data?.total || 0);
  const limit = Number(data?.limit || 30);
  const offset = Number(data?.offset || 0);
  const previousOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;

  return (
    <section className="space-y-3" aria-labelledby="insurance-prescriptions-heading">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ClipboardList className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="insurance-prescriptions-heading" className="font-semibold">نسخه‌های بیمه‌ای</h2>
          <p className="mt-1 text-sm text-muted-foreground">نسخه‌های دریافتی از بیمه‌گر و وضعیت هر مرکز مقصد را از این قسمت پیگیری کنید.</p>
        </div>
      </div>

      {data?.unavailable ? (
        <Card role="alert">
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-medium text-destructive">
              دریافت نسخه‌های بیمه‌ای در حال حاضر امکان‌پذیر نیست.
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              سرویس دریافت نسخه‌های بیمه‌ای موقتاً در دسترس نیست. اطلاعات نسخه‌های ثبت‌شده در پاس همچنان در ادامهٔ صفحه نمایش داده می‌شود.
            </p>
          </CardContent>
        </Card>
      ) : !prescriptions.length ? (
        <Card><CardContent className="p-0"><EmptyState icon={FileCheck2} title="نسخه بیمه‌ای ثبت‌شده‌ای ندارید" description="نسخه‌های بیمه‌ای پس از دریافت و تطبیق هویت، در این بخش قابل مشاهده می‌شوند." /></CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {prescriptions.map((prescription) => {
            const referrals = Array.isArray(prescription.referrals) ? prescription.referrals : [];
            const currentItems = (prescription.items || []).filter((item) => item.item_status === "active");
            const stateLabel = prescription.is_expired
              ? "منقضی‌شده"
              : PRESCRIPTION_STATUS[prescription.status] || "وضعیت ثبت‌شده";
            return (
              <Card key={prescription.id}>
                <CardHeader className="space-y-3 p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">نسخه {PAYER_LABELS[prescription.payer_key] || "بیمه‌گر"}</CardTitle>
                        <StatusBadge label={stateLabel} variant={prescription.is_expired ? "neutral" : prescription.status === "completed" ? "normal" : "preliminary"} />
                      </div>
                      <p className="text-xs text-muted-foreground">دریافت: {formatDate(prescription.source_received_at, true)}{prescription.issued_at ? ` · صدور: ${formatDate(prescription.issued_at)}` : ""}</p>
                    </div>
                    <div className="text-xs text-muted-foreground sm:text-left">
                      <p>شناسه پیگیری</p>
                      <bdi dir="ltr" className="mt-1 inline-block font-mono text-foreground">{prescription.external_tracking_number || prescription.external_prescription_id}</bdi>
                    </div>
                  </div>
                  {prescription.expires_at ? (
                    <p className="text-xs text-muted-foreground">اعتبار نسخه تا {formatDate(prescription.expires_at, true)}</p>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4 border-t p-4 sm:p-5">
                  {currentItems.length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">اقلام فعال نسخه</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {currentItems.map((item) => (
                          <div key={item.id} className="min-w-0 rounded-lg bg-muted/25 p-3">
                            <p className="break-words text-sm font-medium">{item.display}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{ITEM_KIND_LABELS[item.item_kind] || "خدمت"} · {formatQuantity(item.quantity, item.unit)}</p>
                            {item.mapping_status !== "mapped" ? <p className="mt-1 text-xs text-muted-foreground">در انتظار تطبیق خدمت</p> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {referrals.length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">پیگیری مراکز مقصد</p>
                      {referrals.map((referral) => <ReferralCard key={referral.referral_id} prescription={prescription} referral={referral} />)}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">این نسخه هنوز به مرکز یا داروخانه‌ای ارجاع نشده است.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {total > limit ? (
        <nav className="flex flex-wrap items-center justify-between gap-3 border-t pt-3" aria-label="صفحه‌بندی نسخه‌های بیمه‌ای">
          <p className="text-xs text-muted-foreground">نمایش {(offset + 1).toLocaleString("fa-IR")} تا {Math.min(offset + prescriptions.length, total).toLocaleString("fa-IR")} از {total.toLocaleString("fa-IR")} نسخه</p>
          <div className="flex items-center gap-2">
            {offset > 0 ? <Link href={`/patient/prescriptions?page=${encodeURIComponent(internalPage)}&insuranceOffset=${previousOffset}`} className="inline-flex min-h-10 items-center rounded-lg border px-3 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">صفحهٔ قبل</Link> : null}
            {nextOffset < total ? <Link href={`/patient/prescriptions?page=${encodeURIComponent(internalPage)}&insuranceOffset=${nextOffset}`} className="inline-flex min-h-10 items-center rounded-lg border px-3 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">صفحهٔ بعد</Link> : null}
          </div>
        </nav>
      ) : null}
    </section>
  );
}
