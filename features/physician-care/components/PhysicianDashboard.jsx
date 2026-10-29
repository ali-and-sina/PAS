import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhysicianFollowUpStatusForm } from "@/features/physician-care/components/FollowUpForms";
import DashboardWelcome from "@/components/shared/DashboardWelcome";
import StatCard from "@/components/shared/StatCard";

function formatDate(value) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(parsed);
}

const statItems = [
  { key: "activePatients", label: "بیماران دارای ارتباط فعال", icon: Users, tone: "neutral", href: "/doctor/patients" },
  { key: "newResults", label: "بیماران با نتیجه جدید", icon: FileCheck2, tone: "info", href: "/doctor/interpretations" },
  { key: "followUpsDue", label: "پیگیری‌های امروز", icon: CalendarClock, tone: "warning", href: "/doctor/follow-ups?status=due" },
  { key: "completedRequestedTests", label: "تست‌های تکمیل‌شده", icon: CheckCircle2, tone: "info", href: "/doctor/lab-orders?status=completed" },
  { key: "pendingRequestedTests", label: "تست‌های انجام‌نشده", icon: ClipboardCheck, tone: "neutral", href: "/doctor/lab-orders?status=open" },
  { key: "overdueFollowUps", label: "پیگیری‌های عقب‌افتاده", icon: AlertCircle, tone: "warning", href: "/doctor/follow-ups?status=overdue" },
  { key: "doctorNotes", label: "یادداشت‌های پزشک", icon: FileText, tone: "neutral", href: "/doctor/notes" },
  { key: "unreadNotifications", label: "اعلان‌های خوانده‌نشده", icon: Bell, tone: "info", href: "/doctor/notifications" },
];

const toneClasses = {
  danger: "bg-status-high-bg text-status-high",
  warning: "bg-status-low-bg text-status-low",
  info: "bg-accent text-primary",
  neutral: "bg-muted text-muted-foreground",
};

export default function PhysicianDashboard({ data }) {
  const greetingName = data.doctor?.full_name?.trim() || "دکتر";
  const followUps = Array.isArray(data.followUps) ? data.followUps : [];
  const attention = Array.isArray(data.attention) ? data.attention : [];
  const recentPatients = Array.isArray(data.recentPatients) ? data.recentPatients : [];

  return (
    <div className="space-y-6">
      <DashboardWelcome
        eyebrow="مراقبت روزانه · فضای پزشک"
        title={`سلام، ${greetingName}`}
        description="بیماران، نتایج تازه و پیگیری‌های امروز را از اینجا دنبال کنید."
        actions={<>
            <Button asChild><Link href="/doctor/lab-orders/new">ثبت درخواست آزمایش</Link></Button>
            <Button asChild variant="outline"><Link href="/doctor/patients">مشاهده بیماران</Link></Button>
        </>}
      />

      <section aria-label="شمارنده‌های قابل پیگیری" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {statItems.map(({ key, label, icon: Icon, tone, href }) => (
          <StatCard key={key} href={href} label={label} value={data.counts?.[key] ?? 0} icon={Icon} tone={tone} />
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section aria-labelledby="attention-heading">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle id="attention-heading">نیازمند توجه</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">مواردی که بهتر است امروز بررسی شوند.</p>
              </div>
              <Bell className="size-5 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent className="pt-0">
              {attention.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-5 shrink-0 text-status-normal" aria-hidden="true" />
                  <span>فعلاً موردی برای بررسی نمایش داده نمی‌شود.</span>
                </div>
              ) : (
                <div className="divide-y">
                  {attention.map((item) => (
                    <Link
                      href={item.reportId ? `/doctor/interpretations?report=${item.reportId}` : item.orderId ? `/doctor/lab-orders/${item.orderId}` : item.patientId ? `/doctor/patients/${item.patientId}` : "/doctor/notifications"}
                      key={`${item.type}-${item.reportId || item.orderId || item.patientId}`}
                      className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
                    >
                      <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                        {item.type === "new_result" ? <Activity className="size-4" aria-hidden="true" /> : <ClipboardCheck className="size-4" aria-hidden="true" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <span className="font-medium">{item.patientName}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>
                        </span>
                        <span className="mt-1 block text-sm">{item.title}</span>
                        <span className="mt-1 block truncate text-sm text-muted-foreground">{item.detail}</span>
                      </span>
                      <ArrowLeft className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="patients-heading">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle id="patients-heading">آخرین بیماران</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">دسترسی سریع به پرونده بیماران فعال.</p>
              </div>
              <Users className="size-5 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent className="pt-0">
              {recentPatients.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">هنوز بیماری با رابطه فعال وجود ندارد.</p>
              ) : (
                <div className="space-y-2">
                  {recentPatients.map((patient) => (
                    <Link key={patient.id} href={`/doctor/patients/${patient.id}`} className="flex items-center justify-between rounded-xl border px-4 py-3 transition-colors hover:bg-muted/40">
                      <span className="font-medium">{patient.fullName}</span>
                      <ArrowLeft className="size-4 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}
              <Button asChild variant="outline" className="mt-4 w-full"><Link href="/doctor/patients">همه بیماران</Link></Button>
            </CardContent>
          </Card>
        </section>
      </div>

      <section id="follow-ups" aria-labelledby="followups-heading">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div>
              <CardTitle id="followups-heading">پیگیری‌های باز</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">فهرست واقعی پیگیری‌های در انتظار و سررسیدگذشته.</p>
            </div>
            <Button asChild variant="outline" size="sm"><Link href="/doctor/follow-ups">همه پیگیری‌ها</Link></Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {followUps.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">پیگیری باز یا سررسیدگذشته‌ای وجود ندارد.</div>
            ) : followUps.map((item) => (
              <article key={item.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <Link className="font-medium hover:text-primary" href={`/doctor/patients/${item.patient_id}`}>{item.title}</Link>
                    <p className="mt-1 text-sm text-muted-foreground">{item.patientName} · سررسید {formatDate(item.due_date)}</p>
                    {item.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.description}</p> : null}
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs ${item.displayStatus === "overdue" ? toneClasses.warning : toneClasses.neutral}`}>
                    {item.displayStatus === "overdue" ? "عقب‌افتاده" : "در انتظار"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PhysicianFollowUpStatusForm id={item.id} status="completed" label="تکمیل پیگیری" variant="outline" />
                  <PhysicianFollowUpStatusForm id={item.id} status="cancelled" label="لغو" variant="ghost" />
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
