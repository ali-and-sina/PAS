import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import {
  INSURANCE_PAYERS,
  getInsuranceSecret,
  getProviderSigningSecret,
  hashRawPayload,
  hasForbiddenNationalIdentifier,
} from "../../lib/integrations/integration-security.js";
import { verifyBridgeSignature } from "../../lib/integrations/bridge.js";

const signingSecret = "integration-test-secret-abcdefghijklmnopqrstuvwxyz";
const raw = '{"event_id":"4a32c3a8-53b4-4c40-bb95-77e2da1a913d"}';
const now = Date.now();
const timestamp = String(Math.floor(now / 1000));
const signature = createHmac("sha256", signingSecret).update(`${timestamp}.${raw}`).digest("hex");

test("all insurer keys resolve only to explicit server environment variables", () => {
  assert.deepEqual(Object.keys(INSURANCE_PAYERS).sort(), ["armed_forces", "ihio", "tamin"]);
  for (const [payer, reference] of Object.entries(INSURANCE_PAYERS)) {
    assert.equal(getInsuranceSecret(payer, { [reference]: signingSecret }), signingSecret);
  }
  assert.equal(getInsuranceSecret("unknown", { PAS_INSURANCE_TAMIN_SIGNING_SECRET: signingSecret }), null);
});

test("insurer secret must be at least 32 characters", () => {
  assert.equal(getInsuranceSecret("tamin", { [INSURANCE_PAYERS.tamin]: "x".repeat(31) }), null);
  assert.equal(getInsuranceSecret("tamin", { [INSURANCE_PAYERS.tamin]: "x".repeat(32) }), "x".repeat(32));
});

test("provider secret reference is allow-listed and cannot address arbitrary environment variables", () => {
  assert.equal(getProviderSigningSecret("PAS_PROVIDER_LAB01_SIGNING_SECRET", { PAS_PROVIDER_LAB01_SIGNING_SECRET: signingSecret }), signingSecret);
  for (const reference of ["SUPABASE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_SECRET_KEY", "DATABASE_URL", "PAS_PROVIDER_LAB_SECRET"]) {
    assert.equal(getProviderSigningSecret(reference, { [reference]: signingSecret }), null);
  }
});

test("provider secret length is enforced", () => {
  assert.equal(getProviderSigningSecret("PAS_PROVIDER_X_SIGNING_SECRET", { PAS_PROVIDER_X_SIGNING_SECRET: "x".repeat(31) }), null);
  assert.equal(getProviderSigningSecret("PAS_PROVIDER_X_SIGNING_SECRET", { PAS_PROVIDER_X_SIGNING_SECRET: "x".repeat(32) }), "x".repeat(32));
});

test("raw payload hash is stable and preserves whitespace-sensitive bytes", () => {
  assert.equal(hashRawPayload(raw), hashRawPayload(raw));
  assert.notEqual(hashRawPayload(raw), hashRawPayload(`${raw} `));
  assert.match(hashRawPayload(raw), /^[a-f0-9]{64}$/);
});

test("legacy national identifier fields are explicitly rejected by the new insurance contract", () => {
  for (const key of ["patient_national_id", "national_id", "national_code"]) {
    assert.equal(hasForbiddenNationalIdentifier({ [key]: "0012345678" }), true);
  }
  assert.equal(hasForbiddenNationalIdentifier({ external_patient_reference: "PAYER-REF-1" }), false);
});

test("signed provider request verification rejects tampering and expiry", () => {
  assert.equal(verifyBridgeSignature({ raw, secret: signingSecret, timestamp, signature, now }), true);
  assert.equal(verifyBridgeSignature({ raw: `${raw} `, secret: signingSecret, timestamp, signature, now }), false);
  assert.equal(verifyBridgeSignature({ raw, secret: signingSecret, timestamp, signature, now: now + 301_000 }), false);
});

test("insurance API schema is strict and does not accept national id keys", async () => {
  const schema = await readFile(new URL("../../lib/integrations/insurance.js", import.meta.url), "utf8");
  assert.match(schema, /export const insurancePrescriptionEventSchema = z\.object/);
  assert.match(schema, /\}\)\.strict\(\);/);
  assert.doesNotMatch(schema, /patient_national_id\s*:/);
});

test("provider webhook route requires an active integration and secret-reference lookup", async () => {
  const route = await readFile(new URL("../../app/api/integrations/providers/[providerId]/[integrationCode]/events/route.js", import.meta.url), "utf8");
  assert.match(route, /integration\.status !== "active"/);
  assert.match(route, /getProviderSigningSecret\(integration\.signing_key_reference\)/);
  assert.match(route, /pas_ingest_provider_result/);
  assert.match(route, /pas_ingest_provider_lifecycle_event/);
});

test("QR endpoints store only a SHA-256 token hash and use authenticated RPC", async () => {
  const issue = await readFile(new URL("../../app/api/providers/referrals/[referralId]/qr/route.js", import.meta.url), "utf8");
  const resolve = await readFile(new URL("../../app/api/providers/referrals/resolve-qr/route.js", import.meta.url), "utf8");
  assert.match(issue, /randomBytes\(32\)/);
  assert.match(issue, /createHash\("sha256"\)/);
  assert.match(issue, /pas_issue_referral_qr_token/);
  assert.match(resolve, /pas_resolve_referral_qr_token/);
  assert.match(issue, /hasSameOrigin/);
  assert.match(resolve, /hasSameOrigin/);
});
