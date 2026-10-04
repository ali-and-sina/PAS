import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getTestPanels() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_panels")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

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
  if (!laboratories?.length) return [];

  const ids = laboratories.map((lab) => lab.id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);

  if (profilesError) throw profilesError;

  const names = new Map((profiles || []).map((profile) => [profile.id, profile.full_name]));
  return laboratories.map((lab) => ({ ...lab, full_name: names.get(lab.id) || "آزمایشگاه" }));
}

export async function getDoctorLabOrders(doctorId) {
  if (!doctorId) return [];
  const supabase = await createClient();

  const { data: orders, error } = await supabase
    .from("lab_orders")
    .select("id, patient_id, laboratory_id, status, clinical_note, ordered_at, received_at, completed_at, cancelled_at")
    .eq("doctor_id", doctorId)
    .order("ordered_at", { ascending: false });

  if (error) throw error;
  if (!orders?.length) return [];

  const patientIds = [...new Set(orders.map((order) => order.patient_id))];
  const labIds = [...new Set(orders.map((order) => order.laboratory_id).filter(Boolean))];
  const orderIds = orders.map((order) => order.id);

  const [patientsResult, labsResult, itemsResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", patientIds),
    labIds.length ? supabase.from("profiles").select("id, full_name").in("id", labIds) : Promise.resolve({ data: [] }),
    supabase.from("lab_order_items").select("id, lab_order_id, test_panel_id, test_definition_id").in("lab_order_id", orderIds),
  ]);

  if (patientsResult.error) throw patientsResult.error;
  if (labsResult.error) throw labsResult.error;
  if (itemsResult.error) throw itemsResult.error;

  const patients = new Map((patientsResult.data || []).map((row) => [row.id, row.full_name]));
  const labs = new Map((labsResult.data || []).map((row) => [row.id, row.full_name]));

  return orders.map((order) => ({
    ...order,
    patient_name: patients.get(order.patient_id) || "بیمار",
    laboratory_name: labs.get(order.laboratory_id) || "آزمایشگاه مشخص نشده",
    items: (itemsResult.data || []).filter((item) => item.lab_order_id === order.id),
  }));
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
    labIds.length ? supabase.from("profiles").select("id, full_name").in("id", labIds) : Promise.resolve({ data: [] }),
    supabase.from("lab_order_items").select("id, lab_order_id, test_panel_id, test_definition_id").in("lab_order_id", orderIds),
  ]);

  if (labsResult.error) throw labsResult.error;
  if (itemsResult.error) throw itemsResult.error;

  const labs = new Map((labsResult.data || []).map((row) => [row.id, row.full_name]));
  return orders.map((order) => ({
    ...order,
    laboratory_name: labs.get(order.laboratory_id) || "آزمایشگاه مشخص نشده",
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

  const patientAndLabIds = [order.patient_id, order.laboratory_id].filter(Boolean);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, phone, national_id")
    .in("id", patientAndLabIds);

  if (profilesError) throw profilesError;

  const profileById = new Map((profiles || []).map((row) => [row.id, row]));
  const patient = profileById.get(order.patient_id) || null;
  const laboratory = profileById.get(order.laboratory_id) || null;

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
