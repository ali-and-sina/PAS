import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSameOrigin } from "@/lib/security/request-origin";

export async function POST(request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "درخواست خروج نامعتبر است." }, { status: 403 });
  }
  const supabase = await createClient();
  await supabase.auth.signOut();

  const { origin } = new URL(request.headers.get("origin"));
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
