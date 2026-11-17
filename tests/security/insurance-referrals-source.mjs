import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

const [queries, actions, adminUi, providerUi, scanner, qrDialog, patientResults, sectionNav, centerRequests, labDispatches, mobileNav, navigation, patientPage, doctorPage, doctorSnapshot, patientPrescriptionsUi, doctorPrescriptionsUi, doctorResultRoute, stage2Sql] = await Promise.all([
  read("features/insurance-prescriptions/queries.js"),
  read("features/insurance-prescriptions/actions.js"),
  read("features/insurance-prescriptions/components/InsuranceAdminWorkspace.jsx"),
  read("features/insurance-prescriptions/components/ProviderReferralWorkspace.jsx"),
  read("features/insurance-prescriptions/components/ReferralQrScanner.jsx"),
  read("features/insurance-prescriptions/components/ReferralQrDialog.jsx"),
  read("features/insurance-prescriptions/components/PatientReferralResults.jsx"),
  read("features/insurance-prescriptions/components/ProviderReferralSectionNav.jsx"),
  read("app/(medical-center)/center/[type]/requests/page.js"),
  read("app/(laboratory)/lab/dispatches/page.js"),
  read("components/layout/MobileBottomNav.jsx"),
  read("lib/constants/navigation.js"),
  read("app/(patient)/patient/prescriptions/page.js"),
  read("app/(doctor)/doctor/patients/[patientId]/page.js"),
  read("features/physician-care/components/PatientSnapshot.jsx"),
  read("features/insurance-prescriptions/components/PatientInsurancePrescriptions.jsx"),
  read("features/insurance-prescriptions/components/DoctorInsurancePrescriptions.jsx"),
  read("app/(doctor)/doctor/insurance-results/[resultId]/page.js"),
  read("database/manual-patches/PAS_Insurance_Referrals_Stage2_20261103.sql"),
]);

