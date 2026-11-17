import ProviderReferralWorkspace from "@/features/insurance-prescriptions/components/ProviderReferralWorkspace";
import { getGenericProviderReferrals } from "@/features/insurance-prescriptions/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "ارجاع‌های ارائه‌دهنده خدمت" };

export default async function GenericProviderReferralsPage({ searchParams }) {
  const filters = await searchParams;
  const requested = typeof filters?.status === "string" ? filters.status : "all";
  const data = await getGenericProviderReferrals({
    status: requested === "all" ? null : requested,
    page: filters?.page ?? 1,
  });

  return <ProviderReferralWorkspace scope="provider" data={data} status={requested} />;
}
