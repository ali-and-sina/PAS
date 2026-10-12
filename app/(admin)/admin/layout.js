import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { getSessionUser } from "@/lib/auth/server";
import { ROLES, getRoleHome } from "@/lib/auth";

export const metadata = {
  title: {
    default: "مدیریت | پاس",
    template: "%s | پاس",
  },
};

export default async function AdminLayout({ children }) {
  const user = await getSessionUser();

  if (!user) redirect("/admin/login");
  if (user.role !== ROLES.ADMIN) redirect(getRoleHome(user.role));

  return <AppShell user={user}>{children}</AppShell>;
}