assert.match(queries, /^import "server-only";/m, "insurance queries must stay server-only");
assert.match(actions, /^import "server-only";/m, "insurance actions must stay server-only");
assert.match(actions, /await requireAdmin\(\)[\s\S]*?createAdminClient\(\)[\s\S]*?pas_route_insurance_prescription/, "insurance routing must remain admin-gated and server-role-only");
assert.match(actions, /randomBytes\(32\)/, "QR token must use cryptographically secure randomness");
assert.match(actions, /createHash\("sha256"\)/, "QR token must be hashed before persistence or resolution");
assert.match(actions, /p_token_hash:\s*tokenHash/, "only the token hash may be sent to the database");
assert.match(queries, /pas_get_patient_final_results/, "patient results must use the audited patient RPC");
assert.match(queries, /function hasMoreWorklistPage[\s\S]*?total > offset \+ rawItems\.length/, "provider pagination must use the database page total and raw page size before workspace filtering");
assert.equal((queries.match(/hasMore: hasMoreWorklistPage\(result, offset, rawReferrals, pageSize\)/g) || []).length, 2, "center and generic provider worklists must share membership-safe pagination");
assert.match(actions, /select\("id,status,identity_match_status,expires_at"\)[\s\S]*?PRESCRIPTION_EXPIRED/, "server routing action must reject an expired insurance prescription");
assert.match(queries, /is_expired: Number\.isFinite\(expiresAt\) && expiresAt <= now/, "admin prescription DTOs must carry a server-derived expiry state");
assert.match(adminUi, /isExpired \? "پایان مهلت ارجاع"[\s\S]*?disabled=\{pending \|\| isExpired \|\| !selectedAssignments\.length\}/, "expired prescriptions must be clearly labeled and non-routeable in the admin UI");
assert.match(queries, /pas_get_patient_final_result_detail/, "patient result detail must use the audited detail RPC");
assert.match(queries, /result\.error\.code === "P0002"/, "out-of-scope or unpublished patient results must resolve as not-found");
assert.match(queries, /getProviderMembershipDetails[\s\S]*?pas_provider_memberships[\s\S]*?pas_provider_registry/, "provider workspaces must be scoped by active membership and registry records");
assert.match(queries, /user\.role === "patient"\) notFound\(\)/, "patient profiles must not enter generic provider workspaces");
assert.match(queries, /function isOwnCenterAccount[\s\S]*?medical_center_profile_id === user\.id/, "center owners must keep the center-specific workspace");
assert.match(queries, /workspaceProviders = details\.providers\.filter\(\(provider\) => !isOwnCenterAccount\(user, provider\)\)/, "provider workspaces must include staff memberships independent of profile role");
assert.match(actions, /getProviderMembershipWorklistForScope/, "generic provider mutations must be checked against their member worklist");
assert.match(actions, /assertReferralInScope/, "provider mutations must re-check referral scope server-side");
assert.match(actions, /finalizeProviderResult[\s\S]*?pas_finalize_provider_result/, "provider result finalization must use its authenticated RPC");
assert.match(actions, /pas_admin_set_provider_membership/, "provider membership management must use its audited admin RPC");
assert.match(actions, /pas_admin_upsert_provider_capability_v1/, "provider capacity management must use its audited admin RPC");
assert.match(actions, /profileResult\.data\.role === "patient"/, "patient accounts must not be assignable as provider staff");
assert.match(actions, /expectedGroups[\s\S]*?ITEM_KIND_MISMATCH/, "insurance item mappings must be validated against the selected item kind on the server");
assert.match(actions, /nextStatus: z\.enum\(\["accepted", "in_progress", "partially_completed", "completed", "cancelled"\]\)/, "provider item mutation must validate cancellation status on the server");
assert.match(adminUi, /reviewInsuranceIdentity/, "admin UI must use the controlled identity review action");
assert.match(adminUi, /upsertInsuranceItemMapping/, "admin UI must use the audited mapping action");
assert.match(adminUi, /routeInsurancePrescription/, "admin UI must use the server-only routing action");
assert.match(adminUi, /upsertProviderMembership/, "admin UI must expose audited provider membership management");
assert.match(adminUi, /upsertProviderCapability/, "admin UI must expose audited provider capacity management");
assert.match(providerUi, /operatorProviderIds\.includes/, "viewer memberships must not expose mutation controls");
assert.match(providerUi, /finalizeProviderResult/, "provider UI must expose authorized result finalization");
assert.match(providerUi, /partially_completed/, "provider UI must support partial completion workflow");
assert.match(providerUi, /update\("cancelled"\)/, "provider UI must allow authorized cancellation of an assigned item");
assert.match(providerUi, /respond\("cancel"\)/, "provider UI must allow authorized cancellation of an assigned referral");
assert.match(scanner, /resolveProviderReferralQr/, "QR scan must resolve through the scoped server action");
assert.match(scanner, /setResult\(response\.data\)[\s\S]*?setToken\(""\)/, "the one-time QR bearer token must be cleared after successful resolution");
assert.match(queries, /value_status !== "superseded"/, "superseded lab values must not be rendered in patient result detail");
assert.match(providerUi, /FileCheck2/, "provider result finalization icon must be imported and rendered");
assert.match(qrDialog, /issueProviderReferralQr[\s\S]*?revokeProviderReferralQr/, "QR issuance and revocation must use server actions");
assert.match(qrDialog, /function closeDialog[\s\S]*?setOpen\(false\)[\s\S]*?setQr\(null\)/, "closing the QR dialog must clear the one-time bearer token");
assert.match(qrDialog, /function handleOpenChange[\s\S]*?if \(pending \|\| revoking\) return/, "the QR dialog must not close while token creation or revocation is in flight");
assert.match(patientResults, /images_available/, "patient imaging UI must clearly describe image availability without exposing storage paths");
assert.match(sectionNav, /درخواست‌های مستقیم[\s\S]*?ارجاع‌های بیمه‌ای/, "provider workflow navigation must separate direct and insurance referrals");
assert.match(centerRequests, /ProviderReferralSectionNav type=\{type\} active="direct"/, "center direct requests must expose the insurance referral tab");
assert.match(labDispatches, /ProviderReferralSectionNav type="laboratory" active="direct"/, "laboratory direct submissions must expose the separate insurance referral tab");
assert.match(mobileNav, /\[\"\/lab\/intake\/scan\", \"اسکن کد\"\]/, "the existing laboratory intake QR shortcut must remain in mobile navigation");
assert.doesNotMatch(navigation, /href: \"\/lab\/referrals\"/, "insurance referral navigation must not duplicate the laboratory direct queue entry");

assert.match(queries, /pas_get_patient_insurance_prescriptions/, "patient insurer prescriptions must use the owner-scoped RPC");
assert.match(queries, /pas_get_doctor_patient_insurance_prescriptions/, "doctor insurer prescriptions must use the scope-filtered RPC");
assert.match(queries, /pas_get_doctor_insurance_result_detail/, "doctor result detail must use the scope-checked RPC");
assert.match(actions, /issuePatientReferralQr[\s\S]*?pas_patient_issue_referral_qr_token/, "patient QR issuance must go through its ownership-checked RPC");
assert.match(actions, /revokePatientReferralQr[\s\S]*?pas_patient_revoke_referral_qr_token/, "patient QR revocation must go through its ownership-checked RPC");
assert.match(patientPage, /Promise\.all[\s\S]*?getPatientInsurancePrescriptions[\s\S]*?PatientInsurancePrescriptions/, "patient prescriptions page must load insurer and internal prescriptions independently");
assert.match(patientPage, /insuranceOffset/, "patient insurer pagination must not reuse the internal prescription page parameter");
assert.match(doctorPage, /getDoctorPatientInsurancePrescriptions[\s\S]*?PatientSnapshot/, "doctor patient record must request insurer data through the scoped query");
assert.match(doctorSnapshot, /DoctorInsurancePrescriptions/, "doctor snapshot must mount the insurer section inside the patient record");
assert.match(doctorResultRoute, /getDoctorInsuranceReferralResultDetail[\s\S]*?PatientReferralResultDetail/, "doctor result detail must use the scoped query");
assert.match(patientPrescriptionsUi, /ReferralQrDialog mode="patient"/, "patient UI must use the patient-scoped QR dialog mode");
assert.match(patientPrescriptionsUi, /!\["cancelled", "rejected"\]\.includes\(prescription\.status\)/, "patients must not be offered QR issuance for cancelled/rejected prescriptions");
assert.match(doctorPrescriptionsUi, /referral\.status \?/, "doctor UI must not infer a mixed-scope referral status");
assert.match(stage2Sql, /private\.pas_can_read_insurance_service/, "SQL must enforce item-level record scopes");
assert.match(stage2Sql, /trg_pas_guard_execution_referral_not_expired/, "SQL must enforce expiry before creating a referral");
assert.match(stage2Sql, /trg_pas_guard_execution_referral_item_not_expired/, "SQL must enforce expiry when adding items to an existing referral");
assert.match(stage2Sql, /trg_pas_guard_referral_qr_insert_expiry[\s\S]*?trg_pas_guard_referral_qr_resolve_expiry/, "SQL must enforce expiry at QR issuance and resolution");
assert.match(stage2Sql, /trg_pas_guard_provider_membership_profile[\s\S]*?trg_pas_guard_profile_role_provider_membership/, "SQL must block patient provider memberships in both directions");
assert.match(stage2Sql, /private\.pas_issue_referral_qr_token[\s\S]*?for update[\s\S]*?v_prescription\.expires_at[\s\S]*?private\.pas_resolve_referral_qr_token/, "provider QR issue/resolve must serialize against prescription expiry");
assert.match(stage2Sql, /security definer[\s\S]*?set search_path = ''[\s\S]*?revoke all on function public\.pas_get_patient_insurance_prescriptions[\s\S]*?to authenticated/, "exposed patient RPC must use a fixed search_path and authenticated-only execution");
assert.doesNotMatch(stage2Sql, /grant\s+(?:select|insert|update|delete)\s+on\s+table\s+public\.pas_(?:insurance|execution|referral)/i, "the patch must not add direct clinical table grants");
const patientReadSql = stage2Sql.split("create or replace function private.pas_get_patient_insurance_prescriptions")[1]?.split("create or replace function public.pas_get_patient_insurance_prescriptions")[0] || "";
assert.doesNotMatch(patientReadSql, /q\.active_item_count|q\.visible_active_item_count/, "patient-owned prescription reads must not depend on physician-scope-only counters");
const doctorDetailSql = stage2Sql.split("create or replace function private.pas_get_doctor_insurance_result_detail")[1]?.split("create or replace function public.pas_get_doctor_insurance_result_detail")[0] || "";
assert.match(doctorDetailSql, /select rr\.\* into v_result/, "doctor result detail must load the typed result row without composite assignment ambiguity");
assert.match(doctorDetailSql, /ri\.referral_id = v_referral_id/, "clinical result children must be bound to the exact authorized referral");
assert.match(doctorDetailSql, /sr\.service_group = sc\.service_group/, "structured service result data must match the service group of its own referral item");
assert.match(stage2Sql, /create or replace function private\.pas_respond_to_referral[\s\S]*?from public\.pas_insurance_prescriptions rx[\s\S]*?for update[\s\S]*?from public\.pas_execution_referrals er[\s\S]*?for update/, "referral responses must lock the parent prescription before the referral");
assert.match(stage2Sql, /create or replace function private\.pas_update_referral_item[\s\S]*?from public\.pas_insurance_prescriptions rx[\s\S]*?for update[\s\S]*?from public\.pas_execution_referrals er[\s\S]*?for update[\s\S]*?from public\.pas_execution_referral_items ri[\s\S]*?for update/, "item updates must lock the parent, referral and item in that order");
assert.match(stage2Sql, /create or replace function private\.pas_reconcile_referral_from_items[\s\S]*?from public\.pas_insurance_prescriptions rx[\s\S]*?for update[\s\S]*?from public\.pas_execution_referrals er[\s\S]*?for update/, "item reconciliation must lock the parent before the referral");
assert.match(stage2Sql, /create or replace function private\.pas_reconcile_referral_from_results[\s\S]*?from public\.pas_insurance_prescriptions rx[\s\S]*?for update[\s\S]*?from public\.pas_execution_referrals er[\s\S]*?for update/, "result reconciliation must lock the parent before the referral");
assert.match(stage2Sql, /new\.expires_at > clock_timestamp\(\) \+ interval '7 days'/, "direct trusted QR insertion must not create an overlong-lived token");


for (const [name, source] of Object.entries({ adminUi, providerUi, scanner, qrDialog, patientResults, patientPrescriptionsUi, doctorPrescriptionsUi })) {
  assert.doesNotMatch(source, /createClient\(|createAdminClient\(|\.from\("pas_(?:insurance|execution|referral)/, `${name} must not query protected clinical tables from the browser`);
  assert.doesNotMatch(source, /NEXT_PUBLIC_.*(?:SECRET|SERVICE_ROLE)/, `${name} must not contain privileged public environment variables`);
}

console.log("insurance referrals source security checks passed");
