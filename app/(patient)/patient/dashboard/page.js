import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  HeartPulse,
  ListChecks,
  Scan,
} from "lucide-react";

import DashboardWelcome from "@/components/shared/DashboardWelcome";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPatientHome } from "@/features/patient/queries";
import { getPatientContext } from "@/features/patient/auth";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
});
const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const MEDICAL_SERVICE_LABELS = {
  ct: "سی‌تی‌اسکن",
  mri: "ام‌آر‌آی",
  ecg: "نوار قلب",
  ultrasound: "سونوگرافی",
  mammography: "ماموگرافی",
  xray: "رادیوگرافی",
  physiotherapy: "فیزیوتراپی",
  other: "سایر خدمات پزشکی",
};

const MEDICAL_STATUS_LABELS = {
  requested: "در انتظار پذیرش مرکز",
  accepted: "پذیرفته‌شده",
  in_progress: "در حال انجام",
  reported: "گزارش آماده است",
  cancelled: "لغوشده",
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateTimeFormatter.format(date);
}

function getEventLabel(type) {
  return (
    {
      visit: "ویزیت",
      lab_order: "درخواست آزمایش",
      lab_result: "نتیجه آزمایش",
      medical_service: "درخواست مرکز درمانی",
      doctor_explanation: "توضیحات پزشک",
      prescription: "نسخه",
      follow_up: "پیگیری",
      notification: "اعلان",
    }[type] ?? "رویداد سلامت"
  );
}

function getFollowUpVariant(status) {
  if (status === "overdue") return "critical";
  if (status === "completed") return "normal";
  return "neutral";
}

