import PageHeader from "@/components/shared/PageHeader";
import MedicationCard from "@/features/care/components/MedicationCard";
import Pagination from "@/components/shared/Pagination";
import { getPatientPrescriptions } from "@/features/prescriptions/queries";
import { getPatientInsurancePrescriptions } from "@/features/insurance-prescriptions/queries";
import PatientInsurancePrescriptions from "@/features/insurance-prescriptions/components/PatientInsurancePrescriptions";
import { tehranDayKey } from "@/lib/care/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "نسخه‌ها و داروها" };

export default async function PatientPrescriptionsPage({ searchParams }) {
  const params = await searchParams;
  const insuranceOffset = Math.min(
    Math.max(Number.parseInt(params?.insuranceOffset, 10) || 0, 0),
    10000,
  );

  const [result, insurance] = await Promise.all([
    getPatientPrescriptions({ page: params?.page || 1 }),
    getPatientInsurancePrescriptions({ limit: 30, offset: insuranceOffset }),
  ]);

  const now = new Date().toISOString();

  return (
    <div className="space-y-6">
      <PageHeader
        title="نسخه‌ها و داروها"
        description="نسخه‌های ثبت‌شده در پاس و نسخه‌های دریافتی از بیمه‌گر را جداگانه پیگیری کنید."
      />

      <PatientInsurancePrescriptions
        data={insurance}
        internalPage={params?.page || 1}
      />

      <section
        className="space-y-3"
        aria-labelledby="internal-prescriptions-heading"
      >
        <div>
          <h2 id="internal-prescriptions-heading" className="font-semibold">
            نسخه‌های ثبت‌شده در پاس
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            نسخه‌هایی که پزشک در خود پاس ثبت کرده است.
          </p>
        </div>

        {result.items.length ? (
          result.items.map((prescription) => (
            <MedicationCard
              key={prescription.id}
              prescription={prescription}
              patient
              now={now}
              today={tehranDayKey(now)}
            />
          ))
        ) : (
          <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            نسخه‌ای در پاس ثبت نشده است.
          </p>
        )}

        <Pagination
          pathname="/patient/prescriptions"
          query={{
            insuranceOffset: insuranceOffset > 0 ? insuranceOffset : undefined,
          }}
          {...result.pagination}
        />
      </section>
    </div>
  );
}
