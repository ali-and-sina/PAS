import MedicationCard from "@/features/care/components/MedicationCard";
import {tehranDayKey} from "@/lib/care/dates";
import Link from "next/link";
import { redirect } from "next/navigation";

import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import SectionCard from "@/components/shared/SectionCard";
import Pagination from "@/components/shared/Pagination";
import PrescriptionForm from "@/features/prescriptions/components/PrescriptionForm";
import { getSessionUser } from "@/lib/auth/server";
import { getDoctorPrescriptions } from "@/features/prescriptions/queries";
import { getDoctorPatients } from "@/features/patients/queries";

export const metadata = { title: "نسخه‌ها" };
export const dynamic = "force-dynamic";

export default async function DoctorPrescriptionsPage({ searchParams }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const [prescriptionResult, patients] = await Promise.all([
    getDoctorPrescriptions(user.id, { page: params?.page ?? 1 }),
    getDoctorPatients(user.id),
  ]);
  const prescriptions = prescriptionResult.items;
  const selectedPatient = patients.find((patient) => patient.id === params?.patientId);

  return (
    <>
      <PageHeader
        title="نسخه‌ها"
        description="نسخه‌های صادرشده و ثبت نسخه جدید برای بیماران مرتبط."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)]">
        <SectionCard title="نسخه‌های ثبت‌شده">
          {prescriptions.length ? (
            <div className="space-y-3">
              {prescriptions.map((prescription) => <MedicationCard key={prescription.id} prescription={prescription} now={new Date().toISOString()} today={tehranDayKey()} />)}
            </div>
          ) : (
            <EmptyState
              title="هنوز نسخه‌ای صادر نشده است."
              description="نسخه‌های ثبت‌شده برای بیماران شما اینجا نمایش داده می‌شوند."
            />
          )}
          <Pagination
            pathname="/doctor/prescriptions"
            page={prescriptionResult.pagination.page}
            pageSize={prescriptionResult.pagination.pageSize}
            totalCount={prescriptionResult.pagination.totalCount}
            totalPages={prescriptionResult.pagination.totalPages}
            query={{ patientId: params?.patientId }}
          />
        </SectionCard>

        <SectionCard title="ثبت نسخه جدید" description="هر نسخه ابتدا به بیمار مرتبط می‌شود.">
          {selectedPatient ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                بیمار انتخاب‌شده: <span className="font-medium text-foreground">{selectedPatient.full_name || "بدون نام"}</span>
              </p>
              <PrescriptionForm patientId={selectedPatient.id} />
            </>
          ) : patients.length ? (
            <div className="space-y-2">
              {patients.map((patient) => (
                <Link
                  key={patient.id}
                  href={`/doctor/prescriptions?patientId=${patient.id}`}
                  className="block rounded-lg border p-3 text-sm hover:bg-muted/40"
                >
                  {patient.full_name || "بدون نام"}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">ابتدا یک بیمار به فهرست خود اضافه کنید.</p>
          )}
        </SectionCard>
      </div>
    </>
  );
}
