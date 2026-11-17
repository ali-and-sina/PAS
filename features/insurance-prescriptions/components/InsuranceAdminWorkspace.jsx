"use client";

import { useId, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  CircleHelp,
  Clock3,
  FileCheck2,
  Link2,
  Search,
  ShieldCheck,
  UserPlus,
  Layers,
  CalendarClock,
  XCircle,
} from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import ConfirmActionButton from "@/components/shared/ConfirmActionButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  reviewInsuranceIdentity,
  routeInsurancePrescription,
  searchInsurancePatientCandidates,
  searchProviderStaffCandidates,
  createGenericProvider,
  upsertProviderMembership,
  upsertProviderCapability,
  upsertInsuranceItemMapping,
} from "@/features/insurance-prescriptions/actions";

const PAYER_LABELS = {
  tamin: "تأمین اجتماعی",
  ihio: "بیمه سلامت",
  armed_forces: "نیروهای مسلح",
};

const ITEM_KIND_LABELS = {
  laboratory: "آزمایش",
  imaging: "تصویربرداری",
  medication: "دارو",
  medical_service: "خدمت پزشکی",
  other: "سایر خدمات",
};

const REVIEW_STATUS_LABELS = {
  open: "در انتظار بررسی",
  in_review: "در حال بررسی",
  needs_information: "نیازمند اطلاعات",
};

const SERVICE_LABELS = {
  "IMG.CT": "سی‌تی‌اسکن",
  "IMG.MRI": "ام‌آر‌آی",
  "IMG.XRAY": "رادیوگرافی",
  "IMG.ULTRASOUND": "سونوگرافی",
  "IMG.MAMMOGRAPHY": "ماموگرافی",
  "IMG.ECG": "نوار قلب",
  "LAB.TEST": "خدمات آزمایشگاهی",
  "RX.DISPENSE": "تحویل دارو",
  "SERVICE.OTHER": "سایر خدمات",
  "THERAPY.PHYSIO": "فیزیوتراپی",
};

function serviceDisplayLabel(service) {
  if (!service) return "خدمت نامشخص";
  return SERVICE_LABELS[service.service_code] || service.display_name || service.service_code || "خدمت";
}

function formatCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("fa-IR", { maximumFractionDigits: 3 }) : "—";
}

function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

function Metric({ label, value, icon: Icon }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums">{value.toLocaleString("fa-IR")}</p>
      </div>
    </div>
  );
}

