import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { getPostLoginRedirect, LOGIN_PATH, resolvePostLoginTarget } from "@/lib/auth";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL(`${LOGIN_PATH}?error=missing_code`, origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Do not echo provider errors or internal error details into public URLs.
    console.error("[auth/callback] Code exchange failed");
    return NextResponse.redirect(new URL(`${LOGIN_PATH}?error=authentication_failed`, origin));
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(new URL(LOGIN_PATH, origin));
  }

  const redirectTo = getPostLoginRedirect(sessionUser);
  const safeTarget = resolvePostLoginTarget({ redirectTo, next });
  return NextResponse.redirect(new URL(safeTarget, origin));
}
