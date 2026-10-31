import PageHeader from "@/components/shared/PageHeader";
import AccountSettings from "@/features/care/components/AccountSettings";
import { getAccountSettings } from "@/features/care/queries";
import { requireCenter } from "@/features/centers/queries";
export const dynamic="force-dynamic";
export const metadata={title:"مشخصات و تنظیمات مرکز درمانی"};
export default async function Settings({params}){const {type}=await params;await requireCenter(type);const data=await getAccountSettings();return <div className="space-y-6"><PageHeader title="مشخصات و تنظیمات مرکز درمانی" description="اطلاعات حساب مسئول مرکز و هویت مجاز مرکز را مدیریت کنید." /><AccountSettings data={data} /></div>;}
