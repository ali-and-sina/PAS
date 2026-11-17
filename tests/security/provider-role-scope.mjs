import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = new URL(
  "../../supabase/migrations/20261101173722_pas_provider_operator_mutation_scope_v1.sql",
  import.meta.url,
);
const patientAuditMigration = new URL(
  "../../supabase/migrations/20261101173919_pas_patient_result_audit_current_version_only_v1.sql",
  import.meta.url,
);

const sql = await readFile(migration, "utf8");

test("provider operator guard requires an active provider membership and write-capable role", () => {
  assert.match(sql, /create or replace function private\.pas_is_provider_operator\(p_provider_id uuid\)/i);
  assert.match(sql, /m\.status='active'/i);
  assert.match(sql, /p\.status='active'/i);
  assert.match(sql, /m\.role_in_provider in \('owner','manager','operator'\)/i);
  assert.doesNotMatch(sql, /role_in_provider in \([^)]*'viewer'/i);
});

test("all provider mutation and finalization RPCs enforce the operator guard", () => {
  const functions = [
    "pas_issue_referral_qr_token",
    "pas_revoke_referral_qr_token",
    "pas_respond_to_referral",
    "pas_update_referral_item",
    "pas_finalize_referral_result",
  ];
  for (const name of functions) {
    const start = sql.toLowerCase().indexOf(`create or replace function private.${name}`);
    assert.notEqual(start, -1, `${name} migration definition exists`);
    const end = sql.indexOf("$function$;", start);
    assert.notEqual(end, -1, `${name} function body is closed`);
    const body = sql.slice(start, end);
    assert.match(body, /private\.pas_is_provider_operator\(/i, `${name} must require operator permissions`);
  }
});

test("patient result list audit excludes superseded and retracted prior versions", async () => {
  const patientSql = await readFile(patientAuditMigration, "utf8");
  const auditInsert = patientSql.slice(patientSql.toLowerCase().indexOf("insert into public.pas_referral_events"));
  assert.match(auditInsert, /later\.version_number>r\.version_number/i);
  assert.match(auditInsert, /later\.status in \('final','amended','retracted'\)/i);
  assert.match(auditInsert, /limit v_limit/i);
});

test("provider result finalization is exposed only through an authenticated server action", async () => {
  const actions = await readFile(new URL("../../features/provider-referrals/actions.js", import.meta.url), "utf8");
  assert.match(actions, /export async function finalizeProviderResult/);
  assert.match(actions, /const user = await getSessionUser\(\)/);
  assert.match(actions, /rpc\("pas_finalize_provider_result"/);
  assert.match(actions, /PROVIDER_FORBIDDEN/);
});
