import PageHeader from "@/components/shared/PageHeader";
import PharmacyBoard from "@/features/care/components/PharmacyBoard";
import {getPharmacyRequests} from "@/features/care/queries";
import {getPatientPrescriptions} from "@/features/prescriptions/queries";
export const dynamic="force-dynamic";
export const metadata={title:"تهیه و ارسال دارو"};
export default async function PharmacyPage(){
 const data=await getPharmacyRequests("admin");
 const result=data.user.role==="patient"?await getPatientPrescriptions({pageSize:50}):{items:[]};
 return <div className="space-y-6"><PageHeader title="تهیه و ارسال دارو" description="ثبت درخواست تهیهٔ نسخه و پیگیری هماهنگی داروخانه تا تحویل."/><PharmacyBoard data={data} availablePrescriptions={result.items}/></div>
}
