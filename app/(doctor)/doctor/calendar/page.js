import RecordAccessNotice from "@/components/care/RecordAccessNotice";
import PageHeader from "@/components/shared/PageHeader";
import CareProgress from "@/components/care/CareProgress";
import { HealthCalendar } from "@/components/care/JalaliCalendar";
import { requireCareUser, getCareOverview } from "@/features/care/queries";
import { getDoctorPatients } from "@/features/patients/queries";
import DoctorCalendarPatientPicker from "@/features/patients/components/DoctorCalendarPatientPicker";

export const dynamic = "force-dynamic";
export const metadata = { title: "تقویم بیماران" };

export default async function DoctorCalendarPage({ searchParams }) {
  const user = await requireCareUser("doctor");
  if (user.is_verified !== true) {
    return <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">حساب پزشک هنوز تأیید نشده است.</p>;
  }

  const patients = await getDoctorPatients(user.id);
  const params = await searchParams;
  const requestedPatientId = typeof params?.patientId === "string" ? params.patientId : null;
  const selectedPatient = patients.find((patient) => patient.id === requestedPatientId) || patients[0] || null;
  const overview = selectedPatient ? await getCareOverview(selectedPatient.id) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="تقویم شمسی بیماران" description="رویدادها و پیگیری‌های پروندهٔ بیمار را در تقویم یا فهرست زمانی ببینید." />
      <DoctorCalendarPatientPicker selectedPatientName={selectedPatient?.full_name || ""} />
      {overview ? (
        <>
          <RecordAccessNotice scopes={overview.accessScopes} />
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(16.25rem,.8fr)_minmax(0,1.2fr)]">
            <CareProgress progress={overview.progress} />
            <HealthCalendar patientId={selectedPatient.id} initialMonth={overview.month} initialEvents={overview.events} today={overview.today} />
          </div>
        </>
      ) : (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          بیمار مرتبطی برای نمایش وجود ندارد. با جست‌وجوی بالا، یکی از بیماران دارای رابطهٔ فعال را پیدا کنید.
        </p>
      )}
    </div>
  );
}
