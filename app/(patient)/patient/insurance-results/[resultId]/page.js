import { notFound } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import { PatientReferralResultDetail } from "@/features/insurance-prescriptions/components/PatientReferralResults";
import { getPatientInsuranceReferralResultDetail } from "@/features/insurance-prescriptions/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "نتیجه خدمت بیمه‌ای" };

export default async function PatientInsuranceResultDetailPage({ params }) {
  const { resultId } = await params;
  const result = await getPatientInsuranceReferralResultDetail(resultId);
  if (!result) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title="نتیجه خدمت بیمه‌ای" description="گزارش نهایی منتشرشده از مرکز درمانی یا داروخانه." />
      <PatientReferralResultDetail result={result} />
    </div>
  );
}
