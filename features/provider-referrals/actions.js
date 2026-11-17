"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/server";
import { getProviderSigningSecret } from "@/lib/integrations/integration-security";
import { createClient } from "@/lib/supabase/server";
import {
  providerCapabilitySchema,
  providerIntegrationSchema,
  providerMembershipSchema,
} from "./schemas";

export async function upsertProviderMembership(input) {
  await requireAdmin();
  const parsed = providerMembershipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const db = await createClient();
  const { data, error } = await db.rpc("pas_admin_set_provider_membership", {
    p_provider_id: parsed.data.provider_id,
    p_profile_id: parsed.data.profile_id,
    p_role_in_provider: parsed.data.role_in_provider,
    p_status: parsed.data.status,
    p_external_actor_reference: parsed.data.external_actor_reference ?? null,
  });
  if (error) {
    console.error("[provider membership]", { code: error.code });
    return { ok: false, code: error.code === "42501" ? "FORBIDDEN" : "MEMBERSHIP_UPDATE_FAILED" };
  }
  revalidatePath("/admin/integrations");
  return { ok: true, id: data };
}

export async function upsertProviderIntegration(input) {
  await requireAdmin();
  const parsed = providerIntegrationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  if (parsed.data.status === "active" && !getProviderSigningSecret(parsed.data.signing_key_reference)) {
    return { ok: false, code: "PROVIDER_SIGNING_SECRET_NOT_CONFIGURED" };
  }
  const db = await createClient();
  const { data, error } = await db.rpc("pas_admin_upsert_provider_integration", {
    p_provider_id: parsed.data.provider_id,
    p_integration_code: parsed.data.integration_code,
    p_integration_mode: parsed.data.integration_mode,
    p_status: parsed.data.status,
    p_external_provider_id: parsed.data.external_provider_id ?? null,
    p_credential_reference: parsed.data.credential_reference ?? null,
    p_signing_key_reference: parsed.data.signing_key_reference ?? null,
    p_configuration: parsed.data.configuration,
  });
  if (error) {
    console.error("[provider integration]", { code: error.code });
    return { ok: false, code: error.code === "42501" ? "FORBIDDEN" : "INTEGRATION_UPDATE_FAILED" };
  }
  revalidatePath("/admin/integrations");
  return { ok: true, id: data };
}

export async function upsertProviderCapability(input) {
  await requireAdmin();
  const parsed = providerCapabilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const db = await createClient();
  const { data, error } = await db.rpc("pas_admin_upsert_provider_capability_v1", {
    p_provider_id: parsed.data.provider_id,
    p_service_code: parsed.data.service_code,
    p_is_active: parsed.data.is_active,
    p_valid_from: parsed.data.valid_from ?? new Date().toISOString(),
    p_valid_until: parsed.data.valid_until ?? null,
  });
  if (error) {
    console.error("[provider capability]", { code: error.code });
    return { ok: false, code: error.code === "42501" ? "FORBIDDEN" : "CAPABILITY_UPDATE_FAILED" };
  }
  revalidatePath("/admin/integrations");
  return { ok: true, data };
}

export async function createGenericProvider(input) {
  await requireAdmin();
  const schema = z.object({
    provider_kind: z.enum(["pharmacy", "other"]),
    display_name: z.string().trim().min(2).max(160),
    legal_name: z.string().trim().max(180).nullable().optional(),
    license_number: z.string().trim().max(120).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  }).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const db = await createClient();
  const { data, error } = await db.rpc("pas_admin_create_generic_provider_v1", {
    p_provider_kind: parsed.data.provider_kind,
    p_display_name: parsed.data.display_name,
    p_legal_name: parsed.data.legal_name ?? null,
    p_license_number: parsed.data.license_number ?? null,
    p_metadata: parsed.data.metadata,
  });
  if (error) {
    console.error("[generic provider create]", { code: error.code });
    return { ok: false, code: error.code === "42501" ? "FORBIDDEN" : "PROVIDER_CREATE_FAILED" };
  }
  revalidatePath("/admin/integrations");
  return { ok: true, id: data };
}

export async function upsertInsuranceItemMapping(input) {
  await requireAdmin();
  const schema = z.object({
    payer_key: z.enum(["tamin", "ihio", "armed_forces"]),
    external_code_system: z.string().trim().min(1).max(80),
    external_code: z.string().trim().min(1).max(180),
    external_display: z.string().trim().max(240).nullable().optional(),
    service_code: z.string().trim().min(2).max(80),
    valid_from: z.iso.date().optional(),
    valid_until: z.iso.date().nullable().optional(),
  }).strict();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  const db = await createClient();
  const { data, error } = await db.rpc("pas_admin_upsert_insurance_item_mapping_v1", {
    p_payer_key: parsed.data.payer_key,
    p_external_code_system: parsed.data.external_code_system,
    p_external_code: parsed.data.external_code,
    p_external_display: parsed.data.external_display ?? null,
    p_service_code: parsed.data.service_code,
    p_valid_from: parsed.data.valid_from ?? new Date().toISOString().slice(0, 10),
    p_valid_until: parsed.data.valid_until ?? null,
  });
  if (error) {
    console.error("[insurance item mapping]", { code: error.code });
    return { ok: false, code: error.code === "42501" ? "FORBIDDEN" : "MAPPING_UPDATE_FAILED" };
  }
  revalidatePath("/admin/integrations");
  return { ok: true, data };
}

export async function finalizeProviderResult(input) {
  const user = await getSessionUser();
  if (!user?.id) return { ok: false, code: "UNAUTHENTICATED" };
  const parsed = z.object({ result_id: z.uuid() }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };

  const db = await createClient();
  const { data, error } = await db.rpc("pas_finalize_provider_result", {
    p_result_id: parsed.data.result_id,
  });
  if (error) {
    console.error("[provider result finalize]", { code: error.code });
    return { ok: false, code: error.code === "42501" ? "PROVIDER_FORBIDDEN" : "RESULT_FINALIZATION_FAILED" };
  }
  return { ok: true, data };
}
