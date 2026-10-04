import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  ClipboardList,
  FileText,
  Pill,
  UserRound,
} from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import EmptyState from "@/components/shared/EmptyState";
import { getPatientDashboard } from "@/features/patient/queries";

export const metadata = {
  title: "داشبورد بیمار",
};

function formatDate(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function reportStatus(status) {
  return status === "amended" ? "اصلاح‌شده" : "نهایی";
}

export default async function PatientDashboardPage() {
  const data = await getPatientDashboard();

  const stats = [
    {
      label: "اعلان‌های خوانده‌نشده",
      value: data.unreadNotifications,
      href: "/patient/notifications",
      icon: Bell,
    },
    {
      label: "درخواست‌های در انتظار",
      value: data.pendingRequests,
      href: "/patient/health-record",
      icon: UserRound,
    },
    {
      label: "نتایج اخیر",
      value: data.recentResults.length,
      href: "/patient/results",
      icon: FileText,
    },
  ];

  return (
    <div>
      <PageHeader
        title={`سلام${data.patient?.full_name ? `، ${data.patient.full_name}` : ""} 👋`}
        description="خلاصه‌ای از وضعیت سلامت و فعالیت‌های اخیر شما."
      />

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Link key={stat.label} href={stat.href} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-sm">
                <CardContent className="flex items-center justify-between gap-4 pt-6">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums">
                      {stat.value}
                    </p>
                  </div>

                  <Icon
                    className="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      <section aria-labelledby="recent-results-heading" className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            id="recent-results-heading"
            className="text-lg font-semibold"
          >
            آخرین نتایج آزمایش
          </h2>

          <Button asChild variant="ghost" size="sm">
            <Link href="/patient/results">
              همه نتایج
              <ArrowLeft className="ms-1 size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {data.recentResults.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="هنوز نتیجه‌ای ثبت نشده است"
            description="بعد از نهایی‌شدن نتیجه آزمایش، گزارش آن در این بخش نمایش داده می‌شود."
            action={{
              label: "مشاهده آزمایش‌ها",
              href: "/patient/results",
            }}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.recentResults.map((report) => (
              <Link
                key={report.id}
                href={`/patient/results/${report.id}`}
                className="rounded-xl border bg-card p-4 transition hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <FileText
                    className="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-xs text-muted-foreground">
                    {reportStatus(report.status)}
                  </span>
                </div>

                <p className="mt-3 text-sm font-medium">
                  گزارش آزمایش
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(report.created_at)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="recent-rx-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="recent-rx-heading" className="text-lg font-semibold">
            نسخه‌های اخیر
          </h2>

          <Button asChild variant="ghost" size="sm">
            <Link href="/patient/prescriptions">
              همه نسخه‌ها
              <ArrowLeft className="ms-1 size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {data.recentPrescriptions.length === 0 ? (
          <EmptyState
            icon={Pill}
            title="نسخه‌ای وجود ندارد"
            description="نسخه‌هایی که پزشک برای شما ثبت کند در این بخش نمایش داده می‌شوند."
            action={{
              label: "مشاهده نسخه‌ها",
              href: "/patient/prescriptions",
            }}
          />
        ) : (
          <div className="space-y-3">
            {data.recentPrescriptions.map((prescription) => (
              <Link
                key={prescription.id}
                href="/patient/prescriptions"
                className="block rounded-xl border bg-card p-4 transition hover:shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {prescription.doctor_name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(prescription.issued_at)}
                    </p>
                  </div>

                  <span className="text-xs text-muted-foreground">
                    {prescription.status === "active"
                      ? "فعال"
                      : prescription.status === "completed"
                        ? "تکمیل‌شده"
                        : "لغوشده"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
