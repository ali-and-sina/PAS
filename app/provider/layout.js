import AppShell from "@/components/layout/AppShell";
import { getGenericProviderWorkspaceUser } from "@/features/insurance-prescriptions/queries";

export const dynamic = "force-dynamic";

export default async function ProviderWorkspaceLayout({ children }) {
  const user = await getGenericProviderWorkspaceUser();
  return <AppShell user={user}>{children}</AppShell>;
}
