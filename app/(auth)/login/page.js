import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { getPostLoginRedirect, isValidRole, sanitizeNext } from "@/lib/auth";
import LoginCard from "@/components/auth/LoginCard";
import AuthPageShell from "@/components/auth/AuthPageShell";
import { isTestLoginEnabled } from "@/lib/auth/test-session";

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
    <AuthPageShell>
      <LoginCard
        next={sanitizeNext(next)}
        isDevelopmentAuth={process.env.NODE_ENV !== "production"}
        isTestLoginEnabled={isTestLoginEnabled()}
      />
    </AuthPageShell>
  );
}
