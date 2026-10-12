import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function recordPatientAudit({
  actorId = null,
  action,
  entityType,
  entityId,
  metadata = null,
}) {
  if (!action || !entityType || !entityId) {
    return { ok: false };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("audit_logs").insert({
      actor_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });

    if (error) {
      console.error("[recordPatientAudit]", error);
      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    console.error("[recordPatientAudit]", error);
    return { ok: false };
  }
}
