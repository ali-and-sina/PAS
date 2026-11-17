import { createHash } from "node:crypto";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { hasSameOrigin } from "@/lib/security/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,64}$/) }).strict();
const reply = (body, status) => Response.json(body, {
  status,
  headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
});

export async function POST(request) {
  if (!hasSameOrigin(request)) return reply({ error: "INVALID_ORIGIN" }, 403);
  const user = await getSessionUser();
  if (!user?.id) return reply({ error: "UNAUTHENTICATED" }, 401);

  let input;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return reply({ error: "INVALID_QR_TOKEN" }, 400);
    input = parsed.data;
  } catch {
    return reply({ error: "INVALID_JSON" }, 400);
  }

  const tokenHash = createHash("sha256").update(input.token, "utf8").digest("hex");
  const db = await createClient();
  const { data, error } = await db.rpc("pas_resolve_referral_qr_token", { p_token_hash: tokenHash });
  if (error || !data) {
    if (error?.code === "42501") return reply({ error: "QR_INVALID_OR_FORBIDDEN" }, 403);
    console.error("[provider referral QR resolve]", { code: error?.code });
    return reply({ error: "QR_RESOLUTION_FAILED" }, 422);
  }
  return reply({ ok: true, ...data }, 200);
}
