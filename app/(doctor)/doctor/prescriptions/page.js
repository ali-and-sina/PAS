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

const PRESCRIPTION_STATUS_LABELS = {
  active: "فعال",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
  draft: "پیش‌نویس",
};

function formatDate(value) {
  return value
    ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(value))
    : "—";
}

function getStatusLabel(status) {
  return PRESCRIPTION_STATUS_LABELS[status] || "نامشخص";
}

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
              {prescriptions.map((prescription) => (
                <article key={prescription.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Link
                        href={`/doctor/patients/${prescription.patient_id}`}
                        className="font-medium hover:underline"
                      >
                        {prescription.patient_name}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(prescription.issued_at)} · {getStatusLabel(prescription.status)}
                      </p>
                    </div>
                    <span className="text-sm">{prescription.items.length} قلم</span>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm">
                    {prescription.items.map((item) => (
                      <li key={item.id} className="rounded-md bg-muted/40 p-3">
                        <span className="font-medium">{item.medication_name}</span>
                        <span className="mr-2 text-muted-foreground">
                          {item.dosage} · {item.frequency}
                        </span>
                        {item.duration ? (
                          <span className="mr-2 text-muted-foreground">· {item.duration}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
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
