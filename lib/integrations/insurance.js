import { z } from "zod";
export { INSURANCE_PAYERS, getInsuranceSecret, hashRawPayload, hasForbiddenNationalIdentifier } from "./integration-security";

const prescriptionItemSchema = z.object({
  external_item_id: z.string().trim().min(1).max(180),
  line_number: z.number().int().min(1).max(500),
  item_kind: z.enum(["laboratory", "imaging", "medication", "medical_service", "other"]),
  external_code_system: z.string().trim().min(1).max(80).optional(),
  external_code: z.string().trim().min(1).max(180).nullable().optional(),
  external_display: z.string().trim().min(1).max(240),
  quantity: z.number().positive().max(1_000_000).optional(),
  unit_label: z.string().trim().min(1).max(40).optional(),
}).strict();

/**
 * An insurer event never carries a national ID for automatic patient matching.
 * The receiving database deliberately creates a pending identity review.
 */
export const insurancePrescriptionEventSchema = z.object({
  event_id: z.uuid(),
  external_prescription_id: z.string().trim().min(1).max(180),
  external_tracking_number: z.string().trim().max(180).nullable().optional(),
  external_patient_reference: z.string().trim().max(180).nullable().optional(),
  source_message_version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  source_schema_version: z.string().trim().max(80).nullable().optional(),
  source_received_at: z.iso.datetime({ offset: true }).optional(),
  issued_at: z.iso.datetime({ offset: true }).nullable().optional(),
  expires_at: z.iso.datetime({ offset: true }).nullable().optional(),
  items: z.array(prescriptionItemSchema).min(1).max(500),
}).strict();

