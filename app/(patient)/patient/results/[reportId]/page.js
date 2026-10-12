import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  FlaskConical,
  LineChart,
  Stethoscope,
} from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPatientResult } from "@/features/patient/queries";
import { formatReferenceRange, getReferenceSourceLabel } from "@/features/lab-results/reference-format";
import { getTestDisplayName } from "@/lib/medical/test-name";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

function formatDateTime(value) {
  return value ? dateTimeFormatter.format(new Date(value)) : "—";
}

function getNestedTest(observation) {
  return Array.isArray(observation?.test_definitions)
    ? observation.test_definitions[0]
    : observation?.test_definitions;
}

function formatValue(observation) {
  if (observation.value_numeric !== null && observation.value_numeric !== undefined) {
    return observation.value_numeric;
  }
  if (observation.value_boolean !== null && observation.value_boolean !== undefined) {
    return observation.value_boolean ? "مثبت" : "منفی";
  }
  return observation.value_text ?? "—";
}



function getFlagMeta(flag) {
  const flags = {
    low: { label: "پایین", variant: "low" },
    high: { label: "بالا", variant: "high" },
    critical: { label: "بحرانی", variant: "critical" },
    normal: { label: "طبیعی", variant: "normal" },
  };
  return flags[flag] ?? null;
}

export default async function PatientResultDetailPage({ params }) {
  const { reportId } = await params;
  const report = await getPatientResult(reportId);

  if (!report) notFound();

  const observations = report.observations ?? [];
  const numericTests = observations.filter(
    (observation) =>
      observation.value_numeric !== null && observation.value_numeric !== undefined,
  );

  return (
    <div className="space-y-6">
      <Link
        href="/patient/results"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight aria-hidden="true" />
        بازگشت به نتایج
      </Link>

      <PageHeader
        title="جواب آزمایش"
        description={`نهایی‌شده در ${formatDateTime(report.finalized_at ?? report.created_at)}`}
        actions={
          numericTests.length > 0 ? (
            <Button asChild variant="outline">
              <Link href="/patient/trends">
                <LineChart aria-hidden="true" />
                مقایسه نتایج
              </Link>
            </Button>
          ) : null
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">وضعیت</p>
            <div className="mt-2">
              <StatusBadge
                label={report.status === "amended" ? "اصلاح‌شده" : "نهایی"}
                variant={report.status === "amended" ? "neutral" : "normal"}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">تاریخ سفارش</p>
            <p className="mt-2 font-medium">{formatDate(report.order?.ordered_at)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">تعداد موارد ثبت‌شده</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{observations.length}</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="size-5 text-primary" aria-hidden="true" />
            نتایج ساختاریافته
          </CardTitle>
        </CardHeader>
        <CardContent>
          {observations.length === 0 ? (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              نتیجه‌ای برای این گزارش ثبت نشده است.
            </p>
          ) : (
            <div className="space-y-3">
              {observations.map((observation) => {
                const test = getNestedTest(observation);
                const flag = getFlagMeta(observation.flag);

                return (
                  <article key={observation.id} className="rounded-2xl border p-4 sm:p-5">
                    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.8fr_0.8fr_1fr] lg:items-center">
                      <div>
                        <p className="font-medium">{getTestDisplayName(test)}</p>
                        {test?.internal_code && (
                          <p className="mt-1 text-xs text-muted-foreground">{test.internal_code}</p>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">نتیجه</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums">
                          {formatValue(observation)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">واحد</p>
                        <p className="mt-1 text-sm">{observation.unit || test?.default_unit || "—"}</p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">محدوده مرجع</p>
                        <p className="mt-1 text-sm">{formatReferenceRange(observation) || "محدوده مرجع ثبت نشده"}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
                      <span>زمان ثبت: {formatDateTime(observation.observed_at ?? observation.created_at)}</span>
                      {flag && <StatusBadge label={flag.label} variant={flag.variant} />}
                      {getReferenceSourceLabel(observation.reference_source) && (
                        <span>
                          منبع محدوده: {getReferenceSourceLabel(observation.reference_source)}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="size-5 text-primary" aria-hidden="true" />
              پزشک
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {report.doctor?.full_name ? `دکتر ${report.doctor.full_name}` : "پزشک ثبت نشده"}
            </p>
            {report.doctor?.specialty && (
              <p className="mt-1 text-sm text-muted-foreground">{report.doctor.specialty}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>آزمایشگاه</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{report.laboratory?.full_name ?? "آزمایشگاه ثبت نشده"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              این اطلاعات صرفاً برای شناسایی منبع نتیجه نمایش داده می‌شود.
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm leading-7 text-amber-900">
          محدوده مرجع فقط برای مقایسه عددی نتیجه با محدوده ثبت‌شده توسط آزمایشگاه است و به‌تنهایی به معنی تشخیص بیماری نیست. تفسیر بالینی بر عهده پزشک است.
        </p>
      </div>
    </div>
  );
}
