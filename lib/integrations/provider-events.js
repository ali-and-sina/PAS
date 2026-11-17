import { z } from "zod";
export { getProviderSigningSecret, PROVIDER_SIGNING_REFERENCE } from "./integration-security";

const timestamp = z.iso.datetime({ offset: true });
const uuid = z.uuid();

const labValueSchema = z.object({
  referral_item_id: uuid,
  test_definition_id: uuid,
  value_numeric: z.number().finite().nullable().optional(),
  value_text: z.string().max(4000).nullable().optional(),
  value_boolean: z.boolean().nullable().optional(),
  unit: z.string().trim().min(1).max(40),
  reference_min: z.number().finite().nullable().optional(),
  reference_max: z.number().finite().nullable().optional(),
  reference_text: z.string().max(240).nullable().optional(),
  abnormal_flag: z.enum(["normal", "low", "high", "critical_low", "critical_high", "unknown"]).optional(),
  value_status: z.enum(["preliminary", "final", "corrected", "superseded"]).optional(),
  observed_at: timestamp.optional(),
}).strict().superRefine((value, context) => {
  const count = [value.value_numeric, value.value_text, value.value_boolean]
    .filter((entry) => entry !== undefined && entry !== null).length;
  if (count !== 1) context.addIssue({ code: "custom", message: "Exactly one result value must be supplied." });
  if (value.reference_min != null && value.reference_max != null && value.reference_min > value.reference_max) {
    context.addIssue({ code: "custom", message: "Reference minimum cannot exceed maximum." });
  }
});

const pharmacyDispenseSchema = z.object({
  referral_item_id: uuid,
  dispense_status: z.enum(["dispensed", "partially_dispensed", "substituted", "unavailable", "not_dispensed"]),
  dispensed_quantity: z.number().nonnegative().max(1_000_000),
  substitute_item_code: z.string().trim().max(120).nullable().optional(),
  substitute_display: z.string().trim().max(240).nullable().optional(),
  not_dispensed_reason: z.string().trim().max(1000).nullable().optional(),
  dispensed_at: timestamp.optional(),
}).strict();

const lifecycleBase = {
  event_id: z.string().trim().min(1).max(180),
  source_version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  provider_sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  actor_external_reference: z.string().trim().min(1).max(180),
  referral_id: uuid,
  occurred_at: timestamp.optional(),
  note: z.string().max(2000).nullable().optional(),
  provider_admission_reference: z.string().trim().max(180).nullable().optional(),
  provider_admission_at: timestamp.optional(),
};

const lifecycleSchemas = [
  z.object({ ...lifecycleBase, event_type: z.literal("referral.accepted") }).strict(),
  z.object({ ...lifecycleBase, event_type: z.literal("referral.started") }).strict(),
  z.object({ ...lifecycleBase, event_type: z.literal("referral.rejected") }).strict(),
  z.object({ ...lifecycleBase, event_type: z.literal("referral.cancelled") }).strict(),
  z.object({
    ...lifecycleBase,
    event_type: z.literal("referral.item_status"),
    referral_item_id: uuid,
    status: z.enum(["accepted", "in_progress", "partially_completed", "completed", "rejected", "cancelled"]),
    completed_quantity: z.number().nonnegative().max(1_000_000).optional(),
  }).strict(),
];

const resultBase = {
  event_id: z.string().trim().min(1).max(180),
  source_version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  provider_sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  actor_external_reference: z.string().trim().min(1).max(180),
  referral_id: uuid,
  provider_result_reference: z.string().trim().min(1).max(180),
  result_version: z.number().int().positive().max(10000).optional(),
  performed_at: timestamp.optional(),
};

const resultSchemas = [
  z.object({
    ...resultBase,
    event_type: z.literal("result.submitted"),
    result_kind: z.literal("laboratory"),
    result: z.object({ values: z.array(labValueSchema).min(1).max(500) }).strict(),
  }).strict(),
  z.object({
    ...resultBase,
    event_type: z.literal("result.submitted"),
    result_kind: z.literal("imaging"),
    result: z.object({
      report_text: z.string().trim().min(3).max(24000),
      findings: z.string().max(16000).nullable().optional(),
      impression: z.string().max(8000).nullable().optional(),
      pacs_study_uid: z.string().max(180).nullable().optional(),
      image_storage_bucket: z.string().min(3).max(100).nullable().optional(),
      image_storage_path: z.string().min(3).max(500).nullable().optional(),
    }).strict().refine((value) => (value.image_storage_bucket == null) === (value.image_storage_path == null), {
      message: "Imaging bucket and path must be supplied together.",
    }),
  }).strict(),
  z.object({
    ...resultBase,
    event_type: z.literal("result.submitted"),
    result_kind: z.literal("pharmacy"),
    result: z.object({
      dispenses: z.array(pharmacyDispenseSchema).min(1).max(500),
    }).strict(),
  }).strict(),
  z.object({
    ...resultBase,
    event_type: z.literal("result.submitted"),
    result_kind: z.enum(["therapy", "other"]),
    result: z.object({
      service_items: z.array(z.object({
        referral_item_id: uuid,
        structured_data: z.record(z.string(), z.unknown()).refine((value) => Object.hasOwn(value, "outcome"), { message: "An outcome is required." }),
      }).strict()).min(1).max(500),
    }).strict(),
  }).strict(),
];

export const providerIntegrationEventSchema = z.union([
  ...lifecycleSchemas,
  ...resultSchemas,
]);

