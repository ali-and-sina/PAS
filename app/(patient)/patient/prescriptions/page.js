import PageHeader from "@/components/shared/PageHeader";
import MedicationCard from "@/features/care/components/MedicationCard";
import {getPatientPrescriptions} from "@/features/prescriptions/queries";
import Pagination from "@/components/shared/Pagination";
import {tehranDayKey} from "@/lib/care/dates";
export const dynamic="force-dynamic";
export const metadata={title:"نسخه‌ها و داروها"};
export default async function PatientPrescriptionsPage({searchParams}){
 const params=await searchParams;
 const result=await getPatientPrescriptions({page:params?.page||1});
 const now=new Date().toISOString();
 return <div className="space-y-6"><PageHeader title="نسخه‌ها و داروها" description="دریافت دارو، برنامهٔ مصرف و برآورد پایان موجودی نسخه‌ها."/>{result.items.length?result.items.map(p=><MedicationCard key={p.id} prescription={p} patient now={now} today={tehranDayKey(now)}/>):<p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">نسخه‌ای ثبت نشده است.</p>}<Pagination pathname="/patient/prescriptions" {...result.pagination}/></div>
}
