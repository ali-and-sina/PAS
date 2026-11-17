import { z } from "zod";

export const providerMembershipSchema = z.object({
  provider_id: z.uuid(),
  profile_id: z.uuid(),
  role_in_provider: z.enum(["owner", "manager", "operator", "viewer"]),
  status: z.enum(["active", "inactive", "revoked"]).default("active"),
  external_actor_reference: z.string().trim().min(1).max(180).nullable().optional(),
}).strict();

export const providerIntegrationSchema = z.object({
  provider_id: z.uuid(),
  integration_code: z.string().regex(/^[a-z][a-z0-9_.-]{1,79}$/),
  integration_mode: z.enum(["rest_api", "webhook", "local_bridge"]),
  status: z.enum(["disabled", "active", "suspended", "retired"]).default("disabled"),
  external_provider_id: z.string().max(180).nullable().optional(),
  credential_reference: z.string().min(3).max(240).nullable().optional(),
  signing_key_reference: z.string().regex(/^PAS_PROVIDER_[A-Z0-9_]+_SIGNING_SECRET$/).nullable().optional(),
  configuration: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const providerCapabilitySchema = z.object({
  provider_id: z.uuid(),
  service_code: z.string().min(2).max(80),
  is_active: z.boolean().default(true),
  valid_from: z.iso.datetime({ offset: true }).optional(),
  valid_until: z.iso.datetime({ offset: true }).nullable().optional(),
}).strict();
