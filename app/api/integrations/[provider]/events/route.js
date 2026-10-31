import { createHash } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRIDGE_PROVIDERS, verifyBridgeSignature, readBridgeBody } from "@/lib/integrations/bridge";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const eventSchema = z.object({
  event_id: z.uuid(), version: z.number().int().positive(),
  external_record_id: z.string().min(1).max(150),
  patient_national_id: z.string().regex(/^\d{10}$/),
  resource_kind: z.enum(["prescription", "lab_result", "imaging", "ecg", "visit", "other"]),
  title: z.string().min(1).max(200),
  summary: z.string().max(16000).nullable().optional(),
  occurred_at: z.iso.datetime({ offset: true }),
  clinical_data: z.record(z.string(), z.unknown()).optional(),
}).strict();
const reply = (body, status) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function POST(request, { params }) {
  const { provider } = await params;
  const key = BRIDGE_PROVIDERS[provider];
  if (!key) return reply({ error: "UNKNOWN_PROVIDER" }, 404);
  const secret = process.env[key];
  if (!secret || secret.length < 32) return reply({ error: "INTEGRATION_NOT_CONFIGURED" }, 503);
  let raw;
  try { raw = await readBridgeBody(request); }
  catch { return reply({ error: "INVALID_BODY" }, 413); }
  if (!verifyBridgeSignature({ raw, secret, timestamp: request.headers.get("x-pas-timestamp"), signature: request.headers.get("x-pas-signature") })) return reply({ error: "INVALID_SIGNATURE" }, 401);
  let parsed;
  try { parsed = eventSchema.safeParse(JSON.parse(raw)); }
  catch { return reply({ error: "INVALID_EVENT" }, 400); }
  if (!parsed.success) return reply({ error: "INVALID_EVENT" }, 400);
  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc("pas_ingest_external_event", {
      p_provider: provider, p_event: parsed.data,
      p_hash: createHash("sha256").update(raw).digest("hex"),
    });
    if (error) {
      console.error("[integration ingest]", { provider, code: error.code });
      return reply({ error: "EVENT_NOT_ACCEPTED" }, error.code === "23505" ? 409 : 422);
    }
    return reply({ ok: true, ...data }, 200);
  } catch { return reply({ error: "INTEGRATION_UNAVAILABLE" }, 503); }
}
