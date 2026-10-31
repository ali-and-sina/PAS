import { redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import MedicalCentersWorkspace from "@/features/care/components/MedicalCentersWorkspace";
import { getMedicalServicesData } from "@/features/care/queries";
import { getDoctorPatients } from "@/features/patients/queries";
import { getDoctorLabRequests } from "@/features/lab-order-requests/queries";
import {
  getDoctorLabOrders,
  getDoctorReviewableReports,
  getTestDefinitions,
  getTestPanels,
} from "@/features/lab-orders/queries";
import { getSessionUser } from "@/lib/auth/server";
import { tehranDayKey } from "@/lib/care/dates";

const HUB_PAGE_SIZE = 10;

export const dynamic = "force-dynamic";
export const metadata = { title: "مراکز درمانی" };

export default async function DoctorMedicalCentersPage({ searchParams }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const [patients, medicalData, labRequests, labOrders, labResults, testPanels, testDefinitions] = await Promise.all([
    getDoctorPatients(user.id),
    getMedicalServicesData("doctor"),
    getDoctorLabRequests({ page: params?.labRequestsPage ?? 1, pageSize: HUB_PAGE_SIZE }),
    getDoctorLabOrders(user.id, null, { page: params?.labOrdersPage ?? 1, pageSize: HUB_PAGE_SIZE }),
    getDoctorReviewableReports(user.id),
    getTestPanels(),
    getTestDefinitions(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="مراکز درمانی"
        description="برای بیماران درخواست تصویربرداری، آزمایش و دیگر خدمات تخصصی و درمانی ثبت کنید و وضعیت پذیرش و گزارش‌ها را دنبال کنید."
      />
      <MedicalCentersWorkspace
        role="doctor"
        medicalData={medicalData}
        patients={patients}
        labRequests={labRequests}
        labOrders={labOrders}
        labResults={labResults}
        testPanels={testPanels}
        testDefinitions={testDefinitions}
        today={tehranDayKey()}
        defaultPatientId={typeof params?.patient === "string" && patients.some((patient) => patient.id === params.patient) ? params.patient : ""}
      />
    </div>
  );
}
