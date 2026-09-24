import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { getSessionUser } from "@/lib/auth/server";
import {
  LOGIN_PATH,
  PENDING_VERIFICATION_PATH,
  ROLES,
  getRoleHome,
} from "@/lib/auth";

export default async function DoctorLayout({ children }) {
  const user = await getSessionUser();

  if (!user) redirect(LOGIN_PATH);
  if (user.role !== ROLES.DOCTOR) redirect(getRoleHome(user.role));
  if (user.is_verified === false) redirect(PENDING_VERIFICATION_PATH);

  return <AppShell user={user}>{children}</AppShell>;
}