function PatientCandidatePicker({ onSelected, selected }) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [searched, setSearched] = useState(false);
  const [pending, startTransition] = useTransition();

  function search(event) {
    event.preventDefault();
    startTransition(async () => {
      const result = await searchInsurancePatientCandidates(query);
      setSearched(true);
      if (!result?.ok) {
        toast.error(result?.message || "جست‌وجوی بیمار انجام نشد.");
        return;
      }
      setItems(result.items || []);
      onSelected(null);
    });
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4">
      <div>
        <p className="text-sm font-semibold">تطبیق با پرونده بیمار</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          بیمار را با نام، کد ملی یا شماره همراه پیدا کنید. شناسه دریافت‌شده از بیمه به‌تنهایی مبنای اتصال پرونده نیست.
        </p>
      </div>
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={inputId}>جست‌وجوی بیمار</label>
        <Input
          id={inputId}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setItems([]); setSearched(false); onSelected(null); }}
          placeholder="نام، کد ملی یا شماره همراه بیمار"
          autoComplete="off"
          maxLength={80}
        />
        <Button type="submit" variant="outline" loading={pending} disabled={pending || query.trim().length < 2} className="min-h-11 sm:w-auto">
          <Search className="size-4" aria-hidden="true" />
          جست‌وجو
        </Button>
      </form>
      {selected ? (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">پرونده انتخاب‌شده</p>
            <p className="mt-0.5 font-medium">{selected.full_name || "بدون نام"}</p>
            <p dir="ltr" className="mt-1 text-start text-xs tabular-nums text-muted-foreground">{selected.phone || "شماره همراه ثبت نشده"}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onSelected(null)}>تغییر انتخاب</Button>
        </div>
      ) : null}
      {searched && items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">بیماری با این مشخصات پیدا نشد.</p>
      ) : null}
      {items.length > 0 && !selected ? (
        <div className="max-h-56 space-y-2 overflow-y-auto" aria-label="نتایج جست‌وجوی بیمار">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelected(item)}
              className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-start transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.full_name || "بدون نام"}</span>
                <span dir="ltr" className="mt-0.5 block text-start text-xs tabular-nums text-muted-foreground">{item.phone || "شماره همراه ثبت نشده"}</span>
              </span>
              <span className="shrink-0 text-xs font-medium text-primary">انتخاب</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function IdentityReviewCard({ review }) {
  const router = useRouter();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const prescription = review.prescription || {};
  const items = review.items || [];

  async function decide(decision) {
    if (pending) return { ok: false, message: "درخواست قبلی هنوز در حال انجام است." };
    if (decision === "approve" && !selectedPatient) {
      return { ok: false, message: "برای تأیید، ابتدا بیمار درست را انتخاب کنید." };
    }
    setPending(true);
    try {
      const result = await reviewInsuranceIdentity({
        prescriptionId: prescription.id,
        decision,
        patientId: decision === "approve" ? selectedPatient.id : null,
        note,
      });
      if (!result?.ok) return { ok: false, message: result?.message || "بازبینی نسخه انجام نشد." };
      toast.success(decision === "approve" ? "هویت بیمار تأیید شد." : "نسخه رد شد.");
      router.refresh();
      return { ok: true };
    } catch {
      return { ok: false, message: "بازبینی نسخه انجام نشد؛ دوباره تلاش کنید." };
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3 border-b bg-muted/15 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{PAYER_LABELS[prescription.payer_key] || "بیمه نامشخص"}</CardTitle>
              <StatusBadge label={REVIEW_STATUS_LABELS[review.review_status] || "نیازمند بررسی"} variant="preliminary" icon={Clock3} />
            </div>
            <p className="mt-1 break-all text-xs text-muted-foreground">شناسه نسخه: {prescription.external_prescription_id || "—"}</p>
          </div>
          <div className="shrink-0 text-xs text-muted-foreground">دریافت: {formatDate(prescription.source_received_at, true)}</div>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">شماره پیگیری بیمه</dt><dd dir="ltr" className="mt-1 break-all text-start font-medium tabular-nums">{prescription.external_tracking_number || "ثبت نشده"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">نسخه منبع</dt><dd className="mt-1 font-medium tabular-nums">{prescription.source_message_version ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">اقلام فعال / نیازمند نگاشت</dt><dd className="mt-1 font-medium tabular-nums">{Number(prescription.item_count || 0).toLocaleString("fa-IR")} / {Number(prescription.unmapped_item_count || 0).toLocaleString("fa-IR")}</dd></div>
        </dl>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">اقلام نسخه</h3>
            <span className="text-xs text-muted-foreground">{items.length.toLocaleString("fa-IR")} قلم</span>
          </div>
          {items.map((item) => (
            <div key={item.id} className="flex min-w-0 flex-col gap-2 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{item.display || "قلم بدون عنوان"}</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {ITEM_KIND_LABELS[item.item_kind] || "خدمت"} · کد: {item.external_code || "ندارد"} · مقدار: {formatCount(item.quantity)} {item.unit || ""}
                </p>
              </div>
              <StatusBadge
                label={item.mapping_status === "mapped" ? "نگاشت‌شده" : item.mapping_status === "needs_review" ? "نیازمند بازبینی نگاشت" : "بدون نگاشت"}
                variant={item.mapping_status === "mapped" ? "normal" : "preliminary"}
              />
            </div>
          ))}
        </div>
        <PatientCandidatePicker selected={selectedPatient} onSelected={setSelectedPatient} />
        <label className="grid gap-2 text-sm font-medium">
          یادداشت بازبینی (اختیاری)
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={2} placeholder="توضیح کوتاه درباره تصمیم هویتی" />
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <ConfirmActionButton
            type="button"
            variant="outline"
            disabled={pending}
            onConfirm={() => decide("reject")}
            destructive
            confirmTitle="رد نسخهٔ بیمه‌ای"
            confirmDescription="پس از رد، این نسخه به پروندهٔ بیمار متصل نخواهد شد. این تصمیم را تأیید می‌کنید؟"
            confirmLabel="رد نسخه"
          >
            <XCircle className="size-4" aria-hidden="true" />رد نسخه
          </ConfirmActionButton>
          <ConfirmActionButton
            type="button"
            variant="default"
            disabled={pending || !selectedPatient}
            loading={pending}
            onConfirm={() => decide("approve")}
            confirmTitle="تأیید هویت و اتصال پرونده"
            confirmDescription="پس از تأیید، این نسخه به پروندهٔ بیمار انتخاب‌شده متصل می‌شود. پیش از ادامه، تطبیق مشخصات بیمار را دوباره بررسی کنید."
            confirmLabel="تأیید و اتصال پرونده"
            fallbackErrorMessage="اتصال نسخه به پرونده انجام نشد؛ دوباره تلاش کنید."
          >
            <ShieldCheck className="size-4" aria-hidden="true" />
            تأیید هویت و اتصال پرونده
          </ConfirmActionButton>
        </div>
      </CardContent>
    </Card>
  );
}

function getAvailableProviders(item, providers) {
  if (!item.service_catalog_id || !item.service) return [];
  return providers.filter((provider) =>
    provider.provider_kind === item.service.allowed_provider_kind &&
    provider.capabilities.includes(item.service_catalog_id),
  );
}

function RoutingCard({ prescription, providers }) {
  const router = useRouter();
  const [assignments, setAssignments] = useState({});
  const [pending, startTransition] = useTransition();
  const items = prescription.items || [];
  const unassignedItems = items.filter((item) => !item.assignedReferral);
  const isExpired = prescription.is_expired === true;
  const selectedAssignments = useMemo(
    () => {
      if (prescription.is_expired) return [];
      return Object.entries(assignments)
      .filter(([itemId, providerId]) => {
        if (!itemId || !providerId) return false;
        const item = unassignedItems.find((candidate) => candidate.id === itemId);
        return Boolean(item && item.mapping_status === "mapped" &&
          getAvailableProviders(item, providers).some((provider) => provider.id === providerId));
      })
      .map(([item_id, provider_id]) => ({ item_id, provider_id }));
    },
    [assignments, unassignedItems, providers, prescription.is_expired],
  );

  function route() {
    if (isExpired) {
      toast.error("مهلت اعتبار این نسخه بیمه‌ای به پایان رسیده است.");
      return;
    }
    if (!selectedAssignments.length) {
      toast.error("برای ارجاع، حداقل یک مرکز برای یک قلم انتخاب کنید.");
      return;
    }
    startTransition(async () => {
      const result = await routeInsurancePrescription({
        prescriptionId: prescription.id,
        assignments: selectedAssignments,
      });
      if (!result?.ok) {
        toast.error(result?.message || "ارجاع نسخه انجام نشد.");
        return;
      }
      toast.success(result.data?.status === "routed" ? "همه اقلام ارجاع شدند." : "بخشی از اقلام ارجاع شدند.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="gap-2 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>{PAYER_LABELS[prescription.payer_key] || "بیمه نامشخص"}</CardTitle>
            <p className="mt-1 break-all text-xs text-muted-foreground">شماره پیگیری: {prescription.external_tracking_number || "ثبت نشده"}</p>
          </div>
          <StatusBadge
            label={isExpired ? "پایان مهلت ارجاع" : prescription.status === "partially_routed" ? "ارجاع ناقص" : "آماده ارجاع"}
            variant={isExpired ? "critical" : prescription.status === "partially_routed" ? "preliminary" : "normal"}
          />
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-muted-foreground">بیمار</dt><dd className="mt-1 font-medium">{prescription.patient_name || "پرونده متصل است"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">نسخه منبع</dt><dd className="mt-1 font-medium tabular-nums">{prescription.source_message_version}</dd></div>
          <div><dt className="text-xs text-muted-foreground">پایان اعتبار</dt><dd className="mt-1 font-medium tabular-nums">{formatDate(prescription.expires_at)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">اقلام ارجاع‌نشده</dt><dd className="mt-1 font-medium tabular-nums">{unassignedItems.length.toLocaleString("fa-IR")}</dd></div>
        </dl>
        {isExpired ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200" role="status">مهلت اعتبار نسخه به پایان رسیده است. اقلام تخصیص‌نیافته از این نسخه قابل ارجاع نیستند.</p> : null}
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
        {items.map((item) => {
          const options = getAvailableProviders(item, providers);
          const assignedProvider = item.assignedReferral?.provider;
          return (
            <div key={item.id} className="grid min-w-0 gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(13.75rem,0.85fr)] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-words text-sm font-semibold">{item.external_display}</p>
                  <StatusBadge
                    label={item.assignedReferral
                      ? ({ assigned: "ارجاع‌شده", accepted: "پذیرفته‌شده", in_progress: "در حال انجام", partially_completed: "تکمیل ناقص", completed: "انجام‌شده", result_submitted: "نتیجه ارسال‌شده", finalized: "نهایی‌شده", rejected: "ردشده", cancelled: "لغوشده" }[item.assignedReferral.status] || "ارجاع ثبت‌شده")
                      : item.mapping_status === "mapped" ? "آماده تخصیص" : item.mapping_status === "needs_review" ? "نیازمند بازبینی نگاشت" : "بدون نگاشت"}
                    variant={item.assignedReferral?.status === "finalized" || (!item.assignedReferral && item.mapping_status === "mapped") ? "normal" : item.assignedReferral?.status === "rejected" ? "critical" : "preliminary"}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ITEM_KIND_LABELS[item.item_kind] || "خدمت"} · {item.external_code || "بدون کد"} · {formatCount(item.quantity)} {item.unit_label || ""}
                </p>
                {assignedProvider ? <p className="mt-1 text-xs text-primary">ارجاع به: {assignedProvider.display_name}</p> : null}
                {!item.assignedReferral && item.mapping_status !== "mapped" ? (
                  <p className="mt-1 text-xs text-muted-foreground">ابتدا کد بیمه باید به یک خدمت استاندارد نگاشت شود.</p>
                ) : null}
              </div>
              {item.assignedReferral ? (
                <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{["rejected", "cancelled"].includes(item.assignedReferral.status) ? "این ارجاع پایان یافته است. جابه‌جایی یا تخصیص مجدد قلم در قرارداد فعلی تعریف نشده است." : "این قلم قبلاً به یک مرکز تخصیص داده شده و در وضعیت فعلی قابل تخصیص مجدد نیست."}</div>
              ) : isExpired ? (
                <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  به دلیل پایان اعتبار نسخه، این قلم قابل تخصیص نیست.
                </div>
              ) : item.mapping_status !== "mapped" || options.length === 0 ? (
                <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {item.mapping_status !== "mapped" ? "نگاشت خدمت ناقص است." : "مرکز فعال با ظرفیت این خدمت پیدا نشد."}
                </div>
              ) : (
                <label className="grid gap-1.5 text-xs font-medium">
                  انتخاب مرکز دارای ظرفیت
                  <select
                    value={assignments[item.id] || ""}
                    onChange={(event) => setAssignments((current) => ({ ...current, [item.id]: event.target.value }))}
                    className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">انتخاب مرکز</option>
                    {options.map((provider) => (
                      <option key={provider.id} value={provider.id}>{provider.display_name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          );
        })}
        {prescription.referrals?.length ? (
          <div className="rounded-xl bg-muted/20 p-3 text-xs leading-6 text-muted-foreground">
            {prescription.referrals.length.toLocaleString("fa-IR")} ارجاع قبلی ثبت شده است. اقلام ارجاع‌شده قابل جابه‌جایی یا تخصیص مجدد نیستند.
          </div>
        ) : null}
        <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">هر مرکز برای اقلام خودش یک ارجاع مستقل دریافت می‌کند.</p>
          <Button type="button" onClick={route} loading={pending} disabled={pending || isExpired || !selectedAssignments.length}>
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            ارجاع {selectedAssignments.length.toLocaleString("fa-IR")} قلم
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MappingForm({ serviceCatalog }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [payerKey, setPayerKey] = useState("tamin");
  const [codeSystem, setCodeSystem] = useState("payer");
  const [code, setCode] = useState("");
  const [display, setDisplay] = useState("");
  const [itemKind, setItemKind] = useState("laboratory");
  const [serviceCode, setServiceCode] = useState("");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("");
  const serviceGroupsByItemKind = {
    laboratory: ["laboratory"],
    imaging: ["imaging"],
    medication: ["medication"],
    medical_service: ["therapy", "other"],
    other: ["other"],
  };
  const compatibleServices = serviceCatalog.filter((service) => serviceGroupsByItemKind[itemKind]?.includes(service.service_group));

  function submit(event) {
    event.preventDefault();
    startTransition(async () => {
      const result = await upsertInsuranceItemMapping({
        payerKey,
        itemKind,
        externalCodeSystem: codeSystem,
        externalCode: code,
        externalDisplay: display,
        serviceCode,
        validFrom,
        validUntil: validUntil || null,
      });
      if (!result?.ok) {
        toast.error(result?.message || "ثبت نگاشت انجام نشد.");
        return;
      }
      toast.success("نگاشت برای دریافت‌های بعدی ثبت شد.");
      setCode("");
      setDisplay("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-5">
        <CardTitle>تعریف نگاشت کد بیمه</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">کد بیرونی را به یک خدمت فعال در فهرست استاندارد پاس وصل کنید.</p>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">نوع قلم دریافتی
            <select value={itemKind} onChange={(event) => { setItemKind(event.target.value); setServiceCode(""); }} className="min-h-11 rounded-xl border bg-card px-3 text-sm">
              <option value="laboratory">آزمایش</option><option value="imaging">تصویربرداری</option><option value="medication">دارو</option><option value="medical_service">خدمت پزشکی</option><option value="other">سایر خدمات</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">بیمه‌گر
            <select value={payerKey} onChange={(event) => setPayerKey(event.target.value)} className="min-h-11 rounded-xl border bg-card px-3 text-sm">
              <option value="tamin">تأمین اجتماعی</option><option value="ihio">بیمه سلامت</option><option value="armed_forces">نیروهای مسلح</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">سامانه کدگذاری
            <Input value={codeSystem} onChange={(event) => setCodeSystem(event.target.value)} required maxLength={100} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">کد خدمت بیمه
            <Input value={code} onChange={(event) => setCode(event.target.value)} required maxLength={180} dir="ltr" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">عنوان دریافتی از بیمه (اختیاری)
            <Input value={display} onChange={(event) => setDisplay(event.target.value)} maxLength={240} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">خدمت استاندارد پاس
            <select value={serviceCode} onChange={(event) => setServiceCode(event.target.value)} required className="min-h-11 rounded-xl border bg-card px-3 text-sm">
              <option value="">انتخاب خدمت</option>
              {compatibleServices.map((service) => <option key={service.id} value={service.service_code}>{serviceDisplayLabel(service)} · {service.service_code}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">اعتبار از تاریخ
            <Input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">اعتبار تا تاریخ (اختیاری)
            <Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} min={validFrom} />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" loading={pending} disabled={pending || !serviceCode || !code.trim()}>
              <Link2 className="size-4" aria-hidden="true" />
              ثبت نگاشت
            </Button>
          </div>
        </form>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-status-low-border bg-status-low-bg p-3 text-xs leading-6 text-status-low">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>نوع قلم فقط برای محدودکردن گزینه‌های سازگار در این فرم است. هنگام دریافت نسخه، بک‌اند دوباره سازگاری گروه خدمت و نوع قلم را بررسی می‌کند. این نگاشت برای دریافت‌های بعدی است؛ اقلام قبلی خودکار بازنگاشت نمی‌شوند و به رویداد نسخه اصلاحی نیاز دارند.</p>
        </div>
      </CardContent>
    </Card>
  );
}


const PROVIDER_KIND_LABELS = {
  medical_center: "مرکز درمانی",
  pharmacy: "داروخانه",
  other: "ارائه‌دهنده خدمت",
};

const PROVIDER_ROLE_LABELS = {
  owner: "مسئول اصلی",
  manager: "مدیر",
  operator: "اپراتور",
  viewer: "مشاهده‌گر",
};

const MEMBERSHIP_STATUS_LABELS = {
  active: "فعال",
  inactive: "غیرفعال",
  revoked: "لغوشده",
};

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function ProviderRegistryPanel({ providers = [] }) {
  const router = useRouter();
  const [providerKind, setProviderKind] = useState("pharmacy");
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [staffQuery, setStaffQuery] = useState("");
  const [staffCandidates, setStaffCandidates] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [membershipRole, setMembershipRole] = useState("operator");
  const [membershipStatus, setMembershipStatus] = useState("active");
  const [externalActorReference, setExternalActorReference] = useState("");
  const [pending, startTransition] = useTransition();
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) || providers[0] || null;

  function createProvider(event) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createGenericProvider({ providerKind, displayName, legalName, licenseNumber });
      if (!result?.ok) {
        toast.error(result?.message || "ثبت ارائه‌دهنده انجام نشد.");
        return;
      }
      toast.success("ارائه‌دهنده ثبت شد. اکنون می‌توانید اعضا و ظرفیت خدمات آن را تعریف کنید.");
      setDisplayName("");
      setLegalName("");
      setLicenseNumber("");
      setSelectedProviderId(result.providerId);
      router.refresh();
    });
  }

  function searchStaff(event) {
    event.preventDefault();
    startTransition(async () => {
      const result = await searchProviderStaffCandidates(staffQuery);
      if (!result?.ok) {
        toast.error(result?.message || "جست‌وجوی حساب کاربری انجام نشد.");
        return;
      }
      setStaffCandidates(result.items || []);
      setSelectedStaff(null);
      if (!result.items?.length) toast.message("حسابی با این مشخصات پیدا نشد.");
    });
  }

  function saveMembership(event) {
    event.preventDefault();
    if (!selectedProvider || !selectedStaff) {
      toast.error("ابتدا ارائه‌دهنده و حساب کاربری را انتخاب کنید.");
      return;
    }
    startTransition(async () => {
      const result = await upsertProviderMembership({
        providerId: selectedProvider.id,
        profileId: selectedStaff.id,
        roleInProvider: membershipRole,
        status: membershipStatus,
        externalActorReference,
      });
      if (!result?.ok) {
        toast.error(result?.message || "ثبت دسترسی عضو انجام نشد.");
        return;
      }
      toast.success("دسترسی عضو به‌روزرسانی شد.");
      setSelectedStaff(null);
      setStaffCandidates([]);
      setExternalActorReference("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-2 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="size-4" aria-hidden="true" /></span>
            <div><CardTitle>ثبت داروخانه یا ارائه‌دهنده جدید</CardTitle><p className="mt-1 text-xs leading-5 text-muted-foreground">حساب مراکز درمانی از فرایند فعلی ایجاد مرکز ساخته می‌شود؛ این فرم فقط برای داروخانه و سایر ارائه‌دهندگان است.</p></div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
          <form onSubmit={createProvider} className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">نوع ارائه‌دهنده
              <select value={providerKind} onChange={(event) => setProviderKind(event.target.value)} className="min-h-11 rounded-xl border border-input bg-card px-3 text-sm">
                <option value="pharmacy">داروخانه</option>
                <option value="other">سایر ارائه‌دهندگان خدمت</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">نام قابل نمایش
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} maxLength={180} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">نام حقوقی (اختیاری)
              <Input value={legalName} onChange={(event) => setLegalName(event.target.value)} maxLength={180} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">شماره مجوز (اختیاری)
              <Input value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} maxLength={120} />
            </label>
            <div className="sm:col-span-2"><Button type="submit" loading={pending} disabled={pending || displayName.trim().length < 2}><UserPlus className="size-4" aria-hidden="true" />ثبت ارائه‌دهنده</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-5"><CardTitle>مدیریت اعضای ارائه‌دهنده</CardTitle><p className="text-sm leading-6 text-muted-foreground">اعضای مجاز را با حساب موجود انتخاب کنید. نقش این بخش مستقل از نقش عمومی حساب در پاس است.</p></CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
          {providers.length ? (
            <label className="grid gap-1.5 text-sm font-medium">ارائه‌دهنده
              <select value={selectedProvider?.id || ""} onChange={(event) => setSelectedProviderId(event.target.value)} className="min-h-11 rounded-xl border border-input bg-card px-3 text-sm">
                {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.display_name} · {PROVIDER_KIND_LABELS[provider.provider_kind] || provider.provider_kind}</option>)}
              </select>
            </label>
          ) : <EmptyState icon={Building2} title="ارائه‌دهنده فعالی ثبت نشده است" description="پس از ثبت داروخانه یا ایجاد مرکز از مسیر مدیریت مراکز، امکان تعریف اعضا فراهم می‌شود." />}

          {selectedProvider ? (
            <>
              <form onSubmit={searchStaff} className="flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor="provider-staff-search">جست‌وجوی عضو با نام یا شماره همراه</label>
                <Input id="provider-staff-search" value={staffQuery} onChange={(event) => setStaffQuery(event.target.value)} placeholder="جست‌وجوی عضو با نام یا شماره همراه" maxLength={80} autoComplete="off" />
                <Button type="submit" variant="outline" loading={pending} disabled={pending || staffQuery.trim().length < 2}><Search className="size-4" aria-hidden="true" />جست‌وجو</Button>
              </form>

              {staffCandidates.length && !selectedStaff ? (
                <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border p-2" aria-label="حساب‌های پیدا شده">
                  {staffCandidates.map((candidate) => (
                    <button key={candidate.id} type="button" onClick={() => setSelectedStaff(candidate)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{candidate.full_name || "بدون نام"}</span><span dir="ltr" className="mt-0.5 block text-start text-xs text-muted-foreground">{candidate.phone || "شماره همراه ثبت نشده"}</span></span>
                      <span className="shrink-0 text-xs font-medium text-primary">انتخاب</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {selectedStaff ? (
                <form onSubmit={saveMembership} className="space-y-3 rounded-xl border border-primary/25 bg-primary/[0.03] p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs text-muted-foreground">حساب انتخاب‌شده</p><p className="mt-0.5 font-semibold">{selectedStaff.full_name || "بدون نام"}</p><p dir="ltr" className="mt-0.5 text-start text-xs text-muted-foreground">{selectedStaff.phone || "شماره همراه ثبت نشده"}</p></div><Button type="button" size="sm" variant="ghost" onClick={() => setSelectedStaff(null)}>تغییر حساب</Button></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium">سطح دسترسی
                      <select value={membershipRole} onChange={(event) => setMembershipRole(event.target.value)} className="min-h-11 rounded-xl border border-input bg-card px-3 text-sm">
                        <option value="owner">مسئول اصلی</option><option value="manager">مدیر</option><option value="operator">اپراتور</option><option value="viewer">مشاهده‌گر (فقط خواندن)</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium">وضعیت عضویت
                      <select value={membershipStatus} onChange={(event) => setMembershipStatus(event.target.value)} className="min-h-11 rounded-xl border border-input bg-card px-3 text-sm">
                        <option value="active">فعال</option><option value="inactive">غیرفعال</option><option value="revoked">لغوشده</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">شناسه کاربر در نرم‌افزار ارائه‌دهنده (اختیاری)
                      <Input value={externalActorReference} onChange={(event) => setExternalActorReference(event.target.value)} maxLength={180} dir="ltr" />
                    </label>
                  </div>
                  <Button type="submit" loading={pending} disabled={pending}><ShieldCheck className="size-4" aria-hidden="true" />ثبت دسترسی عضو</Button>
                </form>
              ) : null}

              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">اعضای ثبت‌شده</h3><span className="text-xs text-muted-foreground">{selectedProvider.members?.length?.toLocaleString("fa-IR") || "۰"} عضو</span></div>
                {selectedProvider.members?.length ? selectedProvider.members.map((member) => (
                  <div key={member.id} className="flex min-w-0 flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{member.profile?.full_name || "حساب کاربری"}</p><p dir="ltr" className="mt-1 text-start text-xs text-muted-foreground">{member.profile?.phone || "شماره همراه ثبت نشده"}</p></div>
                    <div className="flex flex-wrap items-center gap-2"><StatusBadge label={PROVIDER_ROLE_LABELS[member.role_in_provider] || member.role_in_provider} variant="neutral" /><StatusBadge label={MEMBERSHIP_STATUS_LABELS[member.status] || member.status} variant={member.status === "active" ? "normal" : "preliminary"} /></div>
                  </div>
                )) : <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">عضوی برای این ارائه‌دهنده ثبت نشده است.</p>}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ProviderCapabilityPanel({ providers = [], serviceCatalog = [] }) {
  const router = useRouter();
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [pending, startTransition] = useTransition();
  const provider = providers.find((item) => item.id === selectedProviderId) || providers[0] || null;
  const compatibleServices = serviceCatalog.filter((service) => provider && service.allowed_provider_kind === provider.provider_kind);
  const compatibleCodes = new Set(compatibleServices.map((service) => service.service_code));
  const currentServiceCode = compatibleCodes.has(serviceCode) ? serviceCode : "";

  function editCapability(capability) {
    setServiceCode(capability.service?.service_code || "");
    setValidFrom(toDateInput(capability.valid_from) || new Date().toISOString().slice(0, 10));
    setValidUntil(toDateInput(capability.valid_until));
    setIsActive(capability.is_active);
  }

  function save(event) {
    event.preventDefault();
    if (!provider || !currentServiceCode) {
      toast.error("ابتدا خدمت سازگار با نوع ارائه‌دهنده را انتخاب کنید.");
      return;
    }
    startTransition(async () => {
      const result = await upsertProviderCapability({ providerId: provider.id, serviceCode: currentServiceCode, isActive, validFrom, validUntil: validUntil || null });
      if (!result?.ok) {
        toast.error(result?.message || "ثبت ظرفیت خدمت انجام نشد.");
        return;
      }
      toast.success("ظرفیت خدمت به‌روزرسانی شد.");
      router.refresh();
    });
  }

  function toggleCapability(capability) {
    const from = toDateInput(capability.valid_from) || new Date().toISOString().slice(0, 10);
    const until = toDateInput(capability.valid_until);
    if (until && until < new Date().toISOString().slice(0, 10)) {
      editCapability(capability);
      toast.message("اعتبار این ظرفیت پایان یافته است؛ برای فعال‌سازی دوباره، بازه اعتبار را اصلاح کنید.");
      return;
    }
    startTransition(async () => {
      const result = await upsertProviderCapability({ providerId: provider.id, serviceCode: capability.service.service_code, isActive: !capability.is_active, validFrom: from, validUntil: until || null });
      if (!result?.ok) {
        toast.error(result?.message || "تغییر وضعیت ظرفیت انجام نشد.");
        return;
      }
      toast.success(capability.is_active ? "ظرفیت خدمت غیرفعال شد." : "ظرفیت خدمت فعال شد.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-2 p-4 sm:p-5"><div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Layers className="size-4" aria-hidden="true" /></span><div><CardTitle>ظرفیت خدمات ارائه‌دهنده</CardTitle><p className="mt-1 text-xs leading-5 text-muted-foreground">فقط خدمت‌هایی نمایش داده می‌شوند که نوع ارائه‌دهنده اجازه ارائه آن‌ها را دارد.</p></div></div></CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
          {providers.length ? (
            <label className="grid gap-1.5 text-sm font-medium">ارائه‌دهنده
              <select value={provider?.id || ""} onChange={(event) => { setSelectedProviderId(event.target.value); setServiceCode(""); }} className="min-h-11 rounded-xl border border-input bg-card px-3 text-sm">
                {providers.map((item) => <option key={item.id} value={item.id}>{item.display_name} · {PROVIDER_KIND_LABELS[item.provider_kind] || item.provider_kind}</option>)}
              </select>
            </label>
          ) : <EmptyState icon={Building2} title="ارائه‌دهنده فعالی در دسترس نیست" description="ابتدا یک داروخانه ثبت کنید یا مرکز را از مسیر مدیریت مراکز فعال کنید." />}
          {provider ? (
            <>
              <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">خدمت قابل ارائه
                  <select value={currentServiceCode} onChange={(event) => setServiceCode(event.target.value)} required className="min-h-11 rounded-xl border border-input bg-card px-3 text-sm">
                    <option value="">انتخاب خدمت سازگار</option>
                    {compatibleServices.map((service) => <option key={service.id} value={service.service_code}>{serviceDisplayLabel(service)} · {service.service_code}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">اعتبار از تاریخ
                  <Input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} required />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">اعتبار تا تاریخ (اختیاری)
                  <Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} min={validFrom} />
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="size-4 accent-primary" />ظرفیت خدمت فعال باشد</label>
                <div className="sm:col-span-2"><Button type="submit" loading={pending} disabled={pending || !currentServiceCode}><CalendarClock className="size-4" aria-hidden="true" />ثبت ظرفیت</Button></div>
              </form>
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">ظرفیت‌های ثبت‌شده</h3><span className="text-xs text-muted-foreground">{(provider.capabilityRecords || []).length.toLocaleString("fa-IR")} مورد</span></div>
                {(provider.capabilityRecords || []).length ? provider.capabilityRecords.map((capability) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const isExpired = capability.valid_until && toDateInput(capability.valid_until) < today;
                  const isUpcoming = capability.valid_from && toDateInput(capability.valid_from) > today;
                  const currentlyAvailable = capability.is_active && !isExpired && !isUpcoming;
                  return (
                    <div key={`${capability.provider_id}:${capability.service_catalog_id}`} className="flex min-w-0 flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0"><p className="break-words text-sm font-medium">{serviceDisplayLabel(capability.service)}</p><p className="mt-1 text-xs text-muted-foreground">{toDateInput(capability.valid_from) || "—"} تا {toDateInput(capability.valid_until) || "بدون تاریخ پایان"}</p></div>
                      <div className="flex flex-wrap items-center gap-2"><StatusBadge label={currentlyAvailable ? "قابل تخصیص" : isExpired ? "پایان اعتبار" : isUpcoming ? "شروع نشده" : "غیرفعال"} variant={currentlyAvailable ? "normal" : "preliminary"} /><Button type="button" size="sm" variant="outline" disabled={pending || !capability.service} onClick={() => editCapability(capability)}>ویرایش</Button>{!isExpired && !isUpcoming ? <Button type="button" size="sm" variant="ghost" disabled={pending || !capability.service} onClick={() => toggleCapability(capability)}>{capability.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}</Button> : null}</div>
                    </div>
                  );
                }) : <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">برای این ارائه‌دهنده ظرفیتی ثبت نشده است.</p>}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function WorkspacePager({ page, pageCount, tab }) {
  if (pageCount <= 1) return null;
  const href = (nextPage) => `?tab=${tab}&page=${nextPage}`;
  return (
    <nav aria-label="صفحه‌بندی فهرست" className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">صفحه {page.toLocaleString("fa-IR")} از {pageCount.toLocaleString("fa-IR")}</p>
      <div className="flex gap-2">
        {page > 1 ? <Button asChild type="button" size="sm" variant="outline" className="min-h-11"><Link href={href(page - 1)}>صفحه قبل</Link></Button> : null}
        {page < pageCount ? <Button asChild type="button" size="sm" variant="outline" className="min-h-11"><Link href={href(page + 1)}>صفحه بعد</Link></Button> : null}
      </div>
    </nav>
  );
}

export default function InsuranceAdminWorkspace({ data, activeTab = "identity" }) {
  const identityReviews = data.identityReviews || [];
  const readyPrescriptions = data.readyPrescriptions || [];
  const mappings = data.mappings || [];
  const providers = data.providers || [];
  const enabledPayers = new Set((data.insurerConnections || []).filter((item) => item.enabled).map((item) => item.provider_key));
  const unmappedCount = useMemo(
    () => readyPrescriptions.reduce((sum, prescription) => sum + prescription.items.filter((item) => item.mapping_status !== "mapped").length, 0),
    [readyPrescriptions],
  );
  const routeableCount = useMemo(
    () => readyPrescriptions.reduce((sum, prescription) => sum + (prescription.is_expired ? 0 : prescription.items.filter((item) =>
      item.mapping_status === "mapped" && !item.assignedReferral && getAvailableProviders(item, providers).length > 0,
    ).length), 0),
    [readyPrescriptions, providers],
  );
  const identityTotal = Number(data.identityReviewTotal || identityReviews.length);
  const supportedPayers = ["tamin", "ihio", "armed_forces"];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="بازبینی هویت" value={identityTotal} icon={ShieldCheck} />
        <Metric label="نسخه‌های آماده ارجاع" value={Number(data.readyPrescriptionTotal ?? readyPrescriptions.length)} icon={FileCheck2} />
        <Metric label="اقلام آماده تخصیص" value={routeableCount} icon={ArrowLeftRight} />
        <Metric label="اقلام نیازمند نگاشت" value={unmappedCount} icon={CircleHelp} />
      </div>

      <div className="rounded-xl border border-status-low-border bg-status-low-bg p-3" role="status">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-low" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-950 dark:text-amber-100">وضعیت اتصال بیمه‌گرها</p>
            <p className="mt-1 text-xs leading-5 text-amber-900/80 dark:text-amber-200/80">
              {enabledPayers.size === supportedPayers.length
                ? "اتصال‌های بیمه‌گر در تنظیمات فعال هستند؛ دریافت واقعی همچنان به اعتبارنامه و قرارداد رسمی هر بیمه‌گر وابسته است."
                : enabledPayers.size > 0
                  ? `اتصال‌های فعال: ${supportedPayers.filter((payer) => enabledPayers.has(payer)).map((payer) => PAYER_LABELS[payer]).join("، ")}. فعال‌سازی در پاس به‌تنهایی به معنی اتصال رسمی بیمه‌گر نیست.`
                  : "اتصال‌های بیمه‌گر در محیط فعلی خاموش هستند. نسخه‌ای که از مبدل رسمی دریافت نشده باشد در این صف ظاهر نمی‌شود."}
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue={activeTab} dir="rtl" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-3 xl:grid-cols-5">
          <TabsTrigger value="identity" className="min-h-11 whitespace-normal px-2 text-xs sm:text-sm">بازبینی هویت</TabsTrigger>
          <TabsTrigger value="routing" className="min-h-11 whitespace-normal px-2 text-xs sm:text-sm">ارجاع چندمرکزی</TabsTrigger>
          <TabsTrigger value="mapping" className="min-h-11 whitespace-normal px-2 text-xs sm:text-sm">نگاشت کدها</TabsTrigger>
          <TabsTrigger value="providers" className="min-h-11 whitespace-normal px-2 text-xs sm:text-sm">ارائه‌دهندگان و اعضا</TabsTrigger>
          <TabsTrigger value="capacity" className="min-h-11 whitespace-normal px-2 text-xs sm:text-sm">ظرفیت خدمات</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="space-y-4">
          {identityReviews.length ? identityReviews.map((review) => <IdentityReviewCard key={review.review_id} review={review} />) : (
            <EmptyState icon={ShieldCheck} title={data.identityReviewTotal ? "در این صفحه موردی نیست" : "نسخه‌ای در صف بازبینی نیست"} description={data.identityReviewTotal ? "برای مشاهده موارد دیگر به صفحه قبل یا بعد بروید." : "نسخه‌های جدید ابتدا با شناسه بیرونی ثبت می‌شوند و تا زمان تأیید دستی بیمار به هیچ پرونده‌ای متصل نمی‌شوند."} />
          )}
          <WorkspacePager page={data.page || 1} pageCount={data.identityReviewPageCount || 1} tab="identity" />
        </TabsContent>

        <TabsContent value="routing" className="space-y-4">
          {readyPrescriptions.length ? readyPrescriptions.map((prescription) => <RoutingCard key={prescription.id} prescription={prescription} providers={providers} />) : (
            <EmptyState icon={Building2} title={data.readyPrescriptionTotal ? "در این صفحه نسخه‌ای نیست" : "نسخه‌ای آماده ارجاع نیست"} description={data.readyPrescriptionTotal ? "برای مشاهده نسخه‌های دیگر به صفحه قبل یا بعد بروید." : "پس از تأیید هویت بیمار، نسخه‌هایی که آماده تخصیص به مراکز هستند در این بخش نمایش داده می‌شوند."} />
          )}
          <div className="rounded-xl border bg-muted/20 p-3 text-xs leading-6 text-muted-foreground">
            {routeableCount.toLocaleString("fa-IR")} قلم در این صفحه قابل تخصیص است. فقط اقلام نگاشت‌شده به خدمت فعال و مراکز دارای ظرفیت معتبر قابل ارجاع هستند.
          </div>
          <WorkspacePager page={data.page || 1} pageCount={data.routingPageCount || 1} tab="routing" />
        </TabsContent>

        <TabsContent value="mapping" className="space-y-4">
          <MappingForm serviceCatalog={data.serviceCatalog || []} />
          <Card>
            <CardHeader className="p-4 sm:p-5"><CardTitle>نگاشت‌های فعال</CardTitle></CardHeader>
            <CardContent className="space-y-2 p-4 pt-0 sm:p-5 sm:pt-0">
              {mappings.length ? mappings.map((mapping) => (
                <div key={mapping.id} className="grid min-w-0 gap-2 rounded-xl border px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0"><p className="break-all text-sm font-medium">{mapping.external_display || mapping.external_code}</p><p dir="ltr" className="mt-1 break-all text-start text-xs text-muted-foreground">{mapping.payer_key} / {mapping.external_code_system} / {mapping.external_code}</p></div>
                  <div className="text-sm text-muted-foreground">{mapping.service?.display_name || "خدمت نامشخص"}</div>
                  <StatusBadge label={`نسخه ${mapping.mapping_version}`} variant="neutral" />
                </div>
              )) : <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">هنوز نگاشت فعالی ثبت نشده است.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <ProviderRegistryPanel providers={providers} />
        </TabsContent>

        <TabsContent value="capacity" className="space-y-4">
          <ProviderCapabilityPanel providers={providers} serviceCatalog={data.serviceCatalog || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
