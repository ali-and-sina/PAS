import { getCareOverview } from "@/features/care/queries";
import { notFound, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/server";
import { getPhysicianPatientSnapshot } from "@/features/physician-care/queries";
import PatientSnapshot from "@/features/physician-care/components/PatientSnapshot";
import { getDoctorPatientInsurancePrescriptions } from "@/features/insurance-prescriptions/queries";

export const metadata = { title: "پرونده بیمار" };
export const dynamic = "force-dynamic";

export default async function DoctorPatientDetailPage({
  params,
  searchParams,
}) {
  const { patientId } = await params;
  const query = await searchParams;
  const insuranceOffset = Math.min(
    Math.max(Number.parseInt(query?.insuranceOffset, 10) || 0, 0),
    10000,
  );
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "doctor" || user.is_verified !== true)
    redirect("/doctor/dashboard");

  const data = await getPhysicianPatientSnapshot(patientId);
  if (!data) notFound();

  const [overview, insurancePrescriptions] = await Promise.all([
    getCareOverview(patientId),
    getDoctorPatientInsurancePrescriptions(patientId, {
      limit: 10,
      offset: insuranceOffset,
    }),
  ]);
  return (
    <PatientSnapshot
      data={data}
      overview={overview}
      insurancePrescriptions={insurancePrescriptions}
      patientId={patientId}
    />
  );
}
