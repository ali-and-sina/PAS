import PageHeader from "@/components/shared/PageHeader";
import AccountSettings from "@/features/care/components/AccountSettings";
import { getAccountSettings, requireCareUser } from "@/features/care/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "مشخصات و تنظیمات مرکز درمانی" };

export default async function SettingsPage() {
  await requireCareUser("laboratory");
  const data = await getAccountSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="مشخصات و تنظیمات مرکز درمانی"
        description="اطلاعات حساب مسئول مرکز و مشخصات هویتی مرکز را مشاهده و مدیریت کنید."
      />
      <AccountSettings data={data} />
    </div>
  );
}
