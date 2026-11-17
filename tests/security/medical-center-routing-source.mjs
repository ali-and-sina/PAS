import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

const [migration, actions, queries, adminActions, adminQueries, board, centerQueries, centerWorkspace, adminPage, editor] = await Promise.all([
  read("supabase/migrations/20261103224500_pas_multi_service_center_routing_v1.sql"),
  read("features/care/actions.js"),
  read("features/care/queries.js"),
  read("features/centers/actions.js"),
  read("features/centers/queries.js"),
  read("features/care/components/MedicalServicesBoard.jsx"),
  read("features/centers/queries.js"),
  read("features/centers/components/CenterWorkspace.jsx"),
  read("app/(admin)/admin/centers/page.js"),
  read("features/centers/components/CenterServiceCapabilitiesEditor.jsx"),
]);

// Additive, fail-closed schema contract.
assert.match(migration, /ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true/);
assert.match(migration, /canonical patient-imaging Phase 1 migration/i);
assert.match(migration, /public\.pas_search_service_providers\(text,text,integer,integer\)/);
assert.match(migration, /Required center\/provider RLS policies are missing/);
assert.match(migration, /Unaccepted doctor-origin requests already have a center/);
assert.match(migration, /CREATE INDEX IF NOT EXISTS pas_provider_services_active_lookup_idx/);

// New routing only uses explicitly active, administrator-controlled capabilities.
assert.match(migration, /FUNCTION private\.pas_center_accepts[\s\S]*?s\.is_active/);
assert.match(migration, /FUNCTION private\.pas_center_set_patient_request_policy[\s\S]*?FOR UPDATE/);
assert.match(migration, /patient_requests_enabled = false/);
assert.match(migration, /FUNCTION private\.pas_center_has_service[\s\S]*?s\.service_kind = p_service/);
assert.match(migration, /FUNCTION private\.pas_search_service_providers[\s\S]*?s\.is_active/);
assert.match(migration, /FUNCTION private\.pas_service_providers[\s\S]*?s\.is_active/);

// Doctor assignment is denied by a database trigger, patient assignment is the only transition.
assert.match(migration, /CREATE OR REPLACE FUNCTION private\.pas_guard_medical_request_provider_assignment/);
assert.match(migration, /NEW\.request_source = 'doctor' AND NEW\.provider_id IS NOT NULL/);
assert.match(migration, /private\.pas_role\(\) IS DISTINCT FROM 'patient'/);
assert.match(migration, /Only the patient may assign an active compatible center/);
assert.match(migration, /CREATE TRIGGER pas_medical_request_provider_guard/);
assert.match(migration, /patient_requests_enabled/);
// Center/service/policy changes serialize in one lock order: center -> service/policy.
assert.match(migration, /PERFORM 1 FROM public\.pas_medical_centers c[\s\S]*?FOR SHARE/);
assert.match(migration, /PERFORM 1[\s\S]*?FROM public\.pas_medical_centers c[\s\S]*?FOR UPDATE/);
assert.match(migration, /center-row -> service\/policy lock order/);
assert.match(migration, /FOR SHARE also conflicts with center active-state updates/);
assert.match(migration, /status IN \('requested','accepted','in_progress'\)/);

// Admin-only capability mutation archives rows, does not delete them, and protects open work.
const adminFn = migration.slice(
  migration.indexOf("CREATE OR REPLACE FUNCTION private.pas_admin_set_center_services"),
  migration.indexOf("REVOKE ALL ON FUNCTION private.pas_admin_set_center_services"),
);
assert.match(adminFn, /private\.pas_center_is_admin\(\)/);
assert.match(adminFn, /admin_profiles/);
assert.match(adminFn, /status IN \('requested','accepted','in_progress'\)/);
assert.match(adminFn, /UPDATE public\.pas_provider_services[\s\S]*?SET is_active/);
assert.match(adminFn, /ON CONFLICT \(provider_id, service_kind\)[\s\S]*?DO UPDATE SET is_active = true/);
assert.doesNotMatch(adminFn, /DELETE FROM public\.pas_provider_services/i);
assert.match(adminFn, /center\.services\.updated/);

// Existing history remains center-readable after disabling new intake.
assert.match(migration, /pas_center_worklist[\s\S]*?pas_center_has_service/);
assert.match(migration, /ALTER POLICY pas_medical_center_boundary[\s\S]*?pas_center_has_service/);
assert.match(migration, /ALTER POLICY pas_medical_result_center_boundary[\s\S]*?pas_center_has_service/);
assert.match(migration, /ALTER POLICY pas_therapy_read[\s\S]*?pas_center_has_service/);
assert.match(migration, /ALTER POLICY pas_provider_read[\s\S]*?pas_center_accepts/);

// Public admin function is a narrow invoker wrapper; direct service-table writes remain revoked.
assert.match(migration, /CREATE OR REPLACE FUNCTION public\.pas_admin_set_center_services[\s\S]*?SECURITY INVOKER/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.pas_admin_set_center_services\(uuid,text\[\]\)[\s\S]*?FROM PUBLIC, anon/);
assert.match(adminActions, /await requireAdmin\(\)/);
assert.match(adminActions, /pas_admin_set_center_services/);
assert.match(adminActions, /const db = await createClient\(\)/);
assert.match(adminQueries, /pas_provider_services/);
assert.match(adminQueries, /service_kind,is_active/);
assert.match(adminPage, /CenterServiceCapabilitiesEditor/);
assert.match(editor, /setMedicalCenterServices/);

// Center policy state is fetched once on dashboard and passed to the per-service controls.
assert.match(centerQueries, /pas_my_center_service_policies/);
assert.match(centerWorkspace, /servicePolicies\.filter\(\(policy\) => policy\.service_active !== false\)/);
assert.match(centerWorkspace, /initialEnabled=\{policy\.patient_requests_enabled === true\}/);

// All diagnostic services use the same workflow. Doctors send a null provider and patients assign later.
assert.match(board, /provider_id:\s*null/);
assert.match(board, /action="medical\.assign"[\s\S]*?provider_id:\s*provider/);
assert.match(actions, /pas_search_service_providers/);
assert.match(queries, /pas_service_providers/);

console.log("multi-service medical-center routing source security checks passed");
