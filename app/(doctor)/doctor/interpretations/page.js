import Link from "next/link";
import { redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import SectionCard from "@/components/shared/SectionCard";
import InterpretationForm from "@/features/interpretations/components/InterpretationForm";
import { getSessionUser } from "@/lib/auth/server";
import { getDoctorInterpretations } from "@/features/interpretations/queries";
import { getDoctorReviewableReports } from "@/features/lab-orders/queries";

export const metadata = { title: "تفسیرها" };

function formatDate(value) { return value ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(value)) : "—"; }

export default async function DoctorInterpretationsPage({ searchParams }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const requestedReportId = typeof params?.report === "string" ? params.report : null;
  const [interpretations, reports] = await Promise.all([getDoctorInterpretations(user.id), getDoctorReviewableReports(user.id)]);
  const interpretedReportIds = new Set(interpretations.map((item) => item.diagnostic_report_id));
  const pendingReports = reports.filter((report) => !interpretedReportIds.has(report.id));
  const selectedReportExists = requestedReportId ? reports.some((report) => report.id === requestedReportId) : false;
  const visiblePendingReports = requestedReportId ? pendingReports.filter((report) => report.id === requestedReportId) : pendingReports;
  const visibleInterpretations = requestedReportId ? interpretations.filter((item) => item.diagnostic_report_id === requestedReportId) : interpretations;

  return (
    <>
      <PageHeader title={requestedReportId ? "بررسی گزارش انتخاب‌شده" : "تفسیرها"} description="نتایج نهایی آزمایش را بررسی و تفسیر ثبت کنید." actions={requestedReportId ? <Link href="/doctor/interpretations" className="text-sm text-primary hover:underline">نمایش همه تفسیرها</Link> : null} />

      {requestedReportId && !selectedReportExists ? (
        <EmptyState title="گزارش انتخاب‌شده پیدا نشد یا دسترسی فعال ندارید." description="گزارش ممکن است تغییر وضعیت داده باشد یا دیگر در محدوده دسترسی فعال شما نباشد." action={{ href: "/doctor/interpretations", label: "بازگشت به همه تفسیرها" }} />
      ) : reports.length === 0 ? (
        <EmptyState title="گزارش نهایی برای بررسی وجود ندارد." description="بعد از نهایی‌شدن نتیجه در آزمایشگاه، گزارش اینجا ظاهر می‌شود." />
      ) : (
        <div className="space-y-6">
          {visiblePendingReports.length ? <SectionCard title="گزارش‌های نیازمند بررسی"><div className="space-y-4">{visiblePendingReports.map((report) => <div key={report.id} className="rounded-lg border p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{report.patient_name}</p><p className="mt-1 text-xs text-muted-foreground">گزارش نهایی · {formatDate(report.finalized_at)}</p></div><Link href={`/doctor/patients/${report.patient_id}`} className="text-sm text-primary hover:underline">پرونده بیمار</Link></div><InterpretationForm reportId={report.id} /></div>)}</div></SectionCard> : null}

          <SectionCard title="تفسیرهای ثبت‌شده">
            {visibleInterpretations.length ? <div className="space-y-4">{visibleInterpretations.map((item) => <article key={item.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-medium">{item.patient_name}</p><span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-7">{item.content}</p><div className="mt-3 flex gap-3 text-xs"><Link href={`/doctor/lab-orders/${item.report?.lab_order_id || ""}`} className="text-primary hover:underline">مشاهده آزمایش</Link><span className={item.is_visible_to_patient ? "text-emerald-600" : "text-muted-foreground"}>{item.is_visible_to_patient ? "قابل مشاهده برای بیمار" : "فقط پزشک"}</span></div></article>)}</div> : <p className="text-sm text-muted-foreground">هنوز تفسیری ثبت نشده است.</p>}
          </SectionCard>
        </div>
      )}
    </>
  );
}
