import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

const actions = await read("features/care/actions.js");
const board = await read("features/care/components/MedicalServicesBoard.jsx");
const center = await read("features/centers/components/CenterPatientRequestPolicyPanel.jsx");
const workspace = await read("features/centers/components/CenterWorkspace.jsx");

assert.match(actions, /pas_search_service_providers/);
assert.match(actions, /p_service_kind:\s*serviceKind/);
assert.match(actions, /p_page_size:\s*50/);
assert.match(actions, /display_name: typeof item\.display_name/);
assert.match(actions, /supports_patient_requests: item\.supports_patient_requests === true/);
assert.match(actions, /pas_center_set_patient_request_policy/);
assert.match(actions, /pas_my_center_service_policies/);
assert.match(board, /supports_patient_requests\s*===\s*true/);
assert.match(board, /const \[searchStarted, setSearchStarted\] = useState\(autoLoad\)/);
assert.match(board, /searchStarted/);
assert.match(board, /نمایش مراکز این خدمت/);
assert.match(board, /idempotency_key\s*=\s*idempotencyRef\.current\.key/);
assert.match(board, /medical\.patient_request/);
assert.match(board, /زمان قطعی مرکز/);
assert.doesNotMatch(board, /supports_online_booking\s*===\s*true/);
assert.match(board, /درخواست مستقیم بیمار/);
assert.match(center, /setCenterPatientRequestPolicy/);
assert.match(center, /getCenterPatientRequestPolicies/);
assert.match(workspace, /CenterPatientRequestPolicyPanel/);

console.log("patient imaging frontend integration checks passed");
