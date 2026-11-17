import { createHash } from "node:crypto";

export const INSURANCE_PAYERS = Object.freeze({
  tamin: "PAS_INSURANCE_TAMIN_SIGNING_SECRET",
  ihio: "PAS_INSURANCE_IHIO_SIGNING_SECRET",
  armed_forces: "PAS_INSURANCE_ARMED_FORCES_SIGNING_SECRET",
});

export const PROVIDER_SIGNING_REFERENCE = /^PAS_PROVIDER_[A-Z0-9_]+_SIGNING_SECRET$/;
const FORBIDDEN_INSURANCE_ID_KEYS = new Set(["patient_national_id", "national_id", "national_code"]);

export function hashRawPayload(raw) {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function getInsuranceSecret(payer, env = process.env) {
  const reference = INSURANCE_PAYERS[payer];
  if (!reference) return null;
  const secret = env[reference];
  return typeof secret === "string" && secret.length >= 32 ? secret : null;
}

export function getProviderSigningSecret(reference, env = process.env) {
  if (typeof reference !== "string" || !PROVIDER_SIGNING_REFERENCE.test(reference)) return null;
  const secret = env[reference];
  return typeof secret === "string" && secret.length >= 32 ? secret : null;
}

export function hasForbiddenNationalIdentifier(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  return Object.keys(payload).some((key) => FORBIDDEN_INSURANCE_ID_KEYS.has(key.toLowerCase()));
}
