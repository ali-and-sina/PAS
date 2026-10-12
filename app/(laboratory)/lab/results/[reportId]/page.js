import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard from "@/components/shared/SectionCard";
import LabResultStatus from "@/features/lab-results/components/LabResultStatus";
import LabResultTable from "@/features/lab-results/components/LabResultTable";
import CorrectionHistoryDrawer from "@/features/lab-results/components/CorrectionHistoryDrawer";
import GuestResultLinkPanel from "@/features/lab/components/GuestResultLinkPanel";
import { getLabReport } from "@/features/lab/queries";
import { Button } from "@/components/ui/button";

export const metadata = { title: "جزئیات نتیجه آزمایش" };

export default async function LabReportPage({ params }) {
  const { reportId } = await params;
  const report = await getLabReport(reportId, { auditView: true, includeAttachments: true });
  if (!report) notFound();

  const visible = report.observations.filter((item) => item.status !== "superseded");

  return (
    <>
      <PageHeader title="جزئیات نتیجه" description={`بیمار: ${report.order.patient?.full_name || "بدون نام"}`} actions={<Button asChild variant="outline"><Link href="/lab/results">بازگشت</Link></Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2"><LabResultStatus status={report.status} />{report.status === "final" || report.status === "amended" ? <Button asChild size="sm" variant="outline"><Link href={`/lab/results/${report.id}/correct`}>اصلاح نتیجه</Link></Button> : null}</div>
      <SectionCard title="نتایج آزمایش"><LabResultTable observations={visible} /></SectionCard>
      {report.status === "final" || report.status === "amended" ? (
        <div className="mt-4">
          <GuestResultLinkPanel reportId={report.id} patientPhone={report.order.patient?.phone || null} />
        </div>
      ) : null}
      {report.attachments?.length ? (
        <SectionCard title="پیوست‌ها" className="mt-4">
          <div className="space-y-2">
            {report.attachments.map((attachment) => (
              <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{attachment.file_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">فایل گزارش · {Math.ceil((attachment.file_size_bytes || 0) / 1024)} کیلوبایت</p>
                </div>
                {attachment.signed_url ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={attachment.signed_url} target="_blank" rel="noreferrer">مشاهده فایل گزارش</a>
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
      <div className="mt-4"><CorrectionHistoryDrawer observations={report.observations} /></div>
    </>
  );
}
