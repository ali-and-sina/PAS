import { z } from "zod";

export const identityReviewSchema = z.object({
  prescription_id: z.uuid(),
  decision: z.enum(["approve", "reject"]),
  patient_id: z.uuid().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.decision === "approve" && !value.patient_id) {
    context.addIssue({ code: "custom", path: ["patient_id"], message: "برای تأیید تطبیق، بیمار باید انتخاب شود." });
  }
});

export const referralAssignmentSchema = z.object({
  item_id: z.uuid(),
  provider_id: z.uuid(),
}).strict();

export const routePrescriptionSchema = z.object({
  prescription_id: z.uuid(),
  assignments: z.array(referralAssignmentSchema).min(1).max(500),
}).strict().superRefine((value, context) => {
  const itemIds = value.assignments.map((item) => item.item_id);
  if (new Set(itemIds).size !== itemIds.length) {
    context.addIssue({ code: "custom", path: ["assignments"], message: "هر قلم نسخه فقط یک‌بار می‌تواند تخصیص داده شود." });
  }
});
