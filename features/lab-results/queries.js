import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { requirePatient } from "@/features/patient/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveReferenceRanges } from "@/features/lab-results/ranges";
import {
  getPatientResults as getPatientResultsContract,
  getPatientResult as getPatientResultContract,
  getPatientObservations as getPatientObservationsContract,
} from "@/features/patient/queries";
import { recordPatientAudit } from "@/features/patient/audit";

const FINAL_REPORT_STATUSES = ["final", "amended"];
const CURRENT_OBSERVATION_STATUSES = ["final", "corrected"];
const HISTORY_LIMIT = 100;

function assertReadableUser(user, patientId) {
  if (!user?.id) return false;

  if (user.role === "patient") return user.id === patientId;
  if (user.role === "doctor") return user.is_verified === true;
  if (user.role === "laboratory") return true;

  return false;
}

export async function getPatientReports(_ignoredPatientId) {
  return getPatientResultsContract();
}

export async function getPatientReport(reportId, _ignoredPatientId) {
  return getPatientResultContract(reportId);
}

export async function getPatientObservations(_ignoredPatientId, reportId) {
  return getPatientObservationsContract(null, reportId, { auditView: false });
}

export async function getDoctorLabReport(reportId) {
  const user = await getSessionUser();

  if (!user?.id || user.role !== "doctor" || user.is_verified !== true) {
    return null;
  }

  if (!reportId) return null;

  const supabase = await createClient();

  const { data: report, error } = await supabase
    .from("diagnostic_reports")
    .select(
      `
        id,
        lab_order_id,
        laboratory_id,
        status,
        entered_by,
        finalized_by,
        finalized_at,
        created_at,
        updated_at,
        lab_orders!diagnostic_reports_lab_order_id_fkey!inner (
          id,
          patient_id,
          doctor_id,
          laboratory_id,
          status,
          clinical_note,
          ordered_at,
          received_at,
          completed_at,
          cancelled_at
        )
      `,
    )
    .eq("id", reportId)
    .eq("lab_orders.doctor_id", user.id)
    .in("status", FINAL_REPORT_STATUSES)
    .maybeSingle();

  if (error) throw error;
  if (!report) return null;

  const { data: observations, error: observationsError } = await supabase
    .from("observations")
    .select(
      "id, diagnostic_report_id, test_definition_id, value_numeric, value_text, value_boolean, unit, reference_range_template_id, reference_min, reference_max, reference_text, reference_source, flag, status, supersedes_observation_id, observed_at, created_at, test_definitions(id, name, name_fa, internal_code, value_type, default_unit, decimal_precision)",
    )
    .eq("diagnostic_report_id", reportId)
    .in("status", CURRENT_OBSERVATION_STATUSES)
    .order("observed_at", { ascending: true });

  if (observationsError) throw observationsError;

  try {
    await createAdminClient().from("audit_logs").insert({
      actor_id: user.id,
      action: "result_viewed",
      entity_type: "diagnostic_report",
      entity_id: reportId,
      metadata: {
        source: "doctor_review",
      },
    });
  } catch (auditError) {
    console.error("[getDoctorLabReport:audit]", auditError);
  }

  return {
    ...report,
    order: report.lab_orders,
    observations: observations || [],
  };
}

export async function getReferenceRange(patientId, testDefinitionId) {
  const user = await getSessionUser();

  if (user?.role !== "laboratory" || !user.id || !patientId || !testDefinitionId) {
    return null;
  }

  const admin = createAdminClient();
  const ranges = await resolveReferenceRanges({
    admin,
    laboratoryId: user.id,
    patientId,
    testDefinitionIds: [testDefinitionId],
  });

  const range = ranges.get(testDefinitionId) || null;
  if (!range) return null;

  return {
    id: range.id,
    test_definition_id: range.test_definition_id,
    laboratory_id: range.laboratory_id,
    sex: range.sex,
    min_age_years: range.min_age_years,
    max_age_years: range.max_age_years,
    min_value: range.min_value,
    max_value: range.max_value,
    unit: range.unit,
    method: range.method,
    source: range.laboratory_id === null ? "generic" : "laboratory",
  };
}

