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

function formatDate(value) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

function getEventLabel(type) {
  return (
    {
      visit: "ویزیت",
      lab_order: "درخواست آزمایش",
      lab_result: "نتیجه آزمایش",
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

  return (
    <div className="space-y-6">
      <DashboardWelcome
        eyebrow="مسیر سلامت شما"
        title={firstName ? `سلام، ${firstName}` : "سلام"}
        description="نتایج، پیگیری‌ها و قدم بعدی مراقبت را از اینجا دنبال کنید."
        actions={
          <Button asChild variant="outline">
            <Link href="/patient/results">
              <FileText aria-hidden="true" />
              نتایج آزمایش
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
                description="با ثبت اولین ویزیت یا نتیجه آزمایش، مسیر سلامت شما اینجا شروع می‌شود."
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
                      : "/patient/follow-ups"
                  }
                  className="block rounded-xl border p-4 transition hover:border-primary/30 hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      {item.due_date && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          سررسید: {formatDate(item.due_date)}
                        </p>
                      )}
                    </div>
                    {item.status && item.status !== "unread" && (
                      <StatusBadge
                        label={
                          item.status === "overdue" ? "عقب‌افتاده" : "در انتظار"
                        }
                        variant={getFollowUpVariant(item.status)}
                      />
                    )}
                  </div>
                </Link>
              ))
            )}

            {data.next_step && (
              <div className="rounded-xl border border-primary/15 bg-accent/50 p-4">
                <p className="text-xs text-primary">قدم بعدی پیشنهادی</p>
                <p className="mt-1 text-sm font-medium">
                  {data.next_step.label}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>آخرین نتایج</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/patient/results">همه نتایج</Link>
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
