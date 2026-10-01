import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { getPostLoginRedirect, ROLES, sanitizeNext } from "@/lib/auth";
import LoginCard from "@/components/auth/LoginCard";

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
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center px-4 py-12"
    >
      <LoginCard
        fixedRole={ROLES.ADMIN}
        next={sanitizeNext(next)}
        isDevelopmentAuth={process.env.NODE_ENV !== "production"}
      />
    </main>
  );
}
