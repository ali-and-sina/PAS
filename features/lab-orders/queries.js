import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PAGE_SIZE, makePagination, normalizePage, normalizePageSize } from "@/lib/pagination";

export async function getTestPanels() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_panels")
    .select("id, code, name, name_fa")
    .eq("is_active", true)
    .order("name_fa", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data || [];
}

export async function getTestDefinitions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_definitions")
    .select("id, internal_code, name, name_fa, category")
    .eq("is_active", true)
    .order("name_fa", { ascending: true, nullsFirst: false })
    .limit(500);

  if (error) throw error;
  return data || [];
}

export async function getLaboratories() {
  const supabase = await createClient();
  const { data: laboratories, error } = await supabase
    .from("laboratory_profiles")
    .select("id, license_number, organization_id")
    .order("license_number");

  if (error) throw error;
  // Laboratory profile rows are available to authenticated users, while the
  // profiles table intentionally hides unrelated users' personal fields.
  // Use the lab's operational license identifier rather than bypassing that RLS.
  return (laboratories || []).map((lab) => ({ ...lab, full_name: "آزمایشگاه" }));
}

export async function getDoctorLabOrders(doctorId, statusFilter = null, { page: requestedPage = null, pageSize: requestedPageSize = DEFAULT_PAGE_SIZE, orderId = null } = {}) {
  if (!doctorId) {
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
      .from("lab_orders")
      .select("id, patient_id, laboratory_id, status, clinical_note, ordered_at, received_at, completed_at, cancelled_at", isPaginated ? { count: "exact" } : undefined)
      .eq("doctor_id", doctorId);
    if (orderId) query = query.eq("id", orderId);
    if (statusFilter === "open") {
      query = query.in("status", ["pending", "received_by_lab", "in_progress"]);
    } else if (["pending", "received_by_lab", "in_progress", "completed", "cancelled"].includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }
    query = query.order("ordered_at", { ascending: false }).order("id", { ascending: true });
    if (!isPaginated) query = query.limit(1000);
    return query;
  };

  let result = isPaginated
    ? await makeQuery().range((page - 1) * pageSize, page * pageSize - 1)
    : await makeQuery();
  if (result.error) throw result.error;
  const totalCount = isPaginated ? result.count ?? 0 : result.data?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (isPaginated && totalCount > 0 && page > totalPages) {
    page = totalPages;
    result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
    if (result.error) throw result.error;
  }
  const orders = result.data || [];
  const pagination = makePagination({ page, pageSize, totalCount });
  if (!orders.length) return isPaginated ? { items: [], pagination } : [];

  const patientIds = [...new Set(orders.map((order) => order.patient_id))];
  const labIds = [...new Set(orders.map((order) => order.laboratory_id).filter(Boolean))];
  const orderIds = orders.map((order) => order.id);

  const [patientsResult, labsResult, itemsResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", patientIds),
    labIds.length ? supabase.from("laboratory_profiles").select("id, license_number").in("id", labIds) : Promise.resolve({ data: [] }),
    supabase.from("lab_order_items").select("id, lab_order_id, test_panel_id, test_definition_id").in("lab_order_id", orderIds),
  ]);

  if (patientsResult.error) throw patientsResult.error;
  if (labsResult.error) throw labsResult.error;
  if (itemsResult.error) throw itemsResult.error;

  const patients = new Map((patientsResult.data || []).map((row) => [row.id, row.full_name]));
  const labs = new Map((labsResult.data || []).map((row) => [row.id, row.license_number]));
  const orderItems = itemsResult.data || [];
  const panelIds = [...new Set(orderItems.map((item) => item.test_panel_id).filter(Boolean))];
  const { data: panelTests, error: panelTestsError } = panelIds.length
    ? await supabase.from("test_panel_items").select("panel_id, test_definition_id").in("panel_id", panelIds)
    : { data: [], error: null };
  if (panelTestsError) throw panelTestsError;

  const testsByPanel = new Map();
  for (const row of panelTests || []) {
    if (!row.panel_id || !row.test_definition_id) continue;
    const ids = testsByPanel.get(row.panel_id) || new Set();
    ids.add(row.test_definition_id);
    testsByPanel.set(row.panel_id, ids);
  }

  const enrichedOrders = orders.map((order) => {
    const items = orderItems.filter((item) => item.lab_order_id === order.id);
    const actualTests = new Set();
    for (const item of items) {
      if (item.test_definition_id) actualTests.add(item.test_definition_id);
      if (item.test_panel_id) {
        for (const testId of testsByPanel.get(item.test_panel_id) || []) actualTests.add(testId);
      }
    }
    return {
      ...order,
      patient_name: patients.get(order.patient_id) || "بیمار",
      laboratory_name: labs.get(order.laboratory_id) ? `آزمایشگاه ${labs.get(order.laboratory_id)}` : "آزمایشگاه مشخص نشده",
      items,
      test_count: actualTests.size,
    };
  });
  return isPaginated ? { items: enrichedOrders, pagination } : enrichedOrders;
}
export async function getDoctorPatientLabOrders(doctorId, patientId) {
  if (!doctorId || !patientId) return [];
  const supabase = await createClient();

  const { data: orders, error } = await supabase
    .from("lab_orders")
    .select("id, patient_id, laboratory_id, status, clinical_note, ordered_at, received_at, completed_at, cancelled_at")
    .eq("doctor_id", doctorId)
    .eq("patient_id", patientId)
    .order("ordered_at", { ascending: false });

  if (error) throw error;
  if (!orders?.length) return [];

  const orderIds = orders.map((order) => order.id);
  const labIds = [...new Set(orders.map((order) => order.laboratory_id).filter(Boolean))];

  const [labsResult, itemsResult] = await Promise.all([
    labIds.length ? supabase.from("laboratory_profiles").select("id, license_number").in("id", labIds) : Promise.resolve({ data: [] }),
    supabase.from("lab_order_items").select("id, lab_order_id, test_panel_id, test_definition_id").in("lab_order_id", orderIds),
  ]);

  if (labsResult.error) throw labsResult.error;
  if (itemsResult.error) throw itemsResult.error;

  const labs = new Map((labsResult.data || []).map((row) => [row.id, row.license_number]));
  return orders.map((order) => ({
    ...order,
    laboratory_name: labs.get(order.laboratory_id) ? `آزمایشگاه ${labs.get(order.laboratory_id)}` : "آزمایشگاه مشخص نشده",
    items: (itemsResult.data || []).filter((item) => item.lab_order_id === order.id),
  }));
}

