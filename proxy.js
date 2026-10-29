import { updateSession } from "@/lib/supabase/proxy";
import { buildContentSecurityPolicy } from "@/lib/security/csp";

/** Refresh the Supabase session before server-rendered routes read it. */
export async function proxy(request) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = buildContentSecurityPolicy({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    development: process.env.NODE_ENV === "development",
  });
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", policy);
  const { response } = await updateSession(request);
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
