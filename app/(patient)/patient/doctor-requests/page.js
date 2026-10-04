import { redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import DoctorRequestList from "@/features/patient-doctor-requests/components/DoctorRequestList";
import {
  acceptDoctorRequest,
  rejectDoctorRequest,
} from "@/features/patient-doctor-requests/actions";
import { getPatientDoctorRequests } from "@/features/patient-doctor-requests/queries";
import { getSessionUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "درخواست‌های پزشکان",
};

export default async function PatientDoctorRequestsPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "patient") {
    redirect("/login");
  }

  const requests = await getPatientDoctorRequests(user.id);

  return (
    <>
      <PageHeader
        title="درخواست‌های پزشکان"
        description="درخواست‌های برقراری ارتباط با پرونده پزشکی شما را بررسی و مدیریت کنید."
      />

      <DoctorRequestList
        requests={requests}
        acceptAction={acceptDoctorRequest}
        rejectAction={rejectDoctorRequest}
      />
    </>
  );
}
