import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { getPostLoginRedirect, ROLES, sanitizeNext } from "@/lib/auth";
import AdminLoginCard from "@/components/auth/AdminLoginCard";
import AuthPageShell from "@/components/auth/AuthPageShell";
import { isAdminTestLoginEnabled } from "@/lib/auth/test-session";

export const metadata = {
  title: "ورود مدیر",
};

/**
 * Hidden admin login. Not linked from the public UI or role picker.
 * Listed as public in proxy.js so an unauthenticated visitor can reach it;
 * every other /admin/* route still requires an authenticated admin.
 */
export default async function AdminLoginPage({ searchParams }) {
  const sessionUser = await getSessionUser();

  if (sessionUser?.role === ROLES.ADMIN) {
    redirect(getPostLoginRedirect(sessionUser));
  }

  const { next } = await searchParams;

  return (
    <AuthPageShell variant="admin">
      <AdminLoginCard
        next={sanitizeNext(next)}
        isTestLoginEnabled={isAdminTestLoginEnabled()}
      />
    </AuthPageShell>
  );
}
