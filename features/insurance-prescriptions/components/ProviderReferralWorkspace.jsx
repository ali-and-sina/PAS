"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ClipboardCheck, FileCheck2, FileText, RefreshCw } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import ConfirmActionButton from "@/components/shared/ConfirmActionButton";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReferralQrDialog from "@/features/insurance-prescriptions/components/ReferralQrDialog";
import DeferredReferralQrScanner from "@/features/insurance-prescriptions/components/DeferredReferralQrScanner";
import { finalizeProviderResult, respondToProviderReferral, updateProviderReferralItem } from "@/features/insurance-prescriptions/actions";

const PAYER_LABELS = { tamin: "تأمین اجتماعی", ihio: "بیمه سلامت", armed_forces: "نیروهای مسلح" };
const ITEM_KIND_LABELS = { laboratory: "آزمایش", imaging: "تصویربرداری", medication: "دارو", medical_service: "خدمت پزشکی", other: "سایر خدمات" };
const STATUS_LABELS = {
  assigned: "ارجاع‌شده",
  accepted: "پذیرفته‌شده",
  in_progress: "در حال انجام",
  partially_completed: "تکمیل بخشی از اقلام",
  completed: "خدمت انجام‌شده",
  result_submitted: "نتیجه ارسال‌شده",
  finalized: "نهایی‌شده",
  rejected: "ردشده",
  cancelled: "لغوشده",
};
const FILTERS = [
  { value: "all", label: "همه" },
  { value: "assigned", label: "جدید" },
  { value: "accepted", label: "پذیرفته‌شده" },
  { value: "in_progress", label: "در حال انجام" },
  { value: "partially_completed", label: "تکمیل ناقص" },
  { value: "completed", label: "خدمت انجام‌شده" },
  { value: "result_submitted", label: "نتیجه ارسال‌شده" },
  { value: "finalized", label: "نهایی‌شده" },
];

