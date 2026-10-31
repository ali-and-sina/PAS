import { redirect } from "next/navigation";
import { requireCenter } from "@/features/centers/queries";
import AppShell from "@/components/layout/AppShell";
import { getSessionUser } from "@/lib/auth/server";
import { LOGIN_PATH, ROLES, getRoleHome } from "@/lib/auth";

export default async function LaboratoryLayout({ children }) {
  const user = await getSessionUser();

  if (!user) redirect(LOGIN_PATH);
  if (user.role !== ROLES.LABORATORY) redirect(getRoleHome(user.role));

  await requireCenter("laboratory");
  return <AppShell user={user}>{children}</AppShell>;
}
