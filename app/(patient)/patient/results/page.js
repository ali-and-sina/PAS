import Link from "next/link";
import { FileText, LineChart } from "lucide-react";

import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPatientResults } from "@/features/patient/queries";
import Pagination from "@/components/shared/Pagination";
import { getPatientInsuranceReferralResults } from "@/features/insurance-prescriptions/queries";
import { PatientReferralResults } from "@/features/insurance-prescriptions/components/PatientReferralResults";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

export default async function PatientResultsPage({ searchParams }) {
  const params = await searchParams;
  const [result, insuranceResults] = await Promise.all([
    getPatientResults({ page: params?.page ?? 1 }),
    getPatientInsuranceReferralResults(50),
  ]);
  const reports = result.items;

  return (
    <div className="space-y-6">
      <PageHeader
        title="نتایج خدمات پزشکی"
        description="نتایج نهایی آزمایش‌ها و سایر خدمات درمانی که در پرونده سلامت شما ثبت شده‌اند."
        actions={
          <Button asChild variant="outline">
            <Link href="/patient/trends">
              <LineChart aria-hidden="true" />
              مقایسه نتایج
            </Link>
          </Button>
        }
      />

      {reports.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FileText}
              title="نتیجه‌ای در این بخش ثبت نشده است"
              description="نتایج مسیر عادی آزمایش در این قسمت نمایش داده می‌شود؛ گزارش‌های بیمه‌ای در بخش جداگانه پایین صفحه قرار دارند."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Link
              key={report.id}
              href={`/patient/results/${report.id}`}
              className="group rounded-2xl border bg-card p-5 transition hover:border-primary/30 hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">گزارش آزمایش</h2>
                    <StatusBadge
                      label={report.status === "amended" ? "اصلاح‌شده" : "نهایی"}
                      variant={report.status === "amended" ? "amended" : "normal"}
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    تاریخ نهایی‌شدن: {formatDate(report.finalized_at ?? report.created_at)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    شناسه درخواست آزمایش: {report.order?.id ?? "—"}
                  </p>
                </div>

                <span className="text-sm font-medium text-primary">
                  مشاهده نتیجه
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Pagination pathname="/patient/results" page={result.pagination.page} pageSize={result.pagination.pageSize} totalCount={result.pagination.totalCount} totalPages={result.pagination.totalPages} />
      <section className="space-y-3" aria-labelledby="insurance-results-title">
        <div>
          <h2 id="insurance-results-title" className="text-lg font-semibold">نتایج خدمات بیمه‌ای</h2>
          <p className="mt-1 text-sm text-muted-foreground">نتایج نهایی و منتشرشده‌ای که مراکز درمانی از مسیر ارجاع بیمه‌ای ارسال کرده‌اند.</p>
        </div>
        <PatientReferralResults items={insuranceResults} />
      </section>
    </div>
  );
}