function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function ItemAction({ type, scope = "center", referral, item, canMutate, pageOffset, filterStatus = null }) {
  const router = useRouter();
  const [completedQuantity, setCompletedQuantity] = useState("");
  const [pending, startTransition] = useTransition();
  const itemQuantity = Number(item.quantity || 0);
  const currentCompleted = Number(item.completed_quantity || 0);
  const isMedication = item.item_kind === "medication";

  function update(nextStatus, quantity = null) {
    startTransition(async () => {
      const result = await updateProviderReferralItem({
        scope,
        type,
        referralId: referral.referral_id,
        referralStatus: referral.status,
        filterStatus,
        pageOffset,
        referralItemId: item.referral_item_id,
        nextStatus,
        completedQuantity: quantity,
      });
      if (!result?.ok) {
        toast.error(result?.message || "تغییر وضعیت قلم انجام نشد.");
        return;
      }
      setCompletedQuantity("");
      toast.success("وضعیت قلم به‌روزرسانی شد.");
      router.refresh();
    });
  }

  async function confirmCancelItem() {
    const result = await updateProviderReferralItem({
      scope,
      type,
      referralId: referral.referral_id,
      referralStatus: referral.status,
      filterStatus,
      pageOffset,
      referralItemId: item.referral_item_id,
      nextStatus: "cancelled",
      completedQuantity: null,
    });
    if (!result?.ok) return { ok: false, message: result?.message || "لغو قلم انجام نشد." };
    setCompletedQuantity("");
    toast.success("قلم ارجاع لغو شد.");
    router.refresh();
    return { ok: true };
  }

  if (item.status === "completed") return <StatusBadge label={STATUS_LABELS.completed} variant="normal" />;
  if (["rejected", "cancelled"].includes(item.status)) {
    return <StatusBadge label={item.status === "rejected" ? STATUS_LABELS.rejected : STATUS_LABELS.cancelled} variant="neutral" />;
  }
  if (!canMutate) return <span className="text-xs text-muted-foreground">دسترسی فقط خواندنی</span>;

  if (item.status === "assigned") {
    return <Button type="button" size="sm" className="min-h-11" onClick={() => update("accepted")} disabled={pending}><ClipboardCheck className="size-4" aria-hidden="true" />پذیرش قلم</Button>;
  }

  if (item.status === "accepted") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => update("in_progress")} loading={pending} disabled={pending}>
          <ClipboardCheck className="size-4" aria-hidden="true" />
          شروع انجام
        </Button>
        <ConfirmActionButton type="button" size="sm" variant="ghost" className="min-h-11 text-destructive hover:text-destructive" onConfirm={confirmCancelItem} destructive confirmTitle="لغو قلم ارجاع" confirmDescription="این قلم از ارجاع لغو می‌شود و این تغییر در سابقه ثبت خواهد شد." confirmLabel="لغو قلم">لغو قلم</ConfirmActionButton>
      </div>
    );
  }

  if (isMedication) {
    return (
      <div className="flex flex-col gap-2 sm:items-start">
        <p className="max-w-xs text-xs leading-5 text-muted-foreground">ثبت مقدار تحویل و وضعیت دارو باید از اتصال یکپارچه داروخانه ارسال شود؛ این قلم از مسیر عمومی تکمیل نمی‌شود.</p>
        {["in_progress", "partially_completed"].includes(item.status) ? <ConfirmActionButton type="button" size="sm" variant="ghost" className="min-h-11 text-destructive hover:text-destructive" onConfirm={confirmCancelItem} destructive confirmTitle="لغو قلم ارجاع" confirmDescription="این قلم از ارجاع لغو می‌شود و این تغییر در سابقه ثبت خواهد شد." confirmLabel="لغو قلم">لغو قلم</ConfirmActionButton> : null}
      </div>
    );
  }

  if (item.status === "in_progress") {
    const parsedQuantity = Number(completedQuantity);
    const validPartial = Number.isFinite(parsedQuantity) && parsedQuantity > currentCompleted && parsedQuantity < itemQuantity;
    return (
      <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:min-w-[13.75rem]">
        <form
          className="flex min-w-0 flex-col gap-2 sm:flex-row"
          onSubmit={(event) => { event.preventDefault(); if (validPartial) update("partially_completed", parsedQuantity); }}
        >
          <label className="grid min-w-0 flex-1 gap-1 text-xs text-muted-foreground">
            مقدار تکمیل‌شده
            <Input
              type="number"
              inputMode="decimal"
              min={currentCompleted > 0 ? currentCompleted + 0.000001 : 0.000001}
              max={itemQuantity - 0.000001}
              step="any"
              value={completedQuantity}
              onChange={(event) => setCompletedQuantity(event.target.value)}
              placeholder={`کمتر از ${itemQuantity}`}
              aria-label={`مقدار تکمیل‌شده برای ${item.display || "قلم ارجاع"}`}
              className="h-10 w-full sm:w-28"
              disabled={pending}
            />
          </label>
          <Button type="submit" size="sm" variant="outline" className="min-h-11 self-end" loading={pending} disabled={pending || !validPartial}>
            
            ثبت بخشی
          </Button>
        </form>
        <Button type="button" size="sm" className="min-h-11" onClick={() => update("completed", itemQuantity)} loading={pending} disabled={pending}>
          <ClipboardCheck className="size-4" aria-hidden="true" />
          ثبت انجام کامل
        </Button>
        <ConfirmActionButton type="button" size="sm" variant="ghost" className="min-h-11 self-start text-destructive hover:text-destructive" onConfirm={confirmCancelItem} destructive confirmTitle="لغو قلم ارجاع" confirmDescription="این قلم از ارجاع لغو می‌شود و این تغییر در سابقه ثبت خواهد شد." confirmLabel="لغو قلم">لغو قلم</ConfirmActionButton>
      </div>
    );
  }

  if (item.status === "partially_completed") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => update("in_progress")} loading={pending} disabled={pending}>ادامه انجام</Button>
        <Button type="button" size="sm" className="min-h-11" onClick={() => update("completed", itemQuantity)} loading={pending} disabled={pending}>
          <ClipboardCheck className="size-4" aria-hidden="true" />
          تکمیل باقی‌مانده
        </Button>
        <ConfirmActionButton type="button" size="sm" variant="ghost" className="min-h-11 text-destructive hover:text-destructive" onConfirm={confirmCancelItem} destructive confirmTitle="لغو قلم ارجاع" confirmDescription="این قلم از ارجاع لغو می‌شود و این تغییر در سابقه ثبت خواهد شد." confirmLabel="لغو قلم">لغو قلم</ConfirmActionButton>
      </div>
    );
  }

  return null;
}

