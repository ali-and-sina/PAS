import { createAdminClient } from "@/lib/supabase/admin";
import { readBridgeBody, verifyBridgeSignature } from "@/lib/integrations/bridge";
import { insurancePrescriptionEventSchema } from "@/lib/integrations/insurance";
import { getInsuranceSecret, hashRawPayload } from "@/lib/integrations/integration-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (body, status) => Response.json(body, {
  status,
  headers: {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  },
});

export async function POST(request, { params }) {
  const { payer } = await params;
  const secret = getInsuranceSecret(payer);
  if (!secret) return reply({ error: "INSURANCE_INTEGRATION_NOT_CONFIGURED" }, 503);

  let raw;
  try {
    raw = await readBridgeBody(request, 524288);
  } catch {
    return reply({ error: "INVALID_BODY" }, 413);
  }

  const signed = verifyBridgeSignature({
    raw,
    secret,
    timestamp: request.headers.get("x-pas-timestamp"),
    signature: request.headers.get("x-pas-signature"),
  });
  if (!signed) return reply({ error: "INVALID_SIGNATURE" }, 401);

  let event;
  try {
    const parsed = insurancePrescriptionEventSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return reply({ error: "INVALID_INSURANCE_PRESCRIPTION_EVENT" }, 400);
    event = parsed.data;
  } catch {
    return reply({ error: "INVALID_JSON" }, 400);
  }

  try {
    const db = createAdminClient();
    const { data: connection, error: connectionError } = await db
      .from("pas_integration_connections")
      .select("provider_key,enabled")
      .eq("provider_key", payer)
      .maybeSingle();

    if (connectionError) {
      console.error("[insurance integration config]", { payer, code: connectionError.code });
      return reply({ error: "INTEGRATION_UNAVAILABLE" }, 503);
    }
    if (!connection?.enabled) return reply({ error: "INSURANCE_INTEGRATION_DISABLED" }, 503);

    const { data, error } = await db.rpc("pas_ingest_insurance_prescription", {
      p_payer_key: payer,
      p_event: event,
      p_hash: hashRawPayload(raw),
    });

    if (error) {
      console.error("[insurance prescription ingest]", { payer, code: error.code });
      if (error.code === "23505") return reply({ error: "EVENT_CONFLICT" }, 409);
      if (error.code === "42501") return reply({ error: "INTEGRATION_NOT_AUTHORIZED" }, 403);
      return reply({ error: "PRESCRIPTION_NOT_ACCEPTED" }, 422);
    }

    const status = data?.conflict ? 409 : data?.ignored_old_version ? 202 : 202;
    return reply({ ok: true, ...data }, status);
  } catch (error) {
    console.error("[insurance prescription ingest]", { payer, name: error?.name });
    return reply({ error: "INTEGRATION_UNAVAILABLE" }, 503);
  }
}
