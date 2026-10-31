import PageHeader from "@/components/shared/PageHeader";
import AccountSettings from "@/features/care/components/AccountSettings";
import { getAccountSettings, requireCareUser } from "@/features/care/queries";
export const dynamic = "force-dynamic";
export const metadata = { title: "تنظیمات حساب" };
export default async function SettingsPage() {
  await requireCareUser("patient");
  const data = await getAccountSettings();
  return <div className="space-y-6"><PageHeader title="تنظیمات حساب کاربری" description="اطلاعات شخصی و راه‌های ارتباطی حساب خود را مدیریت کنید." /><AccountSettings data={data} /></div>;
}
