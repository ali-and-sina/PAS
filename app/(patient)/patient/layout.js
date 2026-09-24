import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { getSessionUser } from "@/lib/auth/server";
import { LOGIN_PATH, ROLES, getRoleHome } from "@/lib/auth";

export default async function PatientLayout({ children }) {
  const user = await getSessionUser();

  if (!user) redirect(LOGIN_PATH);
  if (user.role !== ROLES.PATIENT) redirect(getRoleHome(user.role));

  return <AppShell user={user}>{children}</AppShell>;
}
