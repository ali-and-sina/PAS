import PageHeader from "@/components/shared/PageHeader";
import MedicalCentersWorkspace from "@/features/care/components/MedicalCentersWorkspace";
import { getMedicalServicesData } from "@/features/care/queries";
import { getPatientLabRequests } from "@/features/lab-order-requests/queries";
import { searchLaboratoryBranches } from "@/features/laboratory-directory/queries";
import { getPatientResults } from "@/features/patient/queries";

const HUB_PAGE_SIZE = 10;

export const dynamic = "force-dynamic";
export const metadata = { title: "مراکز درمانی" };

export default async function PatientMedicalCentersPage({ searchParams }) {
  const params = await searchParams;
  const [medicalData, labRequests, labResults, branches] = await Promise.all([
    getMedicalServicesData("patient"),
    getPatientLabRequests({ page: params?.labRequestsPage ?? 1, pageSize: HUB_PAGE_SIZE }),
    getPatientResults({ page: params?.labResultsPage ?? 1, pageSize: HUB_PAGE_SIZE }),
    searchLaboratoryBranches({ limit: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="مراکز درمانی"
        description="درخواست‌ها و گزارش‌های آزمایش، تصویربرداری و دیگر خدمات درمانی را در یک بخش پیگیری کنید."
      />
      <MedicalCentersWorkspace
        role="patient"
        medicalData={medicalData}
        labRequests={labRequests}
        labResults={labResults}
        branches={branches}
      />
    </div>
  );
}