function SubmittedResultRow({ result, referral, scope, type, canMutate, pageOffset, filterStatus, onFinalized }) {
  const [pending, setPending] = useState(false);
  async function finalize() {
    if (pending) return { ok: false, message: "درخواست قبلی هنوز در حال انجام است." };
    setPending(true);
    try {
      const response = await finalizeProviderResult({
        scope,
        type,
        referralId: referral.referral_id,
        resultId: result.result_id,
        referralStatus: referral.status,
        filterStatus,
        pageOffset,
      });
      if (!response?.ok) return { ok: false, message: response?.message || "نهایی‌سازی نتیجه انجام نشد." };
      toast.success("نتیجه نهایی و برای بیمار منتشر شد.");
      onFinalized();
      return { ok: true };
    } catch {
      return { ok: false, message: "نهایی‌سازی نتیجه انجام نشد؛ دوباره تلاش کنید." };
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">گزارش نسخه {Number(result.version_number || 1).toLocaleString("fa-IR")}</p>
        <p className="mt-1 text-xs text-muted-foreground">دریافت: {dateLabel(result.submitted_at)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label="در انتظار نهایی‌سازی" variant="preliminary" />
        {canMutate ? (
          <ConfirmActionButton
            type="button"
            size="sm"
            className="min-h-11"
            onConfirm={finalize}
            confirmTitle="نهایی‌سازی و انتشار نتیجه"
            confirmDescription="این نتیجه در پروندهٔ بیمار منتشر می‌شود و مشاهدهٔ آن برای بیمار ثبت خواهد شد."
            confirmLabel="نهایی‌سازی و انتشار"
            disabled={pending}
          >
            <FileCheck2 className="size-4" aria-hidden="true" />نهایی‌سازی و انتشار
          </ConfirmActionButton>
        ) : <span className="text-xs text-muted-foreground">فقط مسئول یا اپراتور مجاز می‌تواند منتشر کند.</span>}
      </div>
    </div>
  );
}

function ReferralCard({ type, scope = "center", referral, operatorProviderIds = [], pageOffset = 0, filterStatus = null }) {
  const router = useRouter();
  const canMutate = operatorProviderIds.includes(referral.provider_id);
  const canReject = canMutate && referral.status === "assigned";
  const terminal = ["rejected", "cancelled", "finalized"].includes(referral.status);

  async function respond(decision) {
    const isReject = decision === "reject";
    try {
      const result = await respondToProviderReferral({ scope, type, referralId: referral.referral_id, referralStatus: referral.status, filterStatus, pageOffset, decision });
      if (!result?.ok) return { ok: false, message: result?.message || (isReject ? "رد ارجاع انجام نشد." : "لغو ارجاع انجام نشد.") };
      toast.success(isReject ? "ارجاع رد شد." : "ارجاع لغو شد.");
      router.refresh();
      return { ok: true };
    } catch {
      return { ok: false, message: isReject ? "رد ارجاع انجام نشد؛ دوباره تلاش کنید." : "لغو ارجاع انجام نشد؛ دوباره تلاش کنید." };
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3 border-b bg-muted/10 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{referral.patient_display_name || "بیمار"}</CardTitle>
              <StatusBadge label={STATUS_LABELS[referral.status] || referral.status} variant={referral.status === "finalized" ? "normal" : referral.status === "rejected" ? "critical" : "preliminary"} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{referral.provider?.display_name || "مرکز درمانی"} · ارجاع {String(referral.referral_id).slice(0, 8)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ReferralQrDialog scope={scope} type={type} referralId={referral.referral_id} referralStatus={referral.status} filterStatus={filterStatus} pageOffset={pageOffset} disabled={!canMutate || terminal} />
            {canReject ? (
              <>
                <ConfirmActionButton
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onConfirm={() => respond("reject")}
                  confirmTitle="رد ارجاع"
                  confirmDescription="این ارجاع رد می‌شود و اقلامی که هنوز پذیرفته نشده‌اند نیز رد خواهند شد."
                  confirmLabel="رد ارجاع"
                >رد ارجاع</ConfirmActionButton>
                <ConfirmActionButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-11 text-destructive hover:text-destructive"
                  onConfirm={() => respond("cancel")}
                  destructive
                  confirmTitle="لغو ارجاع"
                  confirmDescription="این ارجاع لغو می‌شود و اقلام تخصیص‌یافته نیز لغو خواهند شد."
                  confirmLabel="لغو ارجاع"
                >لغو ارجاع</ConfirmActionButton>
              </>
            ) : null}
          </div>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">بیمه‌گر</dt><dd className="mt-1 font-medium">{PAYER_LABELS[referral.payer_key] || "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">شماره پیگیری بیمه</dt><dd dir="ltr" className="mt-1 break-all text-start font-medium tabular-nums">{referral.external_tracking_number || "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">زمان ارجاع</dt><dd className="mt-1 font-medium">{dateLabel(referral.assigned_at)}</dd></div>
        </dl>
      </CardHeader>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">اقلام تخصیص‌یافته به مرکز</h3>
          <span className="text-xs text-muted-foreground">{(referral.items || []).length.toLocaleString("fa-IR")} قلم</span>
        </div>
        {(referral.items || []).map((item) => (
          <div key={item.referral_item_id} className="flex min-w-0 flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="break-words text-sm font-medium">{item.display || "خدمت بدون عنوان"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{ITEM_KIND_LABELS[item.item_kind] || "خدمت"} · مقدار {item.quantity ?? "—"} {item.unit || ""}</p>
              <p className="mt-1 text-xs text-muted-foreground">تکمیل‌شده: {Number(item.completed_quantity || 0).toLocaleString("fa-IR")} از {Number(item.quantity || 0).toLocaleString("fa-IR")}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <StatusBadge label={STATUS_LABELS[item.status] || item.status} variant={item.status === "completed" ? "normal" : "neutral"} />
              <ItemAction scope={scope} type={type} referral={referral} item={item} canMutate={canMutate} pageOffset={pageOffset} filterStatus={filterStatus} />
            </div>
          </div>
        ))}
        {referral.submittedResults?.length ? (
          <section className="space-y-2 rounded-xl border border-primary/20 bg-primary/[0.035] p-3 sm:p-4" aria-label="نتایج آماده نهایی‌سازی">
            <div className="flex items-center gap-2"><FileText className="size-4 text-primary" aria-hidden="true" /><h3 className="text-sm font-semibold">نتیجه‌های دریافت‌شده از اتصال مرکز</h3></div>
            <p className="text-xs leading-5 text-muted-foreground">هر نسخه نتیجه باید جداگانه نهایی شود. با انتشار آخرین نسخه معتبر، گزارش در پرونده بیمار قرار می‌گیرد.</p>
            <div className="space-y-2">
              {referral.submittedResults.map((result) => <SubmittedResultRow key={result.result_id} result={result} referral={referral} scope={scope} type={type} canMutate={canMutate} pageOffset={pageOffset} filterStatus={filterStatus} onFinalized={() => router.refresh()} />)}
            </div>
          </section>
        ) : referral.status === "result_submitted" ? (
          <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 text-xs leading-6 text-muted-foreground">
            <FileText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            وضعیت ارجاع نشان می‌دهد نتیجه ارسال شده است؛ جزئیات آن در حال همگام‌سازی است. پس از دریافت نسخه نتیجه، امکان نهایی‌سازی نمایش داده می‌شود.
          </div>
        ) : null}
        {referral.status === "finalized" ? <p className="text-xs text-muted-foreground">همه نتیجه‌های این ارجاع نهایی شده‌اند.</p> : null}
      </CardContent>
    </Card>
  );
}

export default function ProviderReferralWorkspace({ type, scope = "center", data, status = "all" }) {
  const referrals = data.referrals || [];
  const operatorProviderIds = data.operatorProviderIds || [];
  const filterHref = scope === "provider"
    ? "/provider/referrals"
    : type === "laboratory"
      ? "/lab/referrals"
      : `/center/${type}/referrals`;
  const workspaceLabel = scope === "provider" ? "ارائه‌دهنده خدمت" : "این مرکز";

  return (
    <div className="space-y-6">
      <PageHeader
        title={scope === "provider" ? "ارجاع‌های ارائه‌دهنده خدمت" : "ارجاع‌های بیمه‌ای"}
        description={`ارجاع‌های اختصاص‌یافته به ${workspaceLabel} را بررسی کنید، اقلام را بپذیرید و با کد QR پذیرش را انجام دهید.`}
        actions={<Button asChild variant="outline"><Link href={`${filterHref}${status !== "all" ? `?status=${status}` : ""}`} className="min-h-11"><RefreshCw className="size-4" aria-hidden="true" />به‌روزرسانی فهرست</Link></Button>}
      />
      {data.message ? <div className="rounded-xl border border-status-low-border bg-status-low-bg p-4 text-sm leading-6 text-status-low">{data.message}</div> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18.75rem,0.72fr)]">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2" aria-label="فیلتر وضعیت ارجاع">
            {FILTERS.map((filter) => (
              <Link
                key={filter.value}
                href={filter.value === "all" ? filterHref : `${filterHref}?status=${filter.value}`}
                aria-current={status === filter.value ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-3 py-2 text-xs font-medium transition-colors ${status === filter.value ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground hover:bg-muted"}`}
              >{filter.label}</Link>
            ))}
          </div>
          {referrals.length ? (
            referrals.map((referral) => <ReferralCard key={referral.referral_id} scope={scope} type={type} referral={referral} operatorProviderIds={operatorProviderIds} pageOffset={data.pageOffset || 0} filterStatus={status === "all" ? null : status} />)
          ) : (
            <EmptyState
              icon={ClipboardCheck}
              title="ارجاعی برای نمایش وجود ندارد"
              description={scope === "provider" ? "پس از تخصیص نسخه به این ارائه‌دهنده، ارجاع در این فهرست دیده می‌شود." : "پس از تخصیص نسخه بیمه‌ای به این مرکز، ارجاع مربوط در این فهرست دیده می‌شود."}
            />
          )}
          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">صفحه {Number(data.page || 1).toLocaleString("fa-IR")} · اطلاعات فقط به عضویت فعال {scope === "provider" ? "ارائه‌دهنده" : "مرکز"} محدود است.</p>
            <div className="flex gap-2">
              {data.page > 1 ? <Button asChild size="sm" variant="outline" className="min-h-11"><Link href={`${filterHref}?page=${data.page - 1}${status !== "all" ? `&status=${status}` : ""}`}>ارجاع‌های جدیدتر</Link></Button> : null}
              {data.hasMore ? <Button asChild size="sm" variant="outline" className="min-h-11"><Link href={`${filterHref}?page=${data.page + 1}${status !== "all" ? `&status=${status}` : ""}`}>ارجاع‌های قدیمی‌تر</Link></Button> : null}
            </div>
          </div>
        </section>
        <aside className="min-w-0 space-y-4">
          {data.providers?.length || data.provider ? <DeferredReferralQrScanner scope={scope} type={type} /> : null}
          <div className="rounded-xl border bg-muted/20 p-4 text-xs leading-6 text-muted-foreground">
            <p className="font-semibold text-foreground">سطح دسترسی اعضا</p>
            <p className="mt-1">نقش مشاهده‌گر فقط امکان دیدن ارجاع‌ها را دارد. پذیرش، تغییر وضعیت و صدور یا لغو کد QR به نقش مسئول، مدیر یا اپراتور ارائه‌دهنده نیاز دارد.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
