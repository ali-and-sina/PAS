import { notFound, redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/server";
import { getPhysicianPatientSnapshot } from "@/features/physician-care/queries";
import PatientSnapshot from "@/features/physician-care/components/PatientSnapshot";

export const metadata = { title: "پرونده بیمار" };
export const dynamic = "force-dynamic";

export default async function DoctorPatientDetailPage({ params }) {
  const { patientId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "doctor" || user.is_verified !== true) redirect("/doctor/dashboard");

  const data = await getPhysicianPatientSnapshot(patientId);
  if (!data) notFound();

  return <PatientSnapshot data={data} />;
}
