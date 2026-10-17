import Link from "next/link";
import { FileText } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LabResultStatus from "@/features/lab-results/components/LabResultStatus";
import { getLabReports } from "@/features/lab/queries";
import { Button } from "@/components/ui/button";
import Pagination from "@/components/shared/Pagination";
import StatusFilterLinks from "@/features/lab/components/StatusFilterLinks";

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

const FILTERS = [
  { value: "", label: "همه" },
  { value: "draft", label: "پیش‌نویس نتیجه" },
  { value: "ready_to_finalize", label: "آماده نهایی‌سازی" },
  { value: "final", label: "نهایی" },
  { value: "amended", label: "اصلاح‌شده" },
];

export const metadata = { title: "نتایج آزمایشگاه" };
export const dynamic = "force-dynamic";

export default async function LabResultsPage({ searchParams }) {
  const params = searchParams ? await searchParams : {};
  const requestedStatus = typeof params?.status === "string" ? params.status : "";
  const status = ["draft", "ready_to_finalize", "final", "amended"].includes(requestedStatus) ? requestedStatus : "";
  const result = await getLabReports(status || null, { page: params?.page ?? 1 });
  const reports = result.items;

  return (
    <div className="space-y-5">
      <PageHeader title="نتایج ثبت‌شده" description="پیش‌نویس‌ها، نتایج آماده نهایی‌سازی و نتایج نهایی یا اصلاح‌شده آزمایشگاه را بررسی کنید." />

      <StatusFilterLinks
        filters={FILTERS}
        active={status}
        pathname="/lab/results"
        ariaLabel="فیلتر وضعیت نتایج آزمایش"
      />

      {reports.length ? (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="rounded-xl border bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{report.patient?.full_name || "بیمار"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{report.doctor?.full_name || "پزشک"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(report.finalized_at || report.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <LabResultStatus status={report.status} />
                  <Button asChild size="sm" variant="outline"><Link href={`/lab/results/${report.id}`}>مشاهده</Link></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={FileText} title={status ? "نتیجه‌ای در این وضعیت وجود ندارد" : "نتیجه‌ای ثبت نشده است"} description="نتایج آزمایش‌های پذیرفته‌شده در این صفحه نمایش داده می‌شوند." />
      )}
      <Pagination pathname="/lab/results" page={result.pagination.page} pageSize={result.pagination.pageSize} totalCount={result.pagination.totalCount} totalPages={result.pagination.totalPages} hasNextPage={result.pagination.hasNextPage} query={{ status }} />
    </div>
  );
}