export async function getResultHistory(
  patientId,
  testDefinitionId,
  { limit = HISTORY_LIMIT } = {},
) {
  const user = await getSessionUser();

  if (!assertReadableUser(user, patientId) || !testDefinitionId) {
    return [];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || HISTORY_LIMIT, 1), HISTORY_LIMIT);
  const supabase = await createClient();

  const { data: reports, error: reportsError } = await supabase
    .from("diagnostic_reports")
    .select(
      `
        id,
        finalized_at,
        lab_order_id,
        lab_orders!diagnostic_reports_lab_order_id_fkey!inner (
          id,
          patient_id,
          doctor_id,
          laboratory_id,
          ordered_at
        )
      `,
    )
    .eq("lab_orders.patient_id", patientId)
    .in("status", FINAL_REPORT_STATUSES)
    .order("finalized_at", { ascending: false });

  if (reportsError) throw reportsError;
  if (!reports?.length) return [];

  const reportIds = reports.map((report) => report.id);

  const { data: observations, error: observationsError } = await supabase
    .from("observations")
    .select(
      "id, diagnostic_report_id, test_definition_id, value_numeric, value_text, value_boolean, unit, reference_range_template_id, reference_min, reference_max, reference_text, reference_source, flag, status, observed_at, created_at, supersedes_observation_id, test_definitions(id, name, name_fa, internal_code, value_type, default_unit, decimal_precision)",
    )
    .in("diagnostic_report_id", reportIds)
    .eq("test_definition_id", testDefinitionId)
    .in("status", CURRENT_OBSERVATION_STATUSES)
    .order("observed_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (observationsError) throw observationsError;

  const reportMap = new Map(reports.map((report) => [report.id, report]));

  return (observations || []).slice(0, safeLimit).map((observation) => {
    const report = reportMap.get(observation.diagnostic_report_id);
    return {
      ...observation,
      report: report || null,
      patient_id: patientId,
      ordered_at: report?.lab_orders?.ordered_at || null,
      finalized_at: report?.finalized_at || null,
    };
  });
}

export async function getResultComparison({
  patientId,
  testDefinitionId,
  currentObservationId = null,
}) {
  const history = await getResultHistory(patientId, testDefinitionId);

  if (!history.length) return null;

  const currentIndex = currentObservationId
    ? history.findIndex((item) => item.id === currentObservationId)
    : 0;

  const index = currentIndex >= 0 ? currentIndex : 0;
  const current = history[index] || null;
  const previous = history[index + 1] || null;

  if (!current) return null;

  const currentNumeric = current.value_numeric;
  const previousNumeric = previous?.value_numeric ?? null;

  let difference = null;
  let direction = previous ? "stable" : "new";

  if (currentNumeric != null && previousNumeric != null) {
    difference = Number(currentNumeric) - Number(previousNumeric);
    direction =
      difference > 0 ? "up" : difference < 0 ? "down" : "stable";
  }

  return {
    current,
    previous,
    currentValue: currentNumeric ?? current.value_text ?? current.value_boolean,
    previousValue:
      previousNumeric ?? previous?.value_text ?? previous?.value_boolean ?? null,
    difference,
    direction,
  };
}

export async function resolveTestDefinition(orderId, key) {
  const user = await getSessionUser();

  if (!user?.id || user.role !== "laboratory" || !orderId || !key) {
    return null;
  }

  const supabase = await createClient();
  const normalized = String(key).trim().toLowerCase();

  const { data: order, error: orderError } = await supabase
    .from("lab_orders")
    .select("id, laboratory_id")
    .eq("id", orderId)
    .eq("laboratory_id", user.id)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) return null;

  const { data: items, error: itemsError } = await supabase
    .from("lab_order_items")
    .select("test_definition_id, test_panel_id")
    .eq("lab_order_id", orderId);

  if (itemsError) throw itemsError;

  const testIds = new Set(
    (items || []).map((item) => item.test_definition_id).filter(Boolean),
  );

  const panelIds = (items || []).map((item) => item.test_panel_id).filter(Boolean);

  if (panelIds.length) {
    const { data: panelItems, error: panelItemsError } = await supabase
      .from("test_panel_items")
      .select("test_definition_id")
      .in("panel_id", panelIds);

    if (panelItemsError) throw panelItemsError;

    for (const item of panelItems || []) testIds.add(item.test_definition_id);
  }

  if (!testIds.size) return null;

  const { data: tests, error: testsError } = await supabase
    .from("test_definitions")
    .select("id, name, name_fa, internal_code, value_type, default_unit, decimal_precision, allows_negative")
    .in("id", [...testIds]);

  if (testsError) throw testsError;

  const exact = (tests || []).find((test) =>
    test.id.toLowerCase() === normalized ||
    String(test.internal_code || "").toLowerCase() === normalized,
  );

  if (exact) return exact;

  const { data: aliases, error: aliasesError } = await supabase
    .from("test_aliases")
    .select("alias, test_definition_id, source_lab_id")
    .in("test_definition_id", [...testIds]);

  if (aliasesError) throw aliasesError;

  const alias = (aliases || []).find(
    (item) =>
      String(item.alias || "").trim().toLowerCase() === normalized &&
      (!item.source_lab_id || item.source_lab_id === user.id),
  );

  if (!alias) return null;

  return (tests || []).find((test) => test.id === alias.test_definition_id) || null;
}
