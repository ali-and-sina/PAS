import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20261103172602_pas_patient_imaging_requests_v1.sql");
const actions = read("features/care/actions.js");
const backfill = read("supabase/migrations/20261103173003_pas_medical_request_preferred_schedule_backfill_v1.sql");

const tests = [];
function check(name, fn) {
  fn();
  tests.push(name);
}

check("request_source_and_requested_by_are_added_and_backfilled", () => {
  assert.match(migration, /add column if not exists request_source text not null default 'doctor'/i);
  assert.match(migration, /set requested_by = doctor_id\s+where requested_by is null/i);
  assert.match(migration, /alter column doctor_id drop not null/i);
  assert.match(migration, /alter column requested_by set not null/i);
  assert.match(migration, /request_source = 'doctor' and doctor_id is not null and requested_by = doctor_id/i);
  assert.match(migration, /request_source = 'patient' and doctor_id is null and requested_by = patient_id/i);
});

check("legacy_doctor_request_action_remains_compatible", () => {
  assert.match(migration, /new\.requested_by := coalesce\(new\.requested_by, new\.doctor_id\)/i);
  assert.match(migration, /before insert or update on public\.pas_medical_requests/i);
  assert.match(migration, /return private\.pas_care_command\(p_action, p_payload\)/i);
  assert.match(migration, /medical\.patient_request/i);
});

check("identity_is_immutable_and_patient_payload_cannot_spoof", () => {
  assert.match(migration, /new\.patient_id is distinct from old\.patient_id/i);
  assert.match(migration, /new\.requested_by is distinct from old\.requested_by/i);
  assert.match(migration, /p_payload \?\| array\['patient_id','doctor_id','requested_by','request_source','scheduled_at'\]/i);
  assert.match(migration, /v_user uuid := auth\.uid\(\)/i);
  assert.match(migration, /private\.pas_role\(\) is distinct from 'patient'/i);
  assert.match(migration, /not exists \(select 1 from public\.patient_profiles pp where pp\.id = v_user\)/i);
});

check("patient_request_requires_center_service_and_explicit_policy", () => {
  assert.match(migration, /private\.pas_center_accepts\(v_provider, v_service\)/i);
  assert.match(migration, /pol\.patient_requests_enabled/i);
  assert.match(migration, /default false/i);
  assert.match(migration, /patient_requests_enabled = excluded\.patient_requests_enabled/i);
});

check("patient_preference_is_not_a_confirmed_schedule", () => {
  assert.match(migration, /patient_preferred_at, idempotency_key/i);
  assert.match(migration, /v_note, 'requested', null, v_details/i);
  assert.match(migration, /Final center-confirmed appointment time only/i);
  assert.match(migration, /doctor_preferred_at := coalesce\(new\.doctor_preferred_at, new\.scheduled_at\)/i);
});

check("idempotency_is_required_and_unique", () => {
  assert.match(migration, /create unique index if not exists pas_medical_requests_idempotency_uidx/i);
  assert.match(migration, /v_key uuid/i);
  assert.match(migration, /or v_key is null/i);
  assert.match(migration, /Idempotency key was already used for a different request/i);
});

check("private_policy_table_is_rls_protected_without_direct_grants", () => {
  assert.match(migration, /alter table public\.pas_center_service_policies enable row level security/i);
  assert.match(migration, /revoke all on table public\.pas_center_service_policies from public, anon, authenticated/i);
});

check("directory_returns_only_approved_public_center_fields", () => {
  assert.match(migration, /lp\.license_number as license_number/i);
  assert.match(migration, /null::text as medical_license_number/i);
  assert.match(migration, /null::text as city/i);
  assert.match(migration, /null::text as address/i);
  assert.match(migration, /false as supports_online_booking/i);
  assert.doesNotMatch(migration, /select\s+c\.profile_id as provider_id,\s*p\.full_name/i);
});

check("directory_search_is_bounded_and_server_paged", () => {
  assert.match(migration, /pas_search_service_providers\(/i);
  assert.match(migration, /greatest\(1,least\(coalesce\(p_page_size,20\),50\)\)/i);
  assert.match(migration, /limit v_size offset \(\(v_page-1\)\*v_size\)/i);
  assert.match(migration, /lp\.license_number ilike/i);
});

check("center_worklist_keeps_doctorless_requests_and_date_filters", () => {
  assert.match(migration, /left join public\.profiles d on d\.id=r\.doctor_id/i);
  assert.match(migration, /coalesce\(scheduled_at,patient_preferred_at,doctor_preferred_at,requested_at\)/i);
  assert.match(migration, /r\.provider_id=auth\.uid\(\)/i);
  assert.match(migration, /private\.pas_center_accepts\(r\.provider_id,r\.service_kind\)/i);
});

check("no_direct_write_grants_are_added_to_medical_requests", () => {
  assert.doesNotMatch(migration, /grant\s+(?:insert|update|delete|all).*pas_medical_requests/i);
  assert.doesNotMatch(migration, /create policy .*on public\.pas_medical_requests.*for (?:insert|update|all)/i);
});

check("server_action_allowlist_and_rpc_wrappers_are_updated", () => {
  assert.match(actions, /"medical\.patient_request"/);
  assert.match(actions, /pas_search_service_providers/);
  assert.match(actions, /pas_center_set_patient_request_policy/);
});

check("legacy_unaccepted_schedule_values_are_moved_to_preference_column", () => {
  assert.match(backfill, /set doctor_preferred_at = coalesce\(doctor_preferred_at, scheduled_at\)/i);
  assert.match(backfill, /status = 'requested'/i);
  assert.match(backfill, /scheduled_at is not null/i);
});

console.log(JSON.stringify({ total: tests.length, passed: tests.length, tests }, null, 2));