export async function getDoctorLabOrder(doctorId, orderId) {
  if (!doctorId || !orderId) return null;

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("lab_orders")
    .select("id, patient_id, laboratory_id, status, clinical_note, ordered_at, received_at, completed_at, cancelled_at")
    .eq("id", orderId)
    .eq("doctor_id", doctorId)
    .maybeSingle();

  if (error) throw error;
  if (!order) return null;

  const { data: items, error: itemsError } = await supabase
    .from("lab_order_items")
    .select("id, lab_order_id, test_panel_id, test_definition_id")
    .eq("lab_order_id", orderId);

  if (itemsError) throw itemsError;

  const { data: patient, error: patientError } = await supabase
    .from("profiles")
    .select("id, full_name, phone, national_id")
    .eq("id", order.patient_id)
    .maybeSingle();
  if (patientError) throw patientError;

  let laboratory = null;
  if (order.laboratory_id) {
    const { data: labProfile, error: labProfileError } = await supabase
      .from("laboratory_profiles")
      .select("id, license_number, organization_id")
      .eq("id", order.laboratory_id)
      .maybeSingle();
    if (labProfileError) throw labProfileError;
    if (labProfile) {
      laboratory = {
        id: labProfile.id,
        license_number: labProfile.license_number,
        organization_id: labProfile.organization_id,
        full_name: labProfile.license_number ? `آزمایشگاه ${labProfile.license_number}` : "آزمایشگاه",
      };
    }
  }

  const panelIds = (items || []).map((item) => item.test_panel_id).filter(Boolean);
  const testIds = (items || []).map((item) => item.test_definition_id).filter(Boolean);

  const [panelsResult, testsResult, reportsResult] = await Promise.all([
    panelIds.length ? supabase.from("test_panels").select("id, name").in("id", panelIds) : Promise.resolve({ data: [] }),
    testIds.length ? supabase.from("test_definitions").select("id, name, internal_code, category").in("id", testIds) : Promise.resolve({ data: [] }),
    supabase.from("diagnostic_reports").select("id, status, laboratory_id, entered_by, finalized_by, finalized_at, created_at, updated_at").eq("lab_order_id", orderId).order("created_at", { ascending: false }),
  ]);

  if (panelsResult.error) throw panelsResult.error;
  if (testsResult.error) throw testsResult.error;
  if (reportsResult.error) throw reportsResult.error;

  const panels = new Map((panelsResult.data || []).map((row) => [row.id, row]));
  const tests = new Map((testsResult.data || []).map((row) => [row.id, row]));

  return {
    ...order,
    patient,
    laboratory,
    items: (items || []).map((item) => ({
      ...item,
      panel: item.test_panel_id ? panels.get(item.test_panel_id) || null : null,
      test: item.test_definition_id ? tests.get(item.test_definition_id) || null : null,
    })),
    reports: reportsResult.data || [],
  };
}

export async function getDoctorReviewableReports(doctorId) {
  if (!doctorId) return [];
  const supabase = await createClient();

  const { data: orders, error: ordersError } = await supabase
    .from("lab_orders")
    .select("id, patient_id, ordered_at")
    .eq("doctor_id", doctorId)
    .order("ordered_at", { ascending: false });

  if (ordersError) throw ordersError;
  if (!orders?.length) return [];

  const orderIds = orders.map((order) => order.id);
  const patientIds = [...new Set(orders.map((order) => order.patient_id))];

  const [{ data: reports, error: reportsError }, { data: patients, error: patientsError }] = await Promise.all([
    supabase.from("diagnostic_reports").select("id, lab_order_id, status, finalized_at, created_at, updated_at").in("lab_order_id", orderIds).in("status", ["final", "amended"]).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name").in("id", patientIds),
  ]);

  if (reportsError) throw reportsError;
  if (patientsError) throw patientsError;

  const patientMap = new Map((patients || []).map((row) => [row.id, row.full_name]));
  const orderMap = new Map(orders.map((row) => [row.id, row]));

  return (reports || []).map((report) => {
    const order = orderMap.get(report.lab_order_id);
    return {
      ...report,
      patient_id: order?.patient_id || null,
      patient_name: order ? patientMap.get(order.patient_id) || "بیمار" : "بیمار",
    };
  });
}
