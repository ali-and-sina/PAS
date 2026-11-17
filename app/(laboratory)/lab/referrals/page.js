import ProviderReferralSectionNav from "@/features/insurance-prescriptions/components/ProviderReferralSectionNav";
import ProviderReferralWorkspace from "@/features/insurance-prescriptions/components/ProviderReferralWorkspace";
import { getCenterProviderReferrals } from "@/features/insurance-prescriptions/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "ارجاع‌های بیمه‌ای" };

export default async function LaboratoryReferralsPage({ searchParams }) {
  const filters = await searchParams;
  const requested = typeof filters?.status === "string" ? filters.status : "all";
  const data = await getCenterProviderReferrals("laboratory", { status: requested === "all" ? null : requested, page: filters?.page ?? 1 });
  return <div className="space-y-5"><ProviderReferralSectionNav type="laboratory" active="insurance" /><ProviderReferralWorkspace type="laboratory" data={data} status={requested} /></div>;
}
