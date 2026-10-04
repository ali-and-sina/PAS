import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import SectionCard from "@/components/shared/SectionCard";
import CorrectionForm from "@/features/lab-results/components/CorrectionForm";
import { getLabReport } from "@/features/lab/queries";
import { Button } from "@/components/ui/button";

export const metadata = { title: "اصلاح نتیجه آزمایش" };

export default async function CorrectLabReportPage({ params }) {
  const { reportId } = await params;
  const report = await getLabReport(reportId);
  if (!report) notFound();

  const observations = report.observations.filter((item) => item.status === "final" || item.status === "corrected");

  return (
    <>
      <PageHeader title="اصلاح نتیجه" description="مقدار قبلی حذف نمی‌شود و به‌عنوان بخشی از تاریخچه باقی می‌ماند." actions={<Button asChild variant="outline"><Link href={`/lab/results/${report.id}`}>بازگشت</Link></Button>} />
      <SectionCard title="انتخاب نتیجه برای اصلاح">
        <div className="space-y-3">
          {observations.map((observation) => <CorrectionForm key={observation.id} reportId={report.id} observation={observation} />)}
        </div>
      </SectionCard>
    </>
  );
}
