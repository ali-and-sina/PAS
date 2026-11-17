import "server-only";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getInsurancePrescriptionQueue({ status = null, limit = 50 } = {}) {
  await requireAdmin();
  const db = createAdminClient();
  const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 50, 100));
  let query = db
    .from("pas_insurance_prescriptions")
    .select("id,payer_key,external_prescription_id,external_tracking_number,source_message_version,source_received_at,identity_match_status,status,created_at,items:pas_insurance_prescription_items(id,line_number,item_kind,external_code,external_display,mapping_status,item_status,quantity,unit_label),identity_reviews:pas_insurance_identity_reviews(id,status,review_reason,created_at)")
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (["pending_identity_review", "ready_for_routing", "partially_routed", "routed", "partially_completed", "completed", "rejected", "cancelled"].includes(status)) {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[insurance prescription queue]", { code: error.code });
    throw new Error("INSURANCE_QUEUE_UNAVAILABLE");
  }
  return data ?? [];
}

export async function getInsuranceIntegrationControls() {
  await requireAdmin();
  const db = createAdminClient();
  const { data, error } = await db
    .from("pas_integration_connections")
    .select("provider_key,display_name,enabled,created_at")
    .in("provider_key", ["tamin", "ihio", "armed_forces"])
    .order("provider_key");
  if (error) {
    console.error("[insurance integration controls]", { code: error.code });
    throw new Error("INSURANCE_INTEGRATION_CONTROLS_UNAVAILABLE");
  }
  return (data ?? []).map((row) => ({
    ...row,
    signing_secret_configured: Boolean(process.env[
      ({
        tamin: "PAS_INSURANCE_TAMIN_SIGNING_SECRET",
        ihio: "PAS_INSURANCE_IHIO_SIGNING_SECRET",
        armed_forces: "PAS_INSURANCE_ARMED_FORCES_SIGNING_SECRET",
      })[row.provider_key]
    ]?.length >= 32),
  }));
}