export default async function PatientDashboardPage() {
  const [context, data] = await Promise.all([
    getPatientContext(),
    getPatientHome(),
  ]);

  const firstName = context?.full_name?.trim()?.split(/\s+/)?.[0] ?? "";
  const latestEvent = data?.latest_event ?? data?.latestEvent ?? null;
  const attentionItems = Array.isArray(data?.needs_attention)
    ? data.needs_attention
    : Array.isArray(data?.needsAttention)
      ? data.needsAttention
      : [];
  const activeFollowUps = Array.isArray(data?.active_followups)
    ? data.active_followups
    : Array.isArray(data?.activeFollowUps)
      ? data.activeFollowUps
      : [];
  // Be tolerant of both dashboard response contracts during rolling deployments.
  const recentResults = Array.isArray(data?.recent_results)
    ? data.recent_results
    : Array.isArray(data?.recentResults)
      ? data.recentResults
      : [];
  const recentMedicalRequests = Array.isArray(data?.recent_medical_requests)
    ? data.recent_medical_requests
    : Array.isArray(data?.recentMedicalRequests)
      ? data.recentMedicalRequests
      : [];

  return (
    <div className="space-y-6">
      <DashboardWelcome
        eyebrow="مسیر سلامت شما"
        title={firstName ? `سلام، ${firstName}` : "سلام"}
        description="نتایج، پیگیری‌ها و قدم بعدی مراقبت را از اینجا دنبال کنید."
        actions={
          <Button asChild variant="outline">
            <Link href="/patient/medical-services">
              <FileText aria-hidden="true" />
              مراکز درمانی
            </Link>
          </Button>
        }
      />

      <section
        aria-label="خلاصه وضعیت سلامت"
        className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3"
      >
        <Card className="col-span-2 h-full md:col-span-1">
          <CardContent className="flex h-full items-start gap-4 p-5">
            <div className="rounded-xl bg-accent p-2.5 text-primary">
              <HeartPulse className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">آخرین اتفاق</p>
              <p className="mt-1 font-semibold">
                {latestEvent?.title ?? "هنوز رویداد مهمی ثبت نشده"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(latestEvent?.date)}
              </p>
            </div>
          </CardContent>
        </Card>

        <StatCard label="پیگیری فعال" value={activeFollowUps.length} icon={ListChecks} href="/patient/follow-ups" detail="مشاهده پیگیری‌ها" />
        <StatCard label="اعلان خوانده‌نشده" value={data.unread_notifications ?? 0} icon={Bell} href="/patient/notifications" detail="مشاهده اعلان‌ها" tone="neutral" />
        <StatCard label="درخواست درمانی فعال" value={data.active_medical_requests_count ?? 0} icon={Scan} href="/patient/medical-services" detail="پیگیری درخواست‌ها" tone="info" />
      </section>

      <section aria-labelledby="medical-requests-heading">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle id="medical-requests-heading">درخواست‌های مراکز درمانی</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                درخواست‌های تصویربرداری، نوار قلب، فیزیوتراپی و سایر خدمات ثبت‌شده برای شما.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/patient/medical-services">مشاهده همه</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentMedicalRequests.length === 0 ? (
              <EmptyState
                icon={Scan}
                title="درخواستی از مراکز درمانی ثبت نشده است"
                description="هر زمان پزشک برای شما تصویربرداری یا خدمت پزشکی دیگری ثبت کند، وضعیت آن در همین قسمت نمایش داده می‌شود."
                action={{ label: "رفتن به مراکز درمانی", href: "/patient/medical-services" }}
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {recentMedicalRequests.slice(0, 4).map((request) => {
                  const status = request.status;
                  const needsCenterSelection = status === "requested" && !request.provider_id;
                  const statusVariant = status === "reported"
                    ? "normal"
                    : status === "cancelled"
                      ? "neutral"
                      : status === "accepted"
                        ? "normal"
                        : "preliminary";
                  const statusLabel = needsCenterSelection
                    ? "نیازمند انتخاب مرکز"
                    : MEDICAL_STATUS_LABELS[status] || "وضعیت نامشخص";
                  const scheduledAt = formatDateTime(request.scheduled_at);

                  return (
                    <Link
                      key={request.id}
                      href={`/patient/medical-services#service-${request.service_kind || "other"}`}
                      className="flex min-w-0 flex-col justify-between gap-3 rounded-xl border p-4 transition hover:border-primary/30 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                            <Scan className="size-5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">
                              {MEDICAL_SERVICE_LABELS[request.service_kind] || "خدمت پزشکی"}
                            </p>
                            <p className="mt-1 truncate font-semibold">{request.service_name}</p>
                          </div>
                        </div>
                        <StatusBadge
                          label={statusLabel}
                          variant={statusVariant}
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                        <span>ثبت: {formatDateTime(request.requested_at) || formatDate(request.requested_at)}</span>
                        {scheduledAt ? <span>زمان پیشنهادی: {scheduledAt}</span> : null}
                      </div>
                      {needsCenterSelection ? (
                        <p className="text-sm font-medium text-primary">برای ادامه، مرکز درمانی را انتخاب کنید ←</p>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>فعالیت اخیر</CardTitle>
          </CardHeader>
          <CardContent>
            {!latestEvent ? (
              <EmptyState
                icon={ClipboardList}
                title="هنوز فعالیتی در پرونده شما ثبت نشده است"
                description="با ثبت اولین ویزیت، درخواست مرکز درمانی یا نتیجه آزمایش، مسیر سلامت شما اینجا نمایش داده می‌شود."
              />
            ) : (
              <div className="rounded-2xl border bg-muted/30 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {getEventLabel(latestEvent.type)} ·{" "}
                      {formatDate(latestEvent.date)}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold">
                      {latestEvent.title}
                    </h2>
                    {latestEvent.summary && (
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {latestEvent.summary}
                      </p>
                    )}
                  </div>
                  <CheckCircle2
                    className="size-5 shrink-0 text-status-normal"
                    aria-hidden="true"
                  />
                </div>

                {latestEvent.type === "lab_result" &&
                  latestEvent.resource_id && (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="mt-4"
                    >
                      <Link
                        href={`/patient/results/${latestEvent.resource_id}`}
                      >
                        مشاهده نتیجه
                        <ArrowLeft aria-hidden="true" />
                      </Link>
                    </Button>
                  )}
                {latestEvent.type === "medical_service" && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-4"
                  >
                    <Link href={`/patient/medical-services#service-${latestEvent.service_kind || "other"}`}>
                      پیگیری درخواست مرکز درمانی
                      <ArrowLeft aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>الان چه چیزی نیاز به توجه دارد؟</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {attentionItems.length === 0 ? (
              <div className="rounded-2xl border border-status-normal-border bg-status-normal-bg p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 size-5 text-status-normal"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium">
                      فعلاً موردی برای پیگیری ندارید.
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      وقتی کاری نیاز به توجه شما داشته باشد، همین‌جا نمایش داده
                      می‌شود.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              attentionItems.slice(0, 4).map((item, index) => (
                <Link
                  key={`${item.type}:${item.resource_id ?? index}`}
                  href={
                    item.type === "notification"
                      ? "/patient/notifications"
                      : item.type === "medical_service"
                        ? `/patient/medical-services#service-${item.service_kind || "other"}`
                        : "/patient/follow-ups"
                  }
                  className="block rounded-xl border p-4 transition hover:border-primary/30 hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      {item.due_date && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.type === "medical_service" ? "زمان پیشنهادی:" : "سررسید:"} {formatDate(item.due_date)}
                        </p>
                      )}
                    </div>
                    {item.status && item.status !== "unread" && (
                      <StatusBadge
                        label={
                          item.type === "medical_service"
                            ? "انتخاب مرکز"
                            : item.status === "overdue"
                              ? "عقب‌افتاده"
                              : "در انتظار"
                        }
                        variant={item.type === "medical_service" ? "preliminary" : getFollowUpVariant(item.status)}
                      />
                    )}
                  </div>
                </Link>
              ))
            )}

            {data.next_step && (
              data.next_step.type === "medical_service" ? (
                <Link href={`/patient/medical-services#service-${data.next_step.service_kind || "other"}`} className="block rounded-xl border border-primary/15 bg-accent/50 p-4 transition hover:border-primary/30">
                  <p className="text-xs text-primary">قدم بعدی پیشنهادی</p>
                  <p className="mt-1 text-sm font-medium">{data.next_step.label}</p>
                </Link>
              ) : (
                <div className="rounded-xl border border-primary/15 bg-accent/50 p-4">
                  <p className="text-xs text-primary">قدم بعدی پیشنهادی</p>
                  <p className="mt-1 text-sm font-medium">{data.next_step.label}</p>
                </div>
              )
            )}
          </CardContent>
        </Card>
      </section>



      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>آخرین نتایج</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/patient/medical-services">همه نتایج و خدمات</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentResults.length === 0 ? (
              <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                هنوز نتیجه نهایی برای شما ثبت نشده است.
              </p>
            ) : (
              <div className="space-y-3">
                {recentResults.slice(0, 5).map((report) => (
                  <Link
                    key={report.id}
                    href={`/patient/results/${report.id}`}
                    className="flex items-center justify-between gap-4 rounded-xl border p-4 transition hover:border-primary/30 hover:bg-accent/40"
                  >
                    <div>
                      <p className="font-medium">گزارش آزمایش</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(report.finalized_at ?? report.created_at)}
                      </p>
                    </div>
                    <StatusBadge
                      label={
                        report.status === "amended" ? "اصلاح‌شده" : "نهایی"
                      }
                      variant={
                        report.status === "amended" ? "amended" : "normal"
                      }
                    />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>پیگیری‌های فعال</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/patient/follow-ups">مشاهده همه</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {activeFollowUps.length === 0 ? (
              <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                فعلاً پیگیری فعالی ندارید.
              </p>
            ) : (
              <div className="space-y-3">
                {activeFollowUps.slice(0, 5).map((followUp) => (
                  <div key={followUp.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{followUp.title}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarClock
                            className="size-3.5"
                            aria-hidden="true"
                          />
                          {followUp.due_date
                            ? formatDate(followUp.due_date)
                            : "بدون تاریخ سررسید"}
                        </p>
                      </div>
                      <StatusBadge
                        label={
                          followUp.status === "overdue"
                            ? "عقب‌افتاده"
                            : "در انتظار"
                        }
                        variant={getFollowUpVariant(followUp.status)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
