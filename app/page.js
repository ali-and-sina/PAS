import { redirect } from "next/navigation";
import { getPostLoginRedirect, isValidRole, LOGIN_PATH } from "@/lib/auth";
import { getSessionUser } from "@/lib/auth/server";

export default async function Page() {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !isValidRole(sessionUser.role)) {
    redirect(LOGIN_PATH);
  }

  redirect(getPostLoginRedirect(sessionUser));
}
