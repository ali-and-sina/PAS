import "server-only";

const ADMIN_ACTIONS = new Set([
  "create_doctor",
  "create_laboratory",
  "create_admin",
  "verify_doctor",
  "revoke_doctor",
]);

/**
 * Internal privileged audit writer.
 *
 * This module is server-only and is not exposed
 * as a Server Action.
 *
 * Actor identity must come from requireAdmin().
 */
export async function writeAdminAuditLog({
  adminClient,
  actorId,
  action,
  entityType,
  entityId,
  metadata = null,
}) {
  if (!ADMIN_ACTIONS.has(action)) {
    throw new Error("Unsupported admin audit action");
  }

  if (!actorId || !entityId) {
    throw new Error("Audit actor and entity are required");
  }

  const { error } = await adminClient.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });

  if (error) {
    console.error("[writeAdminAuditLog]", error);

    throw error;
  }
}
