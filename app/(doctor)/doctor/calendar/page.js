import RecordAccessNotice from "@/components/care/RecordAccessNotice";
import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";
import CareProgress from "@/components/care/CareProgress";
import { HealthCalendar } from "@/components/care/JalaliCalendar";
import { requireCareUser,getCareOverview } from "@/features/care/queries";
import { getDoctorPatients } from "@/features/patients/queries";
export const dynamic="force-dynamic";
export const metadata={title:"تقویم بیماران"};
export default async function DoctorCalendarPage({searchParams}) {
 const user=await requireCareUser("doctor");
 const patients=await getDoctorPatients(user.id);
 const params=await searchParams;
 const patient=patients.find(p=>p.id===params?.patientId)||patients[0];
 const overview=patient?await getCareOverview(patient.id):null;
 return <div className="space-y-6"><PageHeader title="تقویم شمسی بیماران" description="رویدادها و پیگیری‌های پرونده، مطابق مجوز بیمار." /><details key={patient?.id} className="rounded-xl border bg-card p-4"><summary className="min-h-8 cursor-pointer text-sm font-semibold">بیمار: {patient?.full_name || "انتخاب بیمار"}</summary><nav aria-label="انتخاب بیمار" className="mt-3 flex max-h-60 flex-wrap gap-2 overflow-y-auto">{patients.map(p=><Link key={p.id} href={"/doctor/calendar?patientId="+p.id} aria-current={patient?.id===p.id?"page":undefined} className={"inline-flex min-h-11 items-center rounded-xl border px-4 text-sm "+(patient?.id===p.id?"border-primary bg-primary/5":"bg-card")}>{p.full_name||"بیمار"}</Link>)}</nav></details>{overview?<><RecordAccessNotice scopes={overview.accessScopes}/><div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(260px,.8fr)_minmax(0,1.2fr)]"><CareProgress progress={overview.progress}/><HealthCalendar patientId={patient.id} initialMonth={overview.month} initialEvents={overview.events} today={overview.today}/></div></>:<p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">بیمار مرتبطی برای نمایش وجود ندارد.</p>}</div>;
}
