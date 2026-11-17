import PageHeader from "@/components/shared/PageHeader";
import AccountSettings from "@/features/care/components/AccountSettings";
import { getAccountSettings } from "@/features/care/queries";
import { getCenterPatientRequestPolicies, requireCenter } from "@/features/centers/queries";
import CenterRequestPolicySettings from "@/features/centers/components/CenterRequestPolicySettings";

export const dynamic = "force-dynamic";
export const metadata = { title: "مشخصات و تنظیمات مرکز درمانی" };

export default async function Settings({ params }) {
  const { type } = await params;
  await requireCenter(type);
  const [accountData, policyData] = await Promise.all([
    getAccountSettings(),
    getCenterPatientRequestPolicies(type),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="مشخصات و تنظیمات مرکز درمانی"
        description="اطلاعات حساب مسئول مرکز و تنظیمات پذیرش درخواست‌های مستقیم بیمار را مدیریت کنید."
      />
      <CenterRequestPolicySettings centerType={type} items={policyData.items} />
      <AccountSettings data={accountData} />
    </div>
  );
}
