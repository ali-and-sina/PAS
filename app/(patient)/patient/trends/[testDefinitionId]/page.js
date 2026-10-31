import Link from "next/link";
import { ArrowRight, BarChart3, LineChart } from "lucide-react";

import PageHeader from "@/components/shared/PageHeader";
import DisclosureSection from "@/components/shared/DisclosureSection";
import StatusBadge from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPatientResultComparison,
  getPatientTrend,
} from "@/features/patient/queries";
import TrendChart from "@/features/trends/components/TrendChart";
import { getTestDisplayName } from "@/lib/medical/test-name";
import { formatReferenceRange } from "@/features/lab-results/reference-format";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

function getTest(observation) {
  return Array.isArray(observation?.test_definitions)
    ? observation.test_definitions[0]
    : observation?.test_definitions;
}

function getValue(observation) {
  if (observation?.value_numeric !== null && observation?.value_numeric !== undefined) {
    return observation.value_numeric;
  }
  if (observation?.value_boolean !== null && observation?.value_boolean !== undefined) {
    return observation.value_boolean ? "مثبت" : "منفی";
  }
  return observation?.value_text ?? "—";
}

export default async function PatientTrendDetailPage({ params }) {
  const { testDefinitionId } = await params;
  const history = await getPatientTrend(testDefinitionId);
  const comparison = await getPatientResultComparison({ testDefinitionId });

  const test = history.length ? getTest(history[history.length - 1]) : null;
  const unit = history.find((item) => item.unit)?.unit ?? test?.default_unit ?? null;
  const numericHistory = history.every(
    (item) => item.value_numeric !== null && item.value_numeric !== undefined,
  );
  const chartData = numericHistory
    ? history.map((item) => ({
        date: formatDate(item.observed_at ?? item.finalized_at),
        value: Number(item.value_numeric),
      }))
    : [];

  return (
    <div className="space-y-6">
      <Link
        href="/patient/trends"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight aria-hidden="true" />
        بازگشت به روندها
      </Link>

      <PageHeader
        title={getTestDisplayName(test)}
        description={
          unit
            ? `مقایسه نتایج ثبت‌شده بر حسب ${unit}`
            : "مقایسه نتایج ثبت‌شده در طول زمان"
        }
      />

      {!history.length ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">نتیجه‌ای برای این آزمایش پیدا نشد.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {comparison && (
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">آخرین مقدار</p>
                    <div className="mt-1 flex items-end gap-2">
                      <span className="text-3xl font-semibold tabular-nums">
                        {comparison.currentValue}
                      </span>
                      {unit && <span className="pb-1 text-sm text-muted-foreground">{unit}</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(comparison.current?.observed_at)}
                    </p>
                  </div>

                  <div className="rounded-xl border bg-muted/30 px-4 py-3">
                    <p className="text-xs text-muted-foreground">تغییر نسبت به نتیجه قبلی</p>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge
                        label={
                          comparison.direction === "up"
                            ? "افزایش"
                            : comparison.direction === "down"
                              ? "کاهش"
                              : comparison.direction === "new"
                                ? "اولین نتیجه"
                                : "بدون تغییر"
                        }
                        variant="neutral"
                      />
                      {comparison.difference !== null && (
                        <span className="text-sm font-medium tabular-nums">
                          {comparison.difference > 0 ? "+" : ""}{comparison.difference}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {numericHistory ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="size-5 text-primary" aria-hidden="true" />
                  نمودار تغییرات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart data={chartData} unit={unit} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="size-5 text-primary" aria-hidden="true" />
                  سوابق ثبت‌شده
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-7 text-muted-foreground">
                  این آزمایش عددی نیست؛ بنابراین روند به‌شکل زمانی نمایش داده می‌شود.
                </p>
              </CardContent>
            </Card>
          )}

          <DisclosureSection
            title="سوابق نتایج"
            description="جدول کامل مقادیر قبلی و محدوده‌های مرجع"
            meta={`${history.length} نتیجه`}
            stickySummary
          >
            <div className="space-y-3">
              <div className="grid gap-3 lg:hidden">
                {history.map((item) => {
                  const flagLabel = item.flag === "high" ? "بالا" : item.flag === "low" ? "پایین" : item.flag === "critical" ? "بحرانی" : "ثبت‌شده";
                  const flagVariant = item.flag === "critical" ? "critical" : item.flag === "high" ? "high" : item.flag === "low" ? "low" : "neutral";
                  return (
                    <article key={item.id} className="min-w-0 rounded-xl border bg-card p-4">
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{formatDate(item.observed_at)}</p>
                        <StatusBadge label={flagLabel} variant={flagVariant} />
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-3 border-t pt-3">
                        <div className="min-w-0">
                          <dt className="text-xs text-muted-foreground">نتیجه</dt>
                          <dd className="mt-1 break-words text-base font-semibold tabular-nums">{getValue(item)}</dd>
                        </div>
                        <div className="col-span-2 min-w-0">
                          <dt className="text-xs text-muted-foreground">محدودهٔ مرجع</dt>
                          <dd className="mt-1 break-words text-sm leading-6 text-muted-foreground">{formatReferenceRange(item) || "محدوده مرجع ثبت نشده"}</dd>
                        </div>
                      </dl>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[760px] text-right text-sm">
                  <thead>
                    <tr className="border-b">
                      <th scope="col" className="px-3 py-3 font-medium">تاریخ</th>
                      <th scope="col" className="px-3 py-3 font-medium">نتیجه</th>
                      <th scope="col" className="px-3 py-3 font-medium">محدوده مرجع</th>
                      <th scope="col" className="px-3 py-3 font-medium">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-3">{formatDate(item.observed_at)}</td>
                        <td className="px-3 py-3 font-medium tabular-nums">{getValue(item)}</td>
                        <td className="px-3 py-3 text-muted-foreground">{formatReferenceRange(item) || "محدوده مرجع ثبت نشده"}</td>
                        <td className="px-3 py-3">
                          <StatusBadge
                            label={item.flag === "high" ? "بالا" : item.flag === "low" ? "پایین" : item.flag === "critical" ? "بحرانی" : "ثبت‌شده"}
                            variant={item.flag === "critical" ? "critical" : item.flag === "high" ? "high" : item.flag === "low" ? "low" : "neutral"}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </DisclosureSection>
        </>
      )}
    </div>
  );
}
