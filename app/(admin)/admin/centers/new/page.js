import PageHeader from "@/components/shared/PageHeader";
import CenterRegistration from "@/features/centers/components/CenterRegistration";
import { CENTER_TYPES } from "@/lib/centers/config";
export const metadata={title:"ایجاد مرکز درمانی"};
export default async function NewCenterPage({searchParams}) { const {type}=await searchParams; return <div className="space-y-6"><PageHeader title="ایجاد مرکز درمانی" description="حساب، نوع مرکز و دسترسی پنل را در یک مرحله تعیین کنید." /><CenterRegistration defaultType={CENTER_TYPES[type]?type:"laboratory"} /></div>; }
