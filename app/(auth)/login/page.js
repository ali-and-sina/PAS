import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { getPostLoginRedirect, isValidRole, sanitizeNext } from "@/lib/auth";
import LoginCard from "@/components/auth/LoginCard";

export const metadata = {
  title: "ورود",
};

export default async function LoginPage({ searchParams }) {
  const sessionUser = await getSessionUser();

  // A session without a valid role must not redirect (would loop back here).
  if (sessionUser && isValidRole(sessionUser.role)) {
    redirect(getPostLoginRedirect(sessionUser));
  }

  const { next } = await searchParams;

  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center px-4 py-12"
    >
      <LoginCard
        next={sanitizeNext(next)}
        isDevelopmentAuth={process.env.NODE_ENV !== "production"}
      />
    </main>
  );
}
