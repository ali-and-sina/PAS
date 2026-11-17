import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (relative) => readFile(new URL(`../../${relative}`, import.meta.url), "utf8");
const [board, workspace, actions] = await Promise.all([
  read("features/care/components/MedicalServicesBoard.jsx"),
  read("features/care/components/MedicalCentersWorkspace.jsx"),
  read("features/care/actions.js"),
]);

// Doctors create service requests without binding them to a center.
assert.match(board, /provider_id:\s*null/);
assert.doesNotMatch(board, /destinationMode|تعیین مرکز مقصد|تعیین مرکز مشخص/);
assert.match(workspace, /انتخاب مرکز انجام در همهٔ خدمات با بیمار/);

// Patient assignment for a doctor-created request uses the shared, service-filtered directory.
assert.match(board, /action="medical\.assign"[\s\S]*?provider_id:\s*provider/);
assert.match(board, /<ProviderDirectoryPicker[\s\S]*?serviceKind=\{request\.service_kind\}/);
assert.match(board, /patientRequestsOnly[\s\S]*?autoLoad/);

// Direct patient requests keep all matching centers visible; policy-disabled centers are disabled,
// not silently filtered out and misreported as nonexistent.
assert.match(board, /const received = Array\.isArray\(result\.items\) \? result\.items : \[\]/);
assert.doesNotMatch(board, /received\.filter\(\(provider\) => provider\.supports_patient_requests/);
assert.match(board, /disabled=\{patientRequestsOnly && provider\.supports_patient_requests !== true\}/);
assert.match(board, /پذیرش مستقیم غیرفعال/);
assert.match(board, /مرکز برای این خدمت پیدا شد؛ اما هیچ‌کدام پذیرش مستقیم بیمار را فعال نکرده‌اند/);

// Service registration is a single selector -> detail flow, rather than one card per modality.
assert.equal((workspace.match(/<MedicalServicesBoard/g) || []).length, 1);
assert.doesNotMatch(workspace, /ServiceOverviewCard|serviceOverview\.map|orderedServiceKinds/);
assert.match(board, /<h3 className="font-semibold">انتخاب خدمت درمانی<\/h3>/);
assert.match(board, /<option value="">انتخاب خدمت<\/option>/);
assert.match(board, /<h3 className="font-semibold">جزئیات \{selectedService\[1\]\}<\/h3>/);

// Directory lookups use the authenticated, paginated RPC and normalized Persian/Arabic digits.
assert.match(actions, /pas_search_service_providers/);
assert.match(board, /const query = normalizeDirectoryText\(search\)\.slice\(0, 100\)/);

console.log("patient medical center routing and single-service-form checks passed");
