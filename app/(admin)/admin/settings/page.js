import PageHeader from "@/components/shared/PageHeader";
import AccountSettings from "@/features/care/components/AccountSettings";
import { getAccountSettings, requireCareUser } from "@/features/care/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "پروفایل و تنظیمات مدیر" };

export default async function AdminSettingsPage() {
  await requireCareUser("admin");
  const data = await getAccountSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="پروفایل و تنظیمات حساب مدیر"
        description="نام و اطلاعات هویتی حساب مدیریتی را مدیریت کنید. تغییر شماره همراه و شناسه ملی پس از بررسی انجام می‌شود."
      />
      <AccountSettings data={data} />
    </div>
  );
}
