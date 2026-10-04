import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard from "@/components/shared/SectionCard";
import LabResultStatus from "@/features/lab-results/components/LabResultStatus";
import LabResultTable from "@/features/lab-results/components/LabResultTable";
import CorrectionHistoryDrawer from "@/features/lab-results/components/CorrectionHistoryDrawer";
import { getLabReport } from "@/features/lab/queries";
import { Button } from "@/components/ui/button";

export const metadata = { title: "جزئیات نتیجه آزمایش" };

export default async function LabReportPage({ params }) {
  const { reportId } = await params;
  const report = await getLabReport(reportId);
  if (!report) notFound();

  const visible = report.observations.filter((item) => item.status !== "superseded");

  return (
    <>
      <PageHeader title="جزئیات نتیجه" description={`بیمار: ${report.order.patient?.full_name || "بدون نام"}`} actions={<Button asChild variant="outline"><Link href="/lab/results">بازگشت</Link></Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2"><LabResultStatus status={report.status} />{report.status === "final" || report.status === "amended" ? <Button asChild size="sm" variant="outline"><Link href={`/lab/results/${report.id}/correct`}>اصلاح نتیجه</Link></Button> : null}</div>
      <SectionCard title="نتایج آزمایش"><LabResultTable observations={visible} /></SectionCard>
      <div className="mt-4"><CorrectionHistoryDrawer observations={report.observations} /></div>
    </>
  );
}
