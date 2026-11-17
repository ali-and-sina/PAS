import { notFound } from "next/navigation";
import PageHeader from "@/components/shared/PageHeader";
import { getDoctorInsuranceReferralResultDetail } from "@/features/insurance-prescriptions/queries";
import { PatientReferralResultDetail } from "@/features/insurance-prescriptions/components/PatientReferralResults";

export const dynamic = "force-dynamic";
export const metadata = { title: "نتیجهٔ خدمت بیمه‌ای" };

export default async function DoctorInsuranceResultPage({ params }) {
  const { resultId } = await params;
  const result = await getDoctorInsuranceReferralResultDetail(resultId);
  if (!result) notFound();

  return (
    <div className="space-y-5">
      <PageHeader
        title="نتیجهٔ خدمت بیمه‌ای"
        description="این نتیجه بر اساس رابطهٔ فعال پزشک با بیمار و دامنهٔ مجاز پرونده نمایش داده شده است."
      />
      <PatientReferralResultDetail result={result} />
    </div>
  );
}
