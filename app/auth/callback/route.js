import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginRedirect, LOGIN_PATH } from "@/lib/auth";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}${LOGIN_PATH}?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("OAuth callback error:", error);

    return NextResponse.redirect(
      `${origin}${LOGIN_PATH}?error=${encodeURIComponent(error.message)}`,
    );
  }

  if (next) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}${LOGIN_PATH}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      `
      role,
      doctor_profiles (is_verified)
    `,
    )
    .eq("id", user.id)
    .single();

  const redirectTo = getPostLoginRedirect({
    role: profile?.role,
    is_verified: profile?.doctor_profiles?.is_verified,
  });

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
