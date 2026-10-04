import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

const ORDER_SELECT =
  "id, patient_id, doctor_id, laboratory_id, status, clinical_note, ordered_at, received_at, completed_at, cancelled_at, created_at";

async function getLabContext() {
  const user = await getSessionUser();

  if (!user?.id || user.role !== "laboratory") {
    return null;
  }

  const supabase = await createClient();

  const { data: laboratoryProfile, error } = await supabase
    .from("laboratory_profiles")
    .select("id, license_number, organization_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!laboratoryProfile) return null;

  return {
    ...user,
    laboratoryProfile,
  };
}

async function mapProfiles(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];

  if (!uniqueIds.length) {
    return new Map();
  }

  /*
   * The normal authenticated client cannot read arbitrary patient/doctor
   * profiles before a relationship exists.
   *
   * We only call this after loading rows owned by the current laboratory,
   * then use the server-only privileged client to fetch the minimum field
   * required by the Lab UI.
   */
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", uniqueIds);

  if (error) throw error;

  return new Map((data || []).map((row) => [row.id, row]));
}

async function enrichOrders(supabase, orders) {
  if (!orders.length) return [];

  const orderIds = orders.map((order) => order.id);

  const profiles = await mapProfiles(
    orders.flatMap((order) => [order.patient_id, order.doctor_id]),
  );

  const { data: items, error: itemsError } = await supabase
    .from("lab_order_items")
    .select("id, lab_order_id, test_panel_id, test_definition_id")
    .in("lab_order_id", orderIds);

  if (itemsError) throw itemsError;

  const panelIds = (items || [])
    .map((item) => item.test_panel_id)
    .filter(Boolean);

  const testIds = (items || [])
    .map((item) => item.test_definition_id)
    .filter(Boolean);

  const [panelsResult, testsResult] = await Promise.all([
    panelIds.length
      ? supabase
          .from("test_panels")
          .select("id, code, name, name_fa")
          .in("id", panelIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    testIds.length
      ? supabase
          .from("test_definitions")
          .select(
            "id, name, name_fa, internal_code, value_type, default_unit, decimal_precision, allows_negative",
          )
          .in("id", testIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (panelsResult.error) throw panelsResult.error;
  if (testsResult.error) throw testsResult.error;

  const panels = new Map((panelsResult.data || []).map((row) => [row.id, row]));

  const tests = new Map((testsResult.data || []).map((row) => [row.id, row]));

  const itemsByOrder = new Map();

  for (const item of items || []) {
    const list = itemsByOrder.get(item.lab_order_id) || [];

    list.push({
      ...item,
      panel: item.test_panel_id ? panels.get(item.test_panel_id) || null : null,
      test: item.test_definition_id
        ? tests.get(item.test_definition_id) || null
        : null,
    });

    itemsByOrder.set(item.lab_order_id, list);
  }

  return orders.map((order) => ({
    ...order,
    patient: profiles.get(order.patient_id) || null,
    doctor: profiles.get(order.doctor_id) || null,
    items: itemsByOrder.get(order.id) || [],
  }));
}

export async function getLabDashboard() {
  const user = await getLabContext();

  if (!user) {
    return {
      newOrders: 0,
      inProgress: 0,
      draftReports: 0,
      readyToFinalize: 0,
      recentOrders: [],
    };
  }

  const supabase = await createClient();

  const { data: orders, error } = await supabase
    .from("lab_orders")
    .select(ORDER_SELECT)
    .eq("laboratory_id", user.id)
    .order("ordered_at", {
      ascending: false,
    })
    .limit(8);

  if (error) throw error;

  const recentOrders = await enrichOrders(supabase, orders || []);

  const { data: reports, error: reportsError } = await supabase
    .from("diagnostic_reports")
    .select("id, lab_order_id, status")
    .eq("laboratory_id", user.id)
    .in("status", ["draft", "final", "amended"]);

  if (reportsError) throw reportsError;

  const draftReports = (reports || []).filter(
    (report) => report.status === "draft",
  );

  return {
    newOrders: (orders || []).filter((order) => order.status === "pending")
      .length,

    inProgress: (orders || []).filter(
      (order) =>
        order.status === "received_by_lab" || order.status === "in_progress",
    ).length,

    draftReports: draftReports.length,

    readyToFinalize: draftReports.length,

    recentOrders,
  };
}

export async function getLabOrders(status = null) {
  const user = await getLabContext();

  if (!user) return [];

  const supabase = await createClient();

  let query = supabase
    .from("lab_orders")
    .select(ORDER_SELECT)
    .eq("laboratory_id", user.id)
    .order("ordered_at", {
      ascending: false,
    });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) throw error;

  return enrichOrders(supabase, data || []);
}

export async function getLabOrder(orderId) {
  const user = await getLabContext();

  if (!user || !orderId) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lab_orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .eq("laboratory_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [order] = await enrichOrders(supabase, [data]);

  const { data: reports, error: reportsError } = await supabase
    .from("diagnostic_reports")
    .select(
      "id, status, entered_by, finalized_by, finalized_at, created_at, updated_at",
    )
    .eq("lab_order_id", orderId)
    .eq("laboratory_id", user.id)
    .order("created_at", {
      ascending: false,
    });

  if (reportsError) throw reportsError;

  return {
    ...order,
    reports: reports || [],
  };
}

export async function getLabOrderTests(orderId) {
  const user = await getLabContext();

  if (!user || !orderId) return [];

  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("lab_orders")
    .select("id")
    .eq("id", orderId)
    .eq("laboratory_id", user.id)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) return [];

  const { data: items, error: itemsError } = await supabase
    .from("lab_order_items")
    .select("id, test_panel_id, test_definition_id")
    .eq("lab_order_id", orderId);

  if (itemsError) throw itemsError;

  const directTestIds = (items || [])
    .map((item) => item.test_definition_id)
    .filter(Boolean);

  const panelIds = (items || [])
    .map((item) => item.test_panel_id)
    .filter(Boolean);

  const [directTestsResult, panelItemsResult] = await Promise.all([
    directTestIds.length
      ? supabase
          .from("test_definitions")
          .select(
            "id, name, name_fa, internal_code, value_type, default_unit, decimal_precision, allows_negative",
          )
          .in("id", directTestIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    panelIds.length
      ? supabase
          .from("test_panel_items")
          .select("panel_id, test_definition_id, display_order, is_required")
          .in("panel_id", panelIds)
          .order("display_order", {
            ascending: true,
          })
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (directTestsResult.error) {
    throw directTestsResult.error;
  }

  if (panelItemsResult.error) {
    throw panelItemsResult.error;
  }

  const panelTestIds = (panelItemsResult.data || [])
    .map((item) => item.test_definition_id)
    .filter(Boolean);

  const missingPanelTestIds = [
    ...new Set(
      panelTestIds.filter(
        (id) => !(directTestsResult.data || []).some((test) => test.id === id),
      ),
    ),
  ];

  const { data: panelTests, error: panelTestsError } =
    missingPanelTestIds.length
      ? await supabase
          .from("test_definitions")
          .select(
            "id, name, name_fa, internal_code, value_type, default_unit, decimal_precision, allows_negative",
          )
          .in("id", missingPanelTestIds)
      : {
          data: [],
          error: null,
        };

  if (panelTestsError) {
    throw panelTestsError;
  }

  const testMap = new Map([
    ...(directTestsResult.data || []).map((test) => [test.id, test]),
    ...(panelTests || []).map((test) => [test.id, test]),
  ]);

  const result = [];

  for (const item of items || []) {
    if (item.test_definition_id) {
      const test = testMap.get(item.test_definition_id);

      if (test) {
        result.push({
          ...test,
          is_required: true,
        });
      }

      continue;
    }

    const panelItems = (panelItemsResult.data || []).filter(
      (panelItem) => panelItem.panel_id === item.test_panel_id,
    );

    for (const panelItem of panelItems) {
      const test = testMap.get(panelItem.test_definition_id);

      if (test) {
        result.push({
          ...test,
          is_required: panelItem.is_required !== false,
          display_order: panelItem.display_order,
        });
      }
    }
  }

  return [...new Map(result.map((test) => [test.id, test])).values()];
}

export async function getLabReport(reportId) {
  const user = await getLabContext();

  if (!user || !reportId) return null;

  const supabase = await createClient();

  const { data: report, error } = await supabase
    .from("diagnostic_reports")
    .select(
      "id, lab_order_id, laboratory_id, status, entered_by, finalized_by, finalized_at, created_at, updated_at",
    )
    .eq("id", reportId)
    .eq("laboratory_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!report) return null;

  const order = await getLabOrder(report.lab_order_id);

  if (!order) return null;

  const { data: observations, error: observationsError } = await supabase
    .from("observations")
    .select(
      "id, diagnostic_report_id, test_definition_id, value_numeric, value_text, value_boolean, unit, reference_min, reference_max, reference_text, flag, status, supersedes_observation_id, observed_at, created_at",
    )
    .eq("diagnostic_report_id", reportId)
    .order("created_at", {
      ascending: true,
    });

  if (observationsError) {
    throw observationsError;
  }

  const testIds = [
    ...new Set((observations || []).map((item) => item.test_definition_id)),
  ];

  const { data: tests, error: testsError } = testIds.length
    ? await supabase
        .from("test_definitions")
        .select(
          "id, name, name_fa, internal_code, value_type, default_unit, decimal_precision, allows_negative",
        )
        .in("id", testIds)
    : {
        data: [],
        error: null,
      };

  if (testsError) throw testsError;

  const testMap = new Map((tests || []).map((test) => [test.id, test]));

  return {
    ...report,
    order,
    observations: (observations || []).map((observation) => ({
      ...observation,
      test: testMap.get(observation.test_definition_id) || null,
    })),
  };
}

export async function getLabReports() {
  const user = await getLabContext();

  if (!user) return [];

  const supabase = await createClient();

  const { data: reports, error } = await supabase
    .from("diagnostic_reports")
    .select("id, lab_order_id, status, finalized_at, created_at, updated_at")
    .eq("laboratory_id", user.id)
    .order("created_at", {
      ascending: false,
    });

  if (error) throw error;
  if (!reports?.length) return [];

  const orderIds = [...new Set(reports.map((report) => report.lab_order_id))];

  const { data: orders, error: ordersError } = await supabase
    .from("lab_orders")
    .select("id, patient_id, doctor_id, status, ordered_at")
    .in("id", orderIds)
    .eq("laboratory_id", user.id);

  if (ordersError) throw ordersError;

  const profiles = await mapProfiles(
    (orders || []).flatMap((order) => [order.patient_id, order.doctor_id]),
  );

  const orderMap = new Map((orders || []).map((order) => [order.id, order]));

  return reports.map((report) => {
    const order = orderMap.get(report.lab_order_id);

    return {
      ...report,
      order_status: order?.status || null,
      ordered_at: order?.ordered_at || null,
      patient: order ? profiles.get(order.patient_id) || null : null,
      doctor: order ? profiles.get(order.doctor_id) || null : null,
    };
  });
}
