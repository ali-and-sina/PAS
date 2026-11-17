import PageHeader from "@/components/shared/PageHeader";
import InsuranceAdminWorkspace from "@/features/insurance-prescriptions/components/InsuranceAdminWorkspace";
import { getAdminInsuranceWorkspace } from "@/features/insurance-prescriptions/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "نسخه‌های بیمه‌ای و ارجاع" };

export default async function AdminInsurancePrescriptionsPage({
  searchParams,
}) {
  const params = await searchParams;
  const page = Math.min(
    500,
    Math.max(1, Number.parseInt(params?.page, 10) || 1),
  );
  const allowedTabs = new Set([
    "identity",
    "routing",
    "mapping",
    "providers",
    "capacity",
  ]);
  const activeTab = allowedTabs.has(params?.tab) ? params.tab : "identity";
  const data = await getAdminInsuranceWorkspace({ page });

  return (
    <div className="space-y-6">
      <PageHeader
        title="نسخه‌های بیمه‌ای و ارجاع"
        description="بازبینی هویت بیمار، نگاشت کدهای بیمه و تقسیم نسخه بین مراکز درمانی و داروخانه‌ها."
      />
      <InsuranceAdminWorkspace data={data} activeTab={activeTab} />
    </div>
  );
}
