import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { hasSameOrigin } from "@/lib/security/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuidSchema = z.uuid();
const reply = (body, status) => Response.json(body, {
  status,
  headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
});

export async function POST(request, { params }) {
  if (!hasSameOrigin(request)) return reply({ error: "INVALID_ORIGIN" }, 403);
  const user = await getSessionUser();
  if (!user?.id) return reply({ error: "UNAUTHENTICATED" }, 401);

  const { referralId } = await params;
  if (!uuidSchema.safeParse(referralId).success) return reply({ error: "NOT_FOUND" }, 404);

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const db = await createClient();
  const { data, error } = await db.rpc("pas_issue_referral_qr_token", {
    p_referral_id: referralId,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
  });

  if (error || !data) {
    if (error?.code === "42501") return reply({ error: "PROVIDER_FORBIDDEN" }, 403);
    console.error("[provider referral QR issue]", { code: error?.code });
    return reply({ error: "QR_ISSUE_FAILED" }, 422);
  }

  // The raw bearer token is disclosed only once, to the authenticated member
  // that just issued it. Only its SHA-256 hash is persisted in Postgres.
  return reply({ ok: true, token, expires_at: expiresAt }, 201);
}

export async function DELETE(request, { params }) {
  if (!hasSameOrigin(request)) return reply({ error: "INVALID_ORIGIN" }, 403);
  const user = await getSessionUser();
  if (!user?.id) return reply({ error: "UNAUTHENTICATED" }, 401);
  const { referralId } = await params;
  if (!uuidSchema.safeParse(referralId).success) return reply({ error: "NOT_FOUND" }, 404);
  const db = await createClient();
  const { data, error } = await db.rpc("pas_revoke_referral_qr_token", { p_referral_id: referralId });
  if (error) {
    if (error.code === "42501") return reply({ error: "PROVIDER_FORBIDDEN" }, 403);
    console.error("[provider referral QR revoke]", { code: error.code });
    return reply({ error: "QR_REVOKE_FAILED" }, 422);
  }
  return reply({ ok: true, revoked_count: data }, 200);
}
