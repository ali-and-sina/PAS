import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBridgeBody, verifyBridgeSignature } from "@/lib/integrations/bridge";
import { hashRawPayload, getProviderSigningSecret } from "@/lib/integrations/integration-security";
import { providerIntegrationEventSchema } from "@/lib/integrations/provider-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidSchema = z.uuid();
const codeSchema = z.string().regex(/^[a-z][a-z0-9_.-]{1,79}$/);
const reply = (body, status) => Response.json(body, {
  status,
  headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
});

export async function POST(request, { params }) {
  const { providerId, integrationCode } = await params;
  if (!uuidSchema.safeParse(providerId).success || !codeSchema.safeParse(integrationCode).success) {
    return reply({ error: "UNKNOWN_INTEGRATION" }, 404);
  }

  let raw;
  try {
    raw = await readBridgeBody(request, 1048576);
  } catch {
    return reply({ error: "INVALID_BODY" }, 413);
  }

  let event;
  try {
    const parsed = providerIntegrationEventSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return reply({ error: "INVALID_PROVIDER_EVENT" }, 400);
    event = parsed.data;
  } catch {
    return reply({ error: "INVALID_JSON" }, 400);
  }

  try {
    const db = createAdminClient();
    const { data: integration, error: integrationError } = await db
      .from("pas_provider_integrations")
      .select("id,provider_id,integration_code,integration_mode,status,signing_key_reference")
      .eq("provider_id", providerId)
      .eq("integration_code", integrationCode)
      .maybeSingle();

    if (integrationError) {
      console.error("[provider integration lookup]", { providerId, integrationCode, code: integrationError.code });
      return reply({ error: "INTEGRATION_UNAVAILABLE" }, 503);
    }
    if (!integration || integration.status !== "active" || !["webhook", "rest_api"].includes(integration.integration_mode)) {
      return reply({ error: "INTEGRATION_NOT_ACTIVE" }, 404);
    }

    const secret = getProviderSigningSecret(integration.signing_key_reference);
    if (!secret) return reply({ error: "INTEGRATION_SECRET_NOT_CONFIGURED" }, 503);
    if (!verifyBridgeSignature({
      raw,
      secret,
      timestamp: request.headers.get("x-pas-timestamp"),
      signature: request.headers.get("x-pas-signature"),
    })) return reply({ error: "INVALID_SIGNATURE" }, 401);

    const common = {
      p_provider_id: providerId,
      p_integration_code: integrationCode,
      p_external_event_id: event.event_id,
      p_source_version: event.source_version,
      p_provider_sequence: event.provider_sequence ?? null,
      p_payload_hash: hashRawPayload(raw),
    };

    const { event_id: _eventId, event_type: eventType, source_version: _version, provider_sequence: _sequence, ...rawPayload } = event;
    const isResult = eventType === "result.submitted";
    const { data, error } = isResult
      ? await db.rpc("pas_ingest_provider_result", {
          ...common,
          p_event_type: eventType,
          p_raw_payload: rawPayload,
        })
      : await db.rpc("pas_ingest_provider_lifecycle_event", {
          ...common,
          p_event_type: eventType,
          p_raw_payload: rawPayload,
        });

    if (error) {
      console.error("[provider integration ingest]", { providerId, integrationCode, eventType, code: error.code });
      if (error.code === "23505") return reply({ error: "EVENT_CONFLICT" }, 409);
      if (error.code === "42501") return reply({ error: "EVENT_NOT_AUTHORIZED" }, 403);
      return reply({ error: "EVENT_NOT_ACCEPTED" }, 422);
    }

    if (data?.processing_status === "retryable") return reply({ ok: false, ...data }, 503);
    if (data?.processing_status === "failed") return reply({ ok: false, ...data }, 422);
    if (data?.processing_status === "ignored" || data?.ignored_out_of_order) return reply({ ok: true, ...data }, 202);
    return reply({ ok: true, ...data }, 200);
  } catch (error) {
    console.error("[provider integration ingest]", { providerId, integrationCode, name: error?.name });
    return reply({ error: "INTEGRATION_UNAVAILABLE" }, 503);
  }
}
