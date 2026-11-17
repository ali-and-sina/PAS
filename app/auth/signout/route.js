import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSameOrigin } from "@/lib/security/request-origin";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "Referrer-Policy": "no-referrer",
};

export async function POST(request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json(
      { error: "درخواست خروج نامعتبر است." },
      { status: 403, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
  const supabase = await createClient();
  await supabase.auth.signOut();

  const { origin } = new URL(request.headers.get("origin"));
  const response = NextResponse.redirect(`${origin}/login`, { status: 303 });
  for (const [name, value] of Object.entries(PRIVATE_NO_STORE_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}
