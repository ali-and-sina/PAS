"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInsuranceSecret } from "@/lib/integrations/integration-security";
import { identityReviewSchema, routePrescriptionSchema } from "./schemas";

export async function reviewInsurancePrescriptionIdentity(input) {
  await requireAdmin();
  const parsed = identityReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };

  const db = await createClient();
  const { data, error } = await db.rpc("pas_review_insurance_identity", {
    p_prescription_id: parsed.data.prescription_id,
    p_decision: parsed.data.decision,
    p_patient_id: parsed.data.decision === "approve" ? parsed.data.patient_id : null,
    p_note: parsed.data.note ?? null,
  });
  if (error) {
    console.error("[insurance identity review]", { code: error.code });
    return { ok: false, code: error.code === "42501" ? "FORBIDDEN" : "REVIEW_FAILED" };
  }
  revalidatePath("/admin/integrations");
  return { ok: true, data };
}

export async function routeInsurancePrescription(input) {
  await requireAdmin();
  const parsed = routePrescriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };

  // The routing RPC is service-role-only. Admin authorization is established
  // above before the privileged database client is used.
  const db = createAdminClient();
  const { data, error } = await db.rpc("pas_route_insurance_prescription", {
    p_prescription_id: parsed.data.prescription_id,
    p_assignments: parsed.data.assignments,
  });
  if (error) {
    console.error("[insurance prescription routing]", { code: error.code });
    return { ok: false, code: error.code === "23514" ? "INVALID_ASSIGNMENT" : "ROUTING_FAILED" };
  }
  revalidatePath("/admin/integrations");
  return { ok: true, data };
}

export async function setInsurancePayerIntegration({ payer_key, display_name, enabled } = {}) {
  await requireAdmin();
  const schema = z.object({
    payer_key: z.enum(["tamin", "ihio", "armed_forces"]),
    display_name: z.string().trim().min(2).max(150),
    enabled: z.boolean(),
  }).strict();
  const parsed = schema.safeParse({ payer_key, display_name, enabled });
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  if (parsed.data.enabled && !getInsuranceSecret(parsed.data.payer_key)) {
    return { ok: false, code: "PAYER_SIGNING_SECRET_NOT_CONFIGURED" };
  }
  const db = await createClient();
  const { data, error } = await db.rpc("pas_admin_set_payer_integration", {
    p_payer_key: parsed.data.payer_key,
    p_display_name: parsed.data.display_name,
    p_enabled: parsed.data.enabled,
  });
  if (error) {
    console.error("[payer integration control]", { code: error.code });
    return { ok: false, code: error.code === "42501" ? "FORBIDDEN" : "PAYER_INTEGRATION_UPDATE_FAILED" };
  }
  revalidatePath("/admin/integrations");
  return { ok: true, data };
}
