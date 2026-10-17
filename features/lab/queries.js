import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { DEFAULT_PAGE_SIZE, makePagination, normalizePage, normalizePageSize } from "@/lib/pagination";
import {
  buildReferenceSnapshot,
  resolveReferenceRanges,
} from "@/features/lab-results/ranges";

const ORDER_SELECT =
  "id, patient_id, doctor_id, laboratory_id, status, clinical_note, ordered_at, received_at, completed_at, cancelled_at, created_at";

const VALID_LAB_ORDER_STATUSES = new Set([
  "pending",
  "received_by_lab",
  "in_progress",
  "completed",
  "cancelled",
]);

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

  if (!uniqueIds.length) return new Map();

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, phone")
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

  const panelIds = [...new Set((items || []).map((item) => item.test_panel_id).filter(Boolean))];
  const directTestIds = [...new Set((items || []).map((item) => item.test_definition_id).filter(Boolean))];

  const [panelsResult, directTestsResult, panelItemsResult] = await Promise.all([
    panelIds.length
      ? supabase.from("test_panels").select("id, code, name, name_fa").in("id", panelIds)
      : Promise.resolve({ data: [], error: null }),
    directTestIds.length
      ? supabase
          .from("test_definitions")
          .select("id, name, name_fa, internal_code, value_type, default_unit, decimal_precision, allows_negative")
          .in("id", directTestIds)
      : Promise.resolve({ data: [], error: null }),
    panelIds.length
      ? supabase
          .from("test_panel_items")
          .select("panel_id, test_definition_id, display_order, is_required")
          .in("panel_id", panelIds)
          .order("display_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (panelsResult.error) throw panelsResult.error;
  if (directTestsResult.error) throw directTestsResult.error;
  if (panelItemsResult.error) throw panelItemsResult.error;

  const panelTestIds = [...new Set((panelItemsResult.data || []).map((item) => item.test_definition_id).filter(Boolean))];
  const missingPanelTestIds = panelTestIds.filter(
    (id) => !(directTestsResult.data || []).some((test) => test.id === id),
  );

  const { data: panelTests, error: panelTestsError } = missingPanelTestIds.length
    ? await supabase
        .from("test_definitions")
        .select("id, name, name_fa, internal_code, value_type, default_unit, decimal_precision, allows_negative")
        .in("id", missingPanelTestIds)
    : { data: [], error: null };

  if (panelTestsError) throw panelTestsError;

  const panels = new Map((panelsResult.data || []).map((row) => [row.id, row]));
  const tests = new Map([
    ...(directTestsResult.data || []).map((row) => [row.id, row]),
    ...(panelTests || []).map((row) => [row.id, row]),
  ]);

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

async function getLabOrderTestsForDashboard(supabase, orderIds) {
  const result = new Map();

  if (!orderIds.length) return result;

  const { data: items, error } = await supabase
    .from("lab_order_items")
    .select("lab_order_id, test_panel_id, test_definition_id")
    .in("lab_order_id", orderIds);

  if (error) throw error;

  const panelIds = [...new Set((items || []).map((item) => item.test_panel_id).filter(Boolean))];
  const directIds = [...new Set((items || []).map((item) => item.test_definition_id).filter(Boolean))];

  const [panelItemsResult, directTestsResult] = await Promise.all([
    panelIds.length
      ? supabase.from("test_panel_items").select("panel_id, test_definition_id, is_required, display_order").in("panel_id", panelIds)
      : Promise.resolve({ data: [], error: null }),
    directIds.length
      ? supabase.from("test_definitions").select("id, name, name_fa, internal_code, value_type, default_unit, decimal_precision, allows_negative").in("id", directIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (panelItemsResult.error) throw panelItemsResult.error;
  if (directTestsResult.error) throw directTestsResult.error;

  const panelTestIds = [...new Set((panelItemsResult.data || []).map((item) => item.test_definition_id).filter(Boolean))];
  const missing = panelTestIds.filter((id) => !(directTestsResult.data || []).some((test) => test.id === id));

  const { data: panelTests, error: panelTestsError } = missing.length
    ? await supabase.from("test_definitions").select("id, name, name_fa, internal_code, value_type, default_unit, decimal_precision, allows_negative").in("id", missing)
    : { data: [], error: null };

  if (panelTestsError) throw panelTestsError;

  const tests = new Map([
    ...(directTestsResult.data || []).map((test) => [test.id, test]),
    ...(panelTests || []).map((test) => [test.id, test]),
  ]);

  for (const orderId of orderIds) result.set(orderId, []);

  for (const item of items || []) {
    const list = result.get(item.lab_order_id) || [];

    if (item.test_definition_id) {
      const test = tests.get(item.test_definition_id);
      if (test) list.push({ ...test, is_required: true });
      result.set(item.lab_order_id, list);
      continue;
    }

    for (const panelItem of panelItemsResult.data || []) {
      if (panelItem.panel_id !== item.test_panel_id) continue;
      const test = tests.get(panelItem.test_definition_id);
      if (test) {
        list.push({
          ...test,
          is_required: panelItem.is_required !== false,
          display_order: panelItem.display_order,
        });
      }
    }

    result.set(item.lab_order_id, list);
  }

  for (const [orderId, testsForOrder] of result.entries()) {
    const merged = new Map();
    for (const test of testsForOrder) {
      const existing = merged.get(test.id);
      if (!existing) {
        merged.set(test.id, { ...test, is_required: test.is_required !== false });
        continue;
      }

      merged.set(test.id, {
        ...existing,
        ...test,
        is_required: existing.is_required === true || test.is_required !== false,
        display_order:
          existing.display_order === undefined
            ? test.display_order
            : test.display_order === undefined
              ? existing.display_order
              : Math.min(existing.display_order, test.display_order),
      });
    }
    result.set(orderId, [...merged.values()]);
  }

  return result;
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

  const [pendingResult, inProgressResult, recentResult, reportsResult] =
    await Promise.all([
      supabase
        .from("lab_orders")
        .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      supabase
        .from("lab_orders")
        .select("id", { count: "exact", head: true })
          .eq("status", "in_progress"),
      supabase
        .from("lab_orders")
        .select(ORDER_SELECT)
          .order("ordered_at", { ascending: false })
        .limit(8),
      supabase
        .from("diagnostic_reports")
        .select("id, lab_order_id, status")
          .eq("status", "draft"),
    ]);

  if (pendingResult.error) throw pendingResult.error;
  if (inProgressResult.error) throw inProgressResult.error;
  if (recentResult.error) throw recentResult.error;
  if (reportsResult.error) throw reportsResult.error;

  const recentOrders = await enrichOrders(supabase, recentResult.data || []);
  const draftReports = reportsResult.data || [];
  const draftOrderIds = draftReports.map((report) => report.lab_order_id);

  let readyToFinalize = 0;

  if (draftReports.length) {
    const { data: draftOrders, error: draftOrdersError } = await supabase
      .from("lab_orders")
      .select("id, status")
      .in("id", draftOrderIds)

    if (draftOrdersError) throw draftOrdersError;

    const inProgressDrafts = (draftOrders || [])
      .filter((order) => order.status === "in_progress")
      .map((order) => order.id);

    if (inProgressDrafts.length) {
      const testsByOrder = await getLabOrderTestsForDashboard(
        supabase,
        inProgressDrafts,
      );

      const { data: preliminary, error: preliminaryError } = await supabase
        .from("observations")
        .select("diagnostic_report_id, test_definition_id")
        .in(
          "diagnostic_report_id",
          draftReports
            .filter((report) => inProgressDrafts.includes(report.lab_order_id))
            .map((report) => report.id),
        )
        .eq("status", "preliminary");

      if (preliminaryError) throw preliminaryError;

      const preliminaryByReport = new Map();
      for (const row of preliminary || []) {
        const set = preliminaryByReport.get(row.diagnostic_report_id) || new Set();
        set.add(row.test_definition_id);
        preliminaryByReport.set(row.diagnostic_report_id, set);
      }

      const orderById = new Map((draftOrders || []).map((order) => [order.id, order]));

      for (const report of draftReports) {
        const order = orderById.get(report.lab_order_id);
        if (!order || order.status !== "in_progress") continue;

        const required = (testsByOrder.get(order.id) || [])
          .filter((test) => test.is_required)
          .map((test) => test.id);

        const present = preliminaryByReport.get(report.id) || new Set();

        if (required.length > 0 && required.every((testId) => present.has(testId))) {
          readyToFinalize += 1;
        }
      }
    }
  }

  return {
    newOrders: pendingResult.count || 0,
    inProgress: inProgressResult.count || 0,
    draftReports: draftReports.length,
    readyToFinalize,
    recentOrders,
  };
}

export async function getLabOrders(status = null, { page: requestedPage = 1, pageSize: requestedPageSize = DEFAULT_PAGE_SIZE } = {}) {
  const user = await getLabContext();
  if (!user) return { items: [], pagination: makePagination({ page: 1, pageSize: requestedPageSize, totalCount: 0 }) };

  if (status && !VALID_LAB_ORDER_STATUSES.has(status)) {
    return { items: [], pagination: makePagination({ page: 1, pageSize: requestedPageSize, totalCount: 0 }) };
  }

  const supabase = await createClient();
  const pageSize = normalizePageSize(requestedPageSize);
  let page = normalizePage(requestedPage);
  const makeQuery = () => {
    let query = supabase
      .from("lab_orders")
      .select(ORDER_SELECT, { count: "exact" })
      .order("ordered_at", { ascending: false })
      .order("id", { ascending: true });
    if (status) query = query.eq("status", status);
    return query;
  };

  let result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
  if (result.error) throw result.error;
  const totalCount = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount > 0 && page > totalPages) {
    page = totalPages;
    result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
    if (result.error) throw result.error;
  }

  return {
    items: await enrichOrders(supabase, result.data || []),
    pagination: makePagination({ page, pageSize, totalCount }),
  };
}

export async function getLabOrder(orderId) {
  const user = await getLabContext();
  if (!user || !orderId) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lab_orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [order] = await enrichOrders(supabase, [data]);

  const { data: reports, error: reportsError } = await supabase
    .from("diagnostic_reports")
    .select("id, status, entered_by, finalized_by, finalized_at, created_at, updated_at")
    .eq("lab_order_id", orderId)
    .order("created_at", { ascending: false });

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
    .select("id, patient_id, laboratory_id")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) return [];

  const { data: items, error: itemsError } = await supabase
    .from("lab_order_items")
    .select("id, test_panel_id, test_definition_id")
    .eq("lab_order_id", orderId);

  if (itemsError) throw itemsError;

  const directTestIds = (items || []).map((item) => item.test_definition_id).filter(Boolean);
  const panelIds = (items || []).map((item) => item.test_panel_id).filter(Boolean);

  const [directTestsResult, panelItemsResult] = await Promise.all([
    directTestIds.length
      ? supabase
          .from("test_definitions")
          .select("id, name, name_fa, internal_code, value_type, default_unit, decimal_precision, allows_negative")
          .in("id", directTestIds)
      : Promise.resolve({ data: [], error: null }),
    panelIds.length
      ? supabase
          .from("test_panel_items")
          .select("panel_id, test_definition_id, display_order, is_required")
          .in("panel_id", panelIds)
          .order("display_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (directTestsResult.error) throw directTestsResult.error;
  if (panelItemsResult.error) throw panelItemsResult.error;

  const panelTestIds = (panelItemsResult.data || []).map((item) => item.test_definition_id).filter(Boolean);
  const missingPanelTestIds = [...new Set(panelTestIds)].filter(
    (id) => !(directTestsResult.data || []).some((test) => test.id === id),
  );

  const { data: panelTests, error: panelTestsError } = missingPanelTestIds.length
    ? await supabase
        .from("test_definitions")
        .select("id, name, name_fa, internal_code, value_type, default_unit, decimal_precision, allows_negative")
        .in("id", missingPanelTestIds)
    : { data: [], error: null };

  if (panelTestsError) throw panelTestsError;

  const testMap = new Map([
    ...(directTestsResult.data || []).map((test) => [test.id, test]),
    ...(panelTests || []).map((test) => [test.id, test]),
  ]);

  const result = [];

  for (const item of items || []) {
    if (item.test_definition_id) {
      const test = testMap.get(item.test_definition_id);
      if (test) result.push({ ...test, is_required: true });
      continue;
    }

    for (const panelItem of panelItemsResult.data || []) {
      if (panelItem.panel_id !== item.test_panel_id) continue;
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

  const mergedTests = new Map();
  for (const test of result) {
    const existing = mergedTests.get(test.id);
    if (!existing) {
      mergedTests.set(test.id, { ...test, is_required: test.is_required !== false });
      continue;
    }

    mergedTests.set(test.id, {
      ...existing,
      ...test,
      is_required: existing.is_required === true || test.is_required !== false,
      display_order:
        existing.display_order === undefined
          ? test.display_order
          : test.display_order === undefined
            ? existing.display_order
            : Math.min(existing.display_order, test.display_order),
    });
  }
  const uniqueTests = [...mergedTests.values()];

  const ranges = await resolveReferenceRanges({
    admin: createAdminClient(),
    laboratoryId: order.laboratory_id,
    patientId: order.patient_id,
    testDefinitionIds: uniqueTests.map((test) => test.id),
  });

  return uniqueTests.map((test) => {
    const snapshot = buildReferenceSnapshot(test, ranges.get(test.id) || null);

    return {
      ...test,
      reference_range_template_id:
        snapshot.ok === false ? null : snapshot.reference_range_template_id,
      reference_min: snapshot.ok === false ? null : snapshot.reference_min,
      reference_max: snapshot.ok === false ? null : snapshot.reference_max,
      reference_text: snapshot.ok === false ? null : snapshot.reference_text,
      reference_unit: snapshot.ok === false ? null : snapshot.unit,
      reference_source: snapshot.ok === false ? null : snapshot.reference_source,
    };
  });
}

export async function getLabReportAttachments(reportId, { auditAccess = true } = {}) {
  const user = await getLabContext();
  if (!user || !reportId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("id, diagnostic_report_id, uploaded_by, file_name, file_type, file_size_bytes, storage_path, created_at")
    .eq("diagnostic_report_id", reportId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data?.length) return [];

  const admin = createAdminClient();
  const result = [];

  for (const attachment of data) {
    // The row is already scoped by RLS for this report. Validate that its
    // object path belongs to the recorded uploader and this exact report;
    // branch members must be able to read one another's legitimate uploads.
    if (
      attachment.file_type !== "application/pdf" ||
      !attachment.uploaded_by ||
      !attachment.storage_path?.startsWith(`${attachment.uploaded_by}/${reportId}/`) ||
      !Number.isFinite(Number(attachment.file_size_bytes)) ||
      Number(attachment.file_size_bytes) < 1 ||
      Number(attachment.file_size_bytes) > 10 * 1024 * 1024
    ) {
      continue;
    }

    const { data: signed, error: signedError } = await admin.storage
      .from("pab-lab-result-attachments")
      .createSignedUrl(attachment.storage_path, 300);

    if (signedError) {
      console.error("[getLabReportAttachments:signedUrl]", signedError);
      continue;
    }

    if (auditAccess) {
      try {
        await admin.from("audit_logs").insert({
          actor_id: user.id,
          action: "attachment_accessed",
          entity_type: "attachment",
          entity_id: attachment.id,
          metadata: {
            diagnostic_report_id: reportId,
            file_type: attachment.file_type,
          },
        });
      } catch (auditError) {
        console.error("[getLabReportAttachments:audit]", auditError);
      }
    }

    result.push({
      ...attachment,
      signed_url: signed?.signedUrl || null,
    });
  }

  return result;
}

export async function getLabReport(
  reportId,
  { auditView = false, includeAttachments = false } = {},
) {
  const user = await getLabContext();
  if (!user || !reportId) return null;

  const supabase = await createClient();

  const { data: report, error } = await supabase
    .from("diagnostic_reports")
    .select("id, lab_order_id, laboratory_id, status, entered_by, finalized_by, finalized_at, created_at, updated_at")
    .eq("id", reportId)
    .maybeSingle();

  if (error) throw error;
  if (!report) return null;

  const order = await getLabOrder(report.lab_order_id);
  if (!order) return null;

  const { data: observations, error: observationsError } = await supabase
    .from("observations")
    .select("id, diagnostic_report_id, test_definition_id, value_numeric, value_text, value_boolean, unit, reference_range_template_id, reference_min, reference_max, reference_text, reference_source, flag, status, supersedes_observation_id, entered_by, observed_at, created_at")
    .eq("diagnostic_report_id", reportId)
    .order("created_at", { ascending: true });

  if (observationsError) throw observationsError;

  const testIds = [...new Set((observations || []).map((item) => item.test_definition_id))];

  const { data: tests, error: testsError } = testIds.length
    ? await supabase
        .from("test_definitions")
        .select("id, name, name_fa, internal_code, value_type, default_unit, decimal_precision, allows_negative")
        .in("id", testIds)
    : { data: [], error: null };

  if (testsError) throw testsError;

  const referenceIds = [...new Set((observations || []).map((item) => item.reference_range_template_id).filter(Boolean))];
  const { data: references, error: referencesError } = referenceIds.length
    ? await supabase
        .from("reference_range_templates")
        .select("id, laboratory_id, unit, method")
        .in("id", referenceIds)
    : { data: [], error: null };

  if (referencesError) throw referencesError;

  const testMap = new Map((tests || []).map((test) => [test.id, test]));
  const referenceMap = new Map((references || []).map((reference) => [reference.id, reference]));

  if (auditView) {
    try {
      const admin = createAdminClient();
      await admin.from("audit_logs").insert({
        actor_id: user.id,
        action: "result_viewed",
        entity_type: "diagnostic_report",
        entity_id: report.id,
        metadata: {
          lab_order_id: report.lab_order_id,
        },
      });
    } catch (auditError) {
      console.error("[getLabReport:audit]", auditError);
    }
  }

  const attachments = includeAttachments
    ? await getLabReportAttachments(reportId, { auditAccess: auditView })
    : [];

  return {
    ...report,
    order,
    attachments,
    observations: (observations || []).map((observation) => {
      const reference = referenceMap.get(observation.reference_range_template_id);

      return {
        ...observation,
        test: testMap.get(observation.test_definition_id) || null,
        reference_source:
          observation.reference_source ||
          (reference
            ? reference.laboratory_id === order.laboratory_id
              ? "laboratory"
              : "generic"
            : null),
      };
    }),
  };
}

async function getReadyToFinalizeReportsPage(supabase, requestedPage, pageSize) {
  const pageSizeSafe = normalizePageSize(pageSize);
  const requested = normalizePage(requestedPage);
  const targetCount = requested * pageSizeSafe + 1;
  const candidateBatchSize = 100;
  let offset = 0;
  let exhausted = false;
  const ready = [];

  // This status is derived from the order and required-observation coverage.
  // Scan bounded batches until this page plus one look-ahead result is found.
  while (!exhausted && ready.length < targetCount) {
    const { data: candidates, error: candidateError } = await supabase
      .from("diagnostic_reports")
      .select("id, lab_order_id, status, finalized_at, created_at, updated_at")
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + candidateBatchSize - 1);

    if (candidateError) throw candidateError;
    if (!candidates?.length) {
      exhausted = true;
      break;
    }
    offset += candidates.length;
    if (candidates.length < candidateBatchSize) exhausted = true;

    const orderIds = [...new Set(candidates.map((report) => report.lab_order_id).filter(Boolean))];
    if (!orderIds.length) continue;
    const { data: orders, error: ordersError } = await supabase
      .from("lab_orders")
      .select("id, patient_id, doctor_id, status, ordered_at")
      .in("id", orderIds);
    if (ordersError) throw ordersError;

    const orderMap = new Map((orders || []).map((order) => [order.id, order]));
    const inProgress = candidates.filter((report) => orderMap.get(report.lab_order_id)?.status === "in_progress");
    if (!inProgress.length) continue;

    const inProgressOrderIds = [...new Set(inProgress.map((report) => report.lab_order_id))];
    const testsByOrder = await getLabOrderTestsForDashboard(supabase, inProgressOrderIds);
    const reportIds = inProgress.map((report) => report.id);
    const { data: preliminary, error: preliminaryError } = await supabase
      .from("observations")
      .select("diagnostic_report_id, test_definition_id")
      .in("diagnostic_report_id", reportIds)
      .eq("status", "preliminary");
    if (preliminaryError) throw preliminaryError;

    const preliminaryByReport = new Map();
    for (const row of preliminary || []) {
      const set = preliminaryByReport.get(row.diagnostic_report_id) || new Set();
      set.add(row.test_definition_id);
      preliminaryByReport.set(row.diagnostic_report_id, set);
    }

    for (const report of inProgress) {
      const required = (testsByOrder.get(report.lab_order_id) || [])
        .filter((test) => test.is_required)
        .map((test) => test.id);
      const present = preliminaryByReport.get(report.id) || new Set();
      if (!required.length || !required.every((testId) => present.has(testId))) continue;

      const order = orderMap.get(report.lab_order_id);
      ready.push({
        ...report,
        order_status: order?.status || null,
        ordered_at: order?.ordered_at || null,
        _patient_id: order?.patient_id || null,
        _doctor_id: order?.doctor_id || null,
      });
    }
  }

  const hasNextPage = ready.length > requested * pageSizeSafe;
  let page = requested;
  let totalCount = null;
  let totalPages = null;
  if (exhausted) {
    totalCount = ready.length;
    totalPages = Math.max(1, Math.ceil(totalCount / pageSizeSafe));
    page = Math.min(requested, totalPages);
  }

  const start = (page - 1) * pageSizeSafe;
  const items = ready.slice(start, start + pageSizeSafe);
  const profileIds = [...new Set(items.flatMap((report) => [report._patient_id, report._doctor_id]).filter(Boolean))];
  const profiles = await mapProfiles(profileIds);
  const enriched = items.map((report) => {
    const { _patient_id, _doctor_id, ...safeReport } = report;
    return {
      ...safeReport,
      patient: _patient_id ? profiles.get(_patient_id) || null : null,
      doctor: _doctor_id ? profiles.get(_doctor_id) || null : null,
    };
  });

  return {
    items: enriched,
    pagination: {
      page,
      pageSize: pageSizeSafe,
      totalCount,
      totalPages,
      hasNextPage: totalPages === null ? hasNextPage : page < totalPages,
    },
  };
}

export async function getLabReports(status = null, { page: requestedPage = 1, pageSize: requestedPageSize = DEFAULT_PAGE_SIZE } = {}) {
  const user = await getLabContext();
  const pageSize = normalizePageSize(requestedPageSize);
  if (!user) return { items: [], pagination: { page: 1, pageSize, totalCount: 0, totalPages: 1, hasNextPage: false } };

  const allowedStatuses = new Set(["draft", "final", "amended", "ready_to_finalize"]);
  if (status && !allowedStatuses.has(status)) {
    return { items: [], pagination: { page: 1, pageSize, totalCount: 0, totalPages: 1, hasNextPage: false } };
  }

  const supabase = await createClient();
  if (status === "ready_to_finalize") {
    return getReadyToFinalizeReportsPage(supabase, requestedPage, pageSize);
  }

  let page = normalizePage(requestedPage);
  const makeQuery = () => {
    let query = supabase
      .from("diagnostic_reports")
      .select("id, lab_order_id, status, finalized_at, created_at, updated_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    if (status) query = query.eq("status", status);
    return query;
  };

  let result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
  if (result.error) throw result.error;
  const totalCount = result.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount > 0 && page > totalPages) {
    page = totalPages;
    result = await makeQuery().range((page - 1) * pageSize, page * pageSize - 1);
    if (result.error) throw result.error;
  }

  const reports = result.data || [];
  if (!reports.length) {
    return { items: [], pagination: makePagination({ page, pageSize, totalCount }) };
  }

  const orderIds = [...new Set(reports.map((report) => report.lab_order_id))];
  const { data: orders, error: ordersError } = await supabase
    .from("lab_orders")
    .select("id, patient_id, doctor_id, status, ordered_at")
    .in("id", orderIds)
  if (ordersError) throw ordersError;

  const profiles = await mapProfiles((orders || []).flatMap((order) => [order.patient_id, order.doctor_id]));
  const orderMap = new Map((orders || []).map((order) => [order.id, order]));
  const items = reports.map((report) => {
    const order = orderMap.get(report.lab_order_id);
    return {
      ...report,
      order_status: order?.status || null,
      ordered_at: order?.ordered_at || null,
      patient: order ? profiles.get(order.patient_id) || null : null,
      doctor: order ? profiles.get(order.doctor_id) || null : null,
    };
  });

  return { items, pagination: makePagination({ page, pageSize, totalCount }) };
}
