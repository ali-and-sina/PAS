import Link from "next/link";
import { FileText, LineChart } from "lucide-react";

import EmptyState from "@/components/shared/EmptyState";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPatientResults } from "@/features/patient/queries";
import Pagination from "@/components/shared/Pagination";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

function formatDate(value) {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

export default async function PatientResultsPage({ searchParams }) {
  const params = await searchParams;
  const result = await getPatientResults({ page: params?.page ?? 1 });
  const reports = result.items;

  return (
    <div className="space-y-6">
      <PageHeader
        title="نتایج آزمایش‌ها"
        description="نتایج نهایی و اصلاح‌شده‌ای که در پرونده سلامت شما ثبت شده‌اند."
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
              title="هنوز نتیجه نهایی ثبت نشده است"
              description="به‌محض نهایی‌شدن نتیجه آزمایش، گزارش شما در این بخش نمایش داده می‌شود."
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
                      variant={report.status === "amended" ? "neutral" : "normal"}
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    تاریخ نهایی‌شدن: {formatDate(report.finalized_at ?? report.created_at)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    شناسه سفارش: {report.order?.id ?? "—"}
                  </p>
                </div>

                <span className="text-sm font-medium text-primary transition group-hover:translate-x-0.5">
                  مشاهده جواب ←
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Pagination pathname="/patient/results" page={result.pagination.page} pageSize={result.pagination.pageSize} totalCount={result.pagination.totalCount} totalPages={result.pagination.totalPages} />
    </div>
  );
}
