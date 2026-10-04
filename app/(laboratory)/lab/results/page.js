import Link from "next/link";
import { FileText } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import LabResultStatus from "@/features/lab-results/components/LabResultStatus";
import { getLabReports } from "@/features/lab/queries";
import { Button } from "@/components/ui/button";

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(value)) : "—";
}

export const metadata = { title: "نتایج آزمایشگاه" };

export default async function LabResultsPage() {
  const reports = await getLabReports();
  return (
    <>
      <PageHeader title="نتایج ثبت‌شده" description="پیش‌نویس‌ها، نتایج نهایی و اصلاح‌شده آزمایشگاه." />
      {!reports.length ? <EmptyState icon={FileText} title="نتیجه‌ای ثبت نشده است" description="نتایج ثبت‌شده سفارش‌ها در این صفحه نمایش داده می‌شوند." /> : <div className="space-y-3">{reports.map((report) => <div key={report.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4"><div><p className="font-medium">{report.patient?.full_name || "بیمار"}</p><p className="mt-1 text-sm text-muted-foreground">{report.doctor?.full_name || "پزشک"} · {formatDate(report.finalized_at || report.created_at)}</p></div><div className="flex items-center gap-3"><LabResultStatus status={report.status} /><Button asChild size="sm" variant="outline"><Link href={`/lab/results/${report.id}`}>مشاهده</Link></Button></div></div>)}</div>}
    </>
  );
}
