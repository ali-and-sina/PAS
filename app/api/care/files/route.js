import { getSessionUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export async function GET(request) {
  const user = await getSessionUser();
  if (!user?.id) return new Response(null, { status: 401 });
  const url = new URL(request.url);
  const bucket = url.searchParams.get("bucket");
  const path = url.searchParams.get("path");
  if (!["pas-consultations", "pas-medical-documents"].includes(bucket) || typeof path !== "string" ||
      !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webm|ogg|mp3|m4a|pdf|png|jpe?g)$/.test(path)) return new Response(null, { status: 404 });
  const db = await createClient();
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 120, {
    ...(bucket === "pas-medical-documents" ? { download: true } : {}),
  });
  if (error || !data?.signedUrl) return new Response(null, { status: 404 });
  return new Response(null, { status: 302, headers: { Location: data.signedUrl, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
