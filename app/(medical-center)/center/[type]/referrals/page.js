import ProviderReferralSectionNav from "@/features/insurance-prescriptions/components/ProviderReferralSectionNav";
import ProviderReferralWorkspace from "@/features/insurance-prescriptions/components/ProviderReferralWorkspace";
import { getCenterProviderReferrals } from "@/features/insurance-prescriptions/queries";

export const dynamic = "force-dynamic";

export default async function CenterReferralsPage({ params, searchParams }) {
  const { type } = await params;
  const filters = await searchParams;
  const requested = typeof filters?.status === "string" ? filters.status : "all";
  const data = await getCenterProviderReferrals(type, { status: requested === "all" ? null : requested, page: filters?.page ?? 1 });
  return <div className="space-y-5"><ProviderReferralSectionNav type={type} active="insurance" /><ProviderReferralWorkspace type={type} data={data} status={requested} /></div>;
}
