import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { DEFAULT_PAGE_SIZE, makePagination, normalizePage, normalizePageSize } from "@/lib/pagination";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_RE.test(String(value || ""));
}

const REQUEST_FIELDS = "id, patient_id, doctor_id, created_by, clinical_note, status, created_at, updated_at, cancelled_at, fulfilled_at";
const DISPATCH_FIELDS = "id, physician_lab_request_id, laboratory_branch_id, created_by, status, requested_home_collection, sent_at, responded_at, responded_by, response_note, lab_order_id, created_at, updated_at";
const ITEM_FIELDS = "id, physician_lab_request_id, test_panel_id, test_definition_id, created_at";

async function getRequestsForOwner({ ownerId, ownerColumn, role, page: requestedPage = 1, pageSize: requestedPageSize = DEFAULT_PAGE_SIZE }) {
  const user = await getSessionUser();
  const pageSize = normalizePageSize(requestedPageSize);
  let page = normalizePage(requestedPage);
  if (!user?.id || user.role !== role || user.id !== ownerId) {
    return { items: [], pagination: makePagination({ page: 1, pageSize, totalCount: 0 }) };
  }

  const supabase = await createClient();
  const makeQuery = () => supabase
    .from("physician_lab_requests")
    .select(REQUEST_FIELDS, { count: "exact" })
    .eq(ownerColumn, user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });

  let requestResult = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
  if (requestResult.error) throw requestResult.error;
  const totalCount = requestResult.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount > 0 && page > totalPages) {
    page = totalPages;
    requestResult = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
    if (requestResult.error) throw requestResult.error;
  }

  const requests = requestResult.data || [];
  const pagination = makePagination({ page, pageSize, totalCount });
  if (!requests.length) return { items: [], pagination };

  const requestIds = requests.map((row) => row.id);
  const [itemsResult, dispatchesResult, homeResult] = await Promise.all([
    supabase.from("physician_lab_request_items").select(ITEM_FIELDS).in("physician_lab_request_id", requestIds),
    supabase.from("lab_dispatches").select(DISPATCH_FIELDS).in("physician_lab_request_id", requestIds).order("sent_at", { ascending: false }),
    role === "patient"
      ? supabase.from("home_collection_requests").select("id, physician_lab_request_id, lab_dispatch_id, status, scheduled_for, requested_at").in("physician_lab_request_id", requestIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (dispatchesResult.error) throw dispatchesResult.error;
  if (homeResult.error) throw homeResult.error;

  const panelIds = [...new Set((itemsResult.data || []).map((item) => item.test_panel_id).filter(Boolean))];
  const testIds = [...new Set((itemsResult.data || []).map((item) => item.test_definition_id).filter(Boolean))];
  const [panelsResult, testsResult] = await Promise.all([
    panelIds.length
      ? supabase.from("test_panels").select("id, code, name, name_fa").in("id", panelIds)
      : Promise.resolve({ data: [], error: null }),
    testIds.length
      ? supabase.from("test_definitions").select("id, internal_code, name, name_fa, category").in("id", testIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (panelsResult.error) throw panelsResult.error;
  if (testsResult.error) throw testsResult.error;

  const panels = new Map((panelsResult.data || []).map((row) => [row.id, row]));
  const tests = new Map((testsResult.data || []).map((row) => [row.id, row]));
  const itemsByRequest = new Map();
  for (const item of itemsResult.data || []) {
    const entry = {
      ...item,
      panel: item.test_panel_id ? panels.get(item.test_panel_id) || null : null,
      test: item.test_definition_id ? tests.get(item.test_definition_id) || null : null,
    };
    const list = itemsByRequest.get(item.physician_lab_request_id) || [];
    list.push(entry);
    itemsByRequest.set(item.physician_lab_request_id, list);
  }

  const dispatchesByRequest = new Map();
  for (const dispatch of dispatchesResult.data || []) {
    const list = dispatchesByRequest.get(dispatch.physician_lab_request_id) || [];
    list.push(dispatch);
    dispatchesByRequest.set(dispatch.physician_lab_request_id, list);
  }

  const branchIds = [...new Set((dispatchesResult.data || []).map((row) => row.laboratory_branch_id).filter(Boolean))];
  const { data: branches, error: branchError } = branchIds.length
    ? await supabase.from("laboratory_branches").select("id, display_name, city, address, supports_home_collection").in("id", branchIds)
    : { data: [], error: null };
  if (branchError) throw branchError;
  const branchMap = new Map((branches || []).map((row) => [row.id, row]));

  const homeByRequest = new Map();
  for (const home of homeResult.data || []) {
    const list = homeByRequest.get(home.physician_lab_request_id) || [];
    list.push(home);
    homeByRequest.set(home.physician_lab_request_id, list);
  }

  const enriched = requests.map((request) => ({
    ...request,
    items: itemsByRequest.get(request.id) || [],
    dispatches: (dispatchesByRequest.get(request.id) || []).map((dispatch) => ({
      ...dispatch,
      branch: branchMap.get(dispatch.laboratory_branch_id) || null,
    })),
    homeCollectionRequests: homeByRequest.get(request.id) || [],
  }));

  return { items: enriched, pagination };
}

export async function getPatientLabRequests({ page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "patient") {
    return { items: [], pagination: makePagination({ page: 1, pageSize, totalCount: 0 }) };
  }
  return getRequestsForOwner({ ownerId: user.id, ownerColumn: "patient_id", role: "patient", page, pageSize });
}

export async function getDoctorLabRequests({ patientId = null, requestId = null, status = null, page: requestedPage = null, pageSize: requestedPageSize = DEFAULT_PAGE_SIZE } = {}) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "doctor" || user.is_verified !== true) {
    return requestedPage === null || requestedPage === undefined
      ? []
      : { items: [], pagination: makePagination({ page: 1, pageSize: requestedPageSize, totalCount: 0 }) };
  }

  const supabase = await createClient();
  const isPaginated = requestedPage !== null && requestedPage !== undefined;
  const pageSize = normalizePageSize(requestedPageSize);
  let page = isPaginated ? normalizePage(requestedPage) : 1;
  const makeQuery = () => {
    let query = supabase
      .from("physician_lab_requests")
      .select(REQUEST_FIELDS, isPaginated ? { count: "exact" } : undefined)
      .eq("doctor_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    if (patientId) query = query.eq("patient_id", patientId);
    if (requestId) query = query.eq("id", requestId);
    if (["submitted", "cancelled", "fulfilled"].includes(status)) query = query.eq("status", status);
    if (!isPaginated) query = query.limit(1000);
    return query;
  };

  let requestResult = isPaginated
    ? await makeQuery().range((page - 1) * pageSize, page * pageSize - 1)
    : await makeQuery();
  if (requestResult.error) throw requestResult.error;
  const totalCount = isPaginated ? requestResult.count ?? 0 : requestResult.data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (isPaginated && totalCount > 0 && page > totalPages) {
    page = totalPages;
    requestResult = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
    if (requestResult.error) throw requestResult.error;
  }
  const requests = requestResult.data || [];
  const pagination = makePagination({ page, pageSize, totalCount });
  if (!requests.length) return isPaginated ? { items: [], pagination } : [];

  const ids = requests.map((row) => row.id);
  const { data: items, error: itemsError } = await supabase.from("physician_lab_request_items").select(ITEM_FIELDS).in("physician_lab_request_id", ids);
  const { data: dispatches, error: dispatchError } = await supabase.from("lab_dispatches").select(DISPATCH_FIELDS).in("physician_lab_request_id", ids).order("sent_at", { ascending: false });
  if (itemsError) throw itemsError;
  if (dispatchError) throw dispatchError;

  const panelIds = [...new Set((items || []).map((item) => item.test_panel_id).filter(Boolean))];
  const testIds = [...new Set((items || []).map((item) => item.test_definition_id).filter(Boolean))];
  const [panelsResult, testsResult] = await Promise.all([
    panelIds.length ? supabase.from("test_panels").select("id, code, name, name_fa").in("id", panelIds) : Promise.resolve({ data: [], error: null }),
    testIds.length ? supabase.from("test_definitions").select("id, internal_code, name, name_fa, category").in("id", testIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (panelsResult.error) throw panelsResult.error;
  if (testsResult.error) throw testsResult.error;

  const panelMap = new Map((panelsResult.data || []).map((row) => [row.id, row]));
  const testMap = new Map((testsResult.data || []).map((row) => [row.id, row]));
  const itemsMap = new Map();
  for (const item of items || []) {
    const list = itemsMap.get(item.physician_lab_request_id) || [];
    list.push({ ...item, panel: panelMap.get(item.test_panel_id) || null, test: testMap.get(item.test_definition_id) || null });
    itemsMap.set(item.physician_lab_request_id, list);
  }

  const branchIds = [...new Set((dispatches || []).map((row) => row.laboratory_branch_id).filter(Boolean))];
  const { data: branches, error: branchError } = branchIds.length
    ? await supabase.from("laboratory_branches").select("id, display_name, city, address, supports_home_collection").in("id", branchIds)
    : { data: [], error: null };
  if (branchError) throw branchError;
  const branchMap = new Map((branches || []).map((row) => [row.id, row]));
  const dispatchMap = new Map();
  for (const dispatch of dispatches || []) {
    const list = dispatchMap.get(dispatch.physician_lab_request_id) || [];
    list.push({ ...dispatch, branch: branchMap.get(dispatch.laboratory_branch_id) || null });
    dispatchMap.set(dispatch.physician_lab_request_id, list);
  }

  const patientIds = [...new Set(requests.map((request) => request.patient_id).filter(Boolean))];
  const { data: patientProfiles, error: patientProfilesError } = patientIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", patientIds)
    : { data: [], error: null };
  if (patientProfilesError) throw patientProfilesError;
  const patientNames = new Map((patientProfiles || []).map((profile) => [profile.id, profile.full_name]));

  const enrichedRequests = requests.map((request) => ({
    ...request,
    patient_name: patientNames.get(request.patient_id) || "بیمار",
    items: itemsMap.get(request.id) || [],
    dispatches: dispatchMap.get(request.id) || [],
  }));
  return isPaginated ? { items: enrichedRequests, pagination } : enrichedRequests;
}

export async function getLabSubmissionDetails(dispatchId) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "laboratory" || !isUuid(dispatchId)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_lab_dispatch_details", { p_dispatch_id: dispatchId });
  if (error) {
    if (error.code === "P0001") return null;
    throw error;
  }
  return data || null;
}
