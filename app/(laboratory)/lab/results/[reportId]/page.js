import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import DisclosureSection from "@/components/shared/DisclosureSection";
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
  const criticalCount = visible.filter((item) =>
    ["critical", "critical_low", "critical_high"].includes(item.flag),
  ).length;
  const attentionCount = visible.filter((item) =>
    ["low", "high", "critical", "critical_low", "critical_high"].includes(item.flag),
  ).length;

  return (
    <>
      <PageHeader title="جزئیات نتیجه" description={`بیمار: ${report.order.patient?.full_name || "بدون نام"}`} actions={<Button asChild variant="outline"><Link href="/lab/results">بازگشت</Link></Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2"><LabResultStatus status={report.status} />{report.status === "final" || report.status === "amended" ? <Button asChild size="sm" variant="outline"><Link href={`/lab/results/${report.id}/correct`}>اصلاح نتیجه</Link></Button> : null}</div>
      {criticalCount > 0 ? (
        <div role="alert" className="mb-4 rounded-xl border border-status-critical-border bg-status-critical-bg p-4 text-sm leading-6 text-status-critical">
          در این گزارش {criticalCount} مورد با پرچم بحرانی ثبت شده است. جزئیات این موارد برای بررسی در بخش نتایج در دسترس است.
        </div>
      ) : attentionCount > 0 ? (
        <p className="mb-4 rounded-xl border border-status-high-border bg-status-high-bg p-4 text-sm leading-6 text-status-high">
          {attentionCount} مورد دارای پرچم بالا یا پایین در این گزارش ثبت شده است.
        </p>
      ) : null}
      <DisclosureSection
        title="نتایج آزمایش"
        description={attentionCount ? `${visible.length} مورد ثبت‌شده · ${attentionCount} مورد دارای پرچم خارج از محدوده` : "برای مشاهدهٔ مقادیر، محدوده‌های مرجع و وضعیت هر آزمایش، جزئیات را باز کنید."}
        meta={`${visible.length} مورد`}
      >
        <LabResultTable observations={visible} />
      </DisclosureSection>
      {report.status === "final" || report.status === "amended" ? (
        <div className="mt-4">
          <GuestResultLinkPanel reportId={report.id} patientPhone={report.order.patient?.phone || null} />
        </div>
      ) : null}
      {report.attachments?.length ? (
        <DisclosureSection title="پیوست‌ها" description="فایل‌های پیوست‌شده به گزارش آزمایش" meta={`${report.attachments.length} فایل`} className="mt-4">
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
        </DisclosureSection>
      ) : null}
      <div className="mt-4"><CorrectionHistoryDrawer observations={report.observations} /></div>
    </>
  );
}
