import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getStatusLabel } from "@/lib/constants/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePatient } from "@/features/patient/auth";
import { recordPatientAudit } from "@/features/patient/audit";
import { requireVerifiedDoctor } from "@/features/doctor/access";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  getPageBounds,
  makePagination,
  normalizePage,
  normalizePageSize,
} from "@/lib/pagination";

const FINAL_REPORT_STATUSES = ["final", "amended"];
const CURRENT_OBSERVATION_STATUSES = ["final", "corrected"];
const FOLLOW_UP_STATUSES = ["pending", "completed", "overdue", "cancelled"];
const MAX_HISTORY = 100;
const MAX_TIMELINE = 100;
const MAX_HOME_RESULTS = 5;
const MAX_HOME_PRESCRIPTIONS = 5;

const EMPTY_DOCTOR_PATIENT_PAGE = {
  items: [],
  pagination: makePagination({ page: 1, pageSize: DEFAULT_PAGE_SIZE, totalCount: 0 }),
};

/**
 * Reads one bounded page of patients linked to the authenticated, verified doctor.
 * Relationship rows are paged first; patient profile data is loaded only for that page.
 */
async function queryDoctorPatientsPage(supabase, doctorId, { page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const safePageSize = normalizePageSize(pageSize, DEFAULT_PAGE_SIZE);
  let safePage = normalizePage(page);
  const bounds = getPageBounds(safePage, safePageSize);

  const makeQuery = () => supabase
    .from("patient_doctor_relationships")
    .select("patient_id, started_at", { count: "exact" })
    .eq("doctor_id", doctorId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .order("patient_id", { ascending: true });

  let { data: relationships, count, error } = await makeQuery().range(bounds.from, bounds.to);
  if (error) throw error;

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
  if (safePage > totalPages) {
    safePage = totalPages;
    const correctedBounds = getPageBounds(safePage, safePageSize);
    const corrected = await makeQuery().range(correctedBounds.from, correctedBounds.to);
    if (corrected.error) throw corrected.error;
    relationships = corrected.data;
  }

  const patientIds = [...new Set((relationships ?? []).map((row) => row.patient_id).filter(Boolean))];
  const pagination = makePagination({ page: safePage, pageSize: safePageSize, totalCount });
  if (!patientIds.length) return { items: [], pagination };

  const [profilesResult, patientProfilesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, national_id, phone")
      .eq("role", "patient")
      .in("id", patientIds),
    supabase
      .from("patient_profiles")
      .select("id, date_of_birth")
      .in("id", patientIds),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (patientProfilesResult.error) throw patientProfilesResult.error;

  const profilesById = new Map((profilesResult.data ?? []).map((row) => [row.id, row]));
  const patientProfilesById = new Map((patientProfilesResult.data ?? []).map((row) => [row.id, row]));
  const items = (relationships ?? []).flatMap((relationship) => {
    const profile = profilesById.get(relationship.patient_id);
    if (!profile) return [];
    return [{
      ...profile,
      patientProfile: patientProfilesById.get(profile.id) ?? null,
      relationship_started_at: relationship.started_at ?? null,
    }];
  });

  return { items, pagination };
}

/** Paginated patient list for the authenticated verified doctor. */
export async function getDoctorPatientsPage(doctorId, options = {}) {
  const doctor = await requireVerifiedDoctor();
  if (!doctor?.id || doctor.id !== doctorId) return EMPTY_DOCTOR_PATIENT_PAGE;
  const supabase = await createClient();
  return queryDoctorPatientsPage(supabase, doctor.id, options);
}

/** Backward-compatible patient options for existing form selectors. Each database read is bounded. */
export async function getDoctorPatients(doctorId) {
  const doctor = await requireVerifiedDoctor();
  if (!doctor?.id || doctor.id !== doctorId) return [];
  const supabase = await createClient();
  const pageSize = MAX_PAGE_SIZE;
  const firstPage = await queryDoctorPatientsPage(supabase, doctor.id, { page: 1, pageSize });
  const allPatients = [...firstPage.items];
  for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
    const result = await queryDoctorPatientsPage(supabase, doctor.id, { page, pageSize });
    allPatients.push(...result.items);
  }
  return allPatients;
}

/** Returns one patient only when an active relationship with this doctor exists. */
export async function getDoctorPatient(doctorId, patientId) {
  const doctor = await requireVerifiedDoctor();
  if (!doctor?.id || doctor.id !== doctorId || typeof patientId !== "string" || !patientId) return null;

  const supabase = await createClient();
  const { data: relationship, error: relationshipError } = await supabase
    .from("patient_doctor_relationships")
    .select("patient_id, started_at")
    .eq("doctor_id", doctor.id)
    .eq("patient_id", patientId)
    .eq("status", "active")
    .maybeSingle();
  if (relationshipError) throw relationshipError;
  if (!relationship) return null;

  const [profileResult, patientProfileResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, full_name, national_id, phone")
      .eq("id", patientId)
      .eq("role", "patient")
      .maybeSingle(),
    supabase
      .from("patient_profiles")
      .select("id, date_of_birth")
      .eq("id", patientId)
      .maybeSingle(),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (patientProfileResult.error) throw patientProfileResult.error;
  if (!profileResult.data || !patientProfileResult.data) return null;

  return {
    ...profileResult.data,
    patientProfile: patientProfileResult.data,
    relationship_started_at: relationship.started_at ?? null,
  };
}


function normalizeLimit(value, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

function normalizeNested(row) {
  return Array.isArray(row) ? row[0] : row;
}

function normalizeDoctor(doctor) {
  const profile = normalizeNested(doctor);
  if (!profile) return null;

  const doctorProfile = normalizeNested(profile.doctor_profiles);

  return {
    id: profile.id ?? null,
    full_name: profile.full_name ?? null,
    specialty: doctorProfile?.specialty ?? null,
  };
}

function valueOfObservation(observation) {
  if (
    observation?.value_numeric !== null &&
    observation?.value_numeric !== undefined
  ) {
    return observation.value_numeric;
  }
  if (
    observation?.value_text !== null &&
    observation?.value_text !== undefined
  ) {
    return observation.value_text;
  }
  if (
    observation?.value_boolean !== null &&
    observation?.value_boolean !== undefined
  ) {
    return observation.value_boolean;
  }
  return null;
}

async function getPatientReportIds(supabase, patientId, { limit = null } = {}) {
  let query = supabase
    .from("diagnostic_reports")
    .select(
      `
        id,
        status,
        finalized_at,
        created_at,
        lab_order_id,
        lab_orders!diagnostic_reports_lab_order_id_fkey!inner (
          id,
          patient_id,
          doctor_id,
          laboratory_id,
          status,
          ordered_at
        )
      `,
    )
    .eq("lab_orders.patient_id", patientId)
    .in("status", FINAL_REPORT_STATUSES)
    .order("finalized_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (limit) {
    query = query.limit(normalizeLimit(limit, MAX_TIMELINE, limit));
  }

  const { data, error } = await query;
  if (error) throw error;

  return data ?? [];
}

async function buildPatientTimeline(context, { limit = MAX_TIMELINE } = {}) {
  const supabase = await createClient();
  const safeLimit = normalizeLimit(limit, MAX_TIMELINE, MAX_TIMELINE);
  const patientId = context.patient_id;

  const [
    visitsResult,
    ordersResult,
    reportsResult,
    interpretationsResult,
    prescriptionsResult,
    followUpsResult,
    notificationsResult,
  ] = await Promise.all([
    supabase
      .from("visits")
      .select("id, visit_date, status, doctor_id")
      .eq("patient_id", patientId)
      .order("visit_date", { ascending: false })
      .limit(safeLimit),

    supabase
      .from("lab_orders")
      .select("id, ordered_at, status, doctor_id, laboratory_id")
      .eq("patient_id", patientId)
      .order("ordered_at", { ascending: false })
      .limit(safeLimit),

    supabase
      .from("diagnostic_reports")
      .select(
        `
          id,
          status,
          created_at,
          finalized_at,
          lab_order_id,
          lab_orders!diagnostic_reports_lab_order_id_fkey!inner (
            patient_id,
            ordered_at,
            doctor_id,
            laboratory_id
          )
        `,
      )
      .eq("lab_orders.patient_id", patientId)
      .in("status", FINAL_REPORT_STATUSES)
      .order("finalized_at", { ascending: false })
      .limit(safeLimit),

    supabase
      .from("doctor_interpretations")
      .select(
        `
          id,
          diagnostic_report_id,
          doctor_id,
          content,
          is_visible_to_patient,
          created_at
        `,
      )
      .eq("is_visible_to_patient", true)
      .order("created_at", { ascending: false })
      .limit(safeLimit),

    supabase
      .from("prescriptions")
      .select(
        "id, diagnostic_report_id, doctor_id, status, issued_at, created_at",
      )
      .eq("patient_id", patientId)
      .order("issued_at", { ascending: false })
      .limit(safeLimit),

    supabase
      .from("follow_ups")
      .select("id, doctor_id, title, description, due_date, status, created_at")
      .eq("patient_id", patientId)
      .in("status", FOLLOW_UP_STATUSES)
      .order("created_at", { ascending: false })
      .limit(safeLimit),

    supabase
      .from("notifications")
      .select(
        "id, type, title, body, related_entity_type, related_entity_id, created_at, is_read",
      )
      .eq("recipient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(safeLimit),
  ]);

  for (const result of [
    visitsResult,
    ordersResult,
    reportsResult,
    interpretationsResult,
    prescriptionsResult,
    followUpsResult,
    notificationsResult,
  ]) {
    if (result.error) throw result.error;
  }

  const finalReportIds = new Set(
    (reportsResult.data ?? []).map((row) => row.id),
  );
  const interpretations = (interpretationsResult.data ?? []).filter((item) =>
    finalReportIds.has(item.diagnostic_report_id),
  );

  const events = [
    ...(visitsResult.data ?? []).map((item) => ({
      id: `visit:${item.id}`,
      type: "visit",
      date: item.visit_date,
      title: "ویزیت",
      summary: `وضعیت ویزیت: ${getStatusLabel(item.status)}`,
      resource_id: item.id,
      resource_type: "visit",
    })),

    ...(ordersResult.data ?? []).map((item) => ({
      id: `lab_order:${item.id}`,
      type: "lab_order",
      date: item.ordered_at,
      title: "درخواست آزمایش",
      summary: `وضعیت درخواست: ${getStatusLabel(item.status)}`,
      resource_id: item.id,
      resource_type: "lab_order",
    })),

    ...(reportsResult.data ?? []).map((item) => ({
      id: `diagnostic_report:${item.id}`,
      type: "lab_result",
      date: item.finalized_at ?? item.created_at,
      title:
        item.status === "amended"
          ? "نتیجه آزمایش اصلاح شد"
          : "نتیجه آزمایش نهایی شد",
      summary: `وضعیت نتیجه: ${getStatusLabel(item.status)}`,
      resource_id: item.id,
      resource_type: "diagnostic_report",
    })),

    ...interpretations.map((item) => ({
      id: `doctor_interpretation:${item.id}`,
      type: "doctor_explanation",
      date: item.created_at,
      title: "توضیحات پزشک",
      summary: item.content,
      resource_id: item.id,
      resource_type: "doctor_interpretation",
      report_id: item.diagnostic_report_id,
    })),

    ...(prescriptionsResult.data ?? []).map((item) => ({
      id: `prescription:${item.id}`,
      type: "prescription",
      date: item.issued_at ?? item.created_at,
      title: "نسخه",
      summary: `وضعیت نسخه: ${getStatusLabel(item.status)}`,
      resource_id: item.id,
      resource_type: "prescription",
    })),

    ...(followUpsResult.data ?? []).map((item) => ({
      id: `follow_up:${item.id}`,
      type: "follow_up",
      date: item.created_at,
      title: item.title,
      summary:
        item.description ?? `وضعیت پیگیری: ${getStatusLabel(item.status)}`,
      resource_id: item.id,
      resource_type: "follow_up",
      due_date: item.due_date,
      status: item.status,
    })),

    ...(notificationsResult.data ?? []).map((item) => ({
      id: `notification:${item.id}`,
      type: "notification",
      date: item.created_at,
      title: item.title,
      summary: item.body ?? null,
      resource_id: item.related_entity_id ?? item.id,
      resource_type: item.related_entity_type ?? "notification",
      notification_id: item.id,
      is_read: item.is_read,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return events.slice(0, safeLimit);
}

export async function getPatientHome() {
  const context = await requirePatient();
  const supabase = await createClient();
  const patientId = context.patient_id;

  const [
    timeline,
    unreadResult,
    overdueFollowUpsResult,
    pendingFollowUpsResult,
    activeVisitsResult,
    latestResultResult,
    recentResultsResult,
    recentPrescriptionsResult,
  ] = await Promise.all([
    buildPatientTimeline(context, { limit: 1 }),

    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", patientId)
      .eq("is_read", false),

    supabase
      .from("follow_ups")
      .select("id, title, due_date, status")
      .eq("patient_id", patientId)
      .eq("status", "overdue")
      .order("due_date", { ascending: true })
      .limit(5),

    supabase
      .from("follow_ups")
      .select("id, title, due_date, status")
      .eq("patient_id", patientId)
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(5),

    supabase
      .from("visits")
      .select("id, visit_date, status", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .in("status", ["scheduled", "in_progress"]),

    supabase
      .from("diagnostic_reports")
      .select(
        `
          id,
          status,
          finalized_at,
          created_at,
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
      .order("finalized_at", { ascending: false })
      .limit(1),

    supabase
      .from("diagnostic_reports")
      .select(
        `
          id,
          status,
          created_at,
          finalized_at,
          lab_order_id,
          lab_orders!diagnostic_reports_lab_order_id_fkey!inner (
            id,
            patient_id,
            ordered_at,
            doctor_id,
            laboratory_id
          )
        `,
      )
      .eq("lab_orders.patient_id", patientId)
      .in("status", FINAL_REPORT_STATUSES)
      .order("created_at", { ascending: false })
      .limit(MAX_HOME_RESULTS),

    supabase
      .from("prescriptions")
      .select(
        "id, doctor_id, diagnostic_report_id, status, issued_at, created_at",
      )
      .eq("patient_id", patientId)
      .order("issued_at", { ascending: false })
      .limit(MAX_HOME_PRESCRIPTIONS),
  ]);

  for (const result of [
    unreadResult,
    overdueFollowUpsResult,
    pendingFollowUpsResult,
    activeVisitsResult,
    latestResultResult,
    recentResultsResult,
    recentPrescriptionsResult,
  ]) {
    if (result.error) throw result.error;
  }

  const overdue = overdueFollowUpsResult.data ?? [];
  const pending = pendingFollowUpsResult.data ?? [];
  const unread = unreadResult.count ?? 0;
  const needsAttention = overdue.map((item) => ({
    type: "follow_up",
    resource_id: item.id,
    title: item.title,
    status: item.status,
    due_date: item.due_date,
  }));

  if (unread > 0) {
    needsAttention.push({
      type: "notification",
      resource_id: null,
      title: "اعلان خوانده‌نشده دارید",
      status: "unread",
      due_date: null,
    });
  }

  const nextStep = overdue[0]
    ? {
        type: "follow_up",
        resource_id: overdue[0].id,
        label: "پیگیری عقب‌افتاده را بررسی کنید",
      }
    : pending[0]
      ? {
          type: "follow_up",
          resource_id: pending[0].id,
          label: "پیگیری باز خود را بررسی کنید",
        }
      : unread > 0
        ? {
            type: "notification",
            resource_id: null,
            label: "اعلان‌های خوانده‌نشده را بررسی کنید",
          }
        : null;

  const recentResults = Array.isArray(recentResultsResult.data)
    ? recentResultsResult.data
    : [];
  const recentPrescriptions = Array.isArray(recentPrescriptionsResult.data)
    ? recentPrescriptionsResult.data
    : [];
  const activeFollowUps = [...overdue, ...pending];

  return {
    latest_event: timeline[0] ?? null,
    needs_attention: needsAttention,
    next_step: nextStep,
    unread_notifications: unread,
    latest_result: latestResultResult.data?.[0] ?? null,
    active_visit_count: activeVisitsResult.count ?? 0,
    active_followups: activeFollowUps,
    recent_results: recentResults,
    recent_prescriptions: recentPrescriptions,
    // Compatibility aliases for callers still using the earlier camelCase shape.
    recentResults,
    recentPrescriptions,
    activeFollowUps,
  };
}

/** Compatibility adapter for the pre-P1 dashboard contract. */
export async function getPatientDashboard() {
  const home = await getPatientHome();

  return {
    ...home,
    unreadNotifications: home.unread_notifications,
    pendingVisits: home.active_visit_count,
    recentResults: home.recent_results,
    recentPrescriptions: home.recent_prescriptions,
  };
}

export async function getPatientResults(_ignoredPatientId) {
  const context = await requirePatient();
  const supabase = await createClient();
  const reports = await getPatientReportIds(supabase, context.patient_id);

  return reports.map((report) => {
    const order = normalizeNested(report.lab_orders);
    const { lab_orders: _labOrders, ...reportData } = report;

    return {
      ...reportData,
      order: order
        ? {
            id: order.id,
            status: order.status,
            ordered_at: order.ordered_at,
          }
        : null,
    };
  });
}

export async function getPatientResult(
  reportId,
  _ignoredPatientId,
  { auditView = true } = {},
) {
  const context = await requirePatient();
  if (!reportId) return null;

  const supabase = await createClient();

  const { data: report, error } = await supabase
    .from("diagnostic_reports")
    .select(
      `
        id,
        status,
        created_at,
        finalized_at,
        lab_order_id,
        lab_orders!diagnostic_reports_lab_order_id_fkey!inner (
          id,
          patient_id,
          status,
          ordered_at,
          doctor_id,
          laboratory_id
        )
      `,
    )
    .eq("id", reportId)
    .eq("lab_orders.patient_id", context.patient_id)
    .in("status", FINAL_REPORT_STATUSES)
    .maybeSingle();

  if (error) throw error;
  if (!report) return null;

  const [observationsResult, doctorResult] = await Promise.all([
    supabase
      .from("observations")
      .select(
        `
          id,
          diagnostic_report_id,
          test_definition_id,
          value_numeric,
          value_text,
          value_boolean,
          unit,
          reference_range_template_id,
          reference_min,
          reference_max,
          reference_text,
          reference_source,
          flag,
          status,
          supersedes_observation_id,
          observed_at,
          created_at,
          test_definitions (
            id,
            name,
            name_fa,
            internal_code,
            value_type,
            default_unit,
            decimal_precision
          )
        `,
      )
      .eq("diagnostic_report_id", reportId)
      .in("status", CURRENT_OBSERVATION_STATUSES)
      .order("observed_at", { ascending: true })
      .order("created_at", { ascending: true }),

    supabase
      .from("profiles")
      .select(
        `
          id,
          full_name,
          doctor_profiles!doctor_profiles_id_fkey (
            specialty,
            is_verified
          )
        `,
      )
      .eq("id", report.lab_orders.doctor_id)
      .maybeSingle(),
  ]);

  if (observationsResult.error) throw observationsResult.error;
  if (doctorResult.error) throw doctorResult.error;

  let laboratory = null;
  try {
    const admin = createAdminClient();
    const { data: labProfile, error: labError } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("id", report.lab_orders.laboratory_id)
      .maybeSingle();
    if (labError) throw labError;
    laboratory = labProfile
      ? { id: labProfile.id, full_name: labProfile.full_name }
      : null;
  } catch (error) {
    console.error("[getPatientResult:laboratory]", error);
  }

  await recordPatientAudit({
    actorId: context.user_id,
    action: "patient_result_viewed",
    entityType: "diagnostic_report",
    entityId: reportId,
    metadata: { source: "patient_result_detail" },
  });

  const order = normalizeNested(report.lab_orders);
  const { lab_orders: _labOrders, ...reportData } = report;

  return {
    ...reportData,
    order: order
      ? {
          id: order.id,
          status: order.status,
          ordered_at: order.ordered_at,
        }
      : null,
    observations: observationsResult.data ?? [],
    doctor: normalizeDoctor(doctorResult.data),
    laboratory,
  };
}

export async function getPatientObservations(
  _ignoredPatientId,
  reportId,
  { auditView = false } = {},
) {
  const result = await getPatientResult(reportId, undefined, { auditView });
  return result?.observations ?? [];
}

export async function getPatientResultHistory(
  testDefinitionId,
  { limit = MAX_HISTORY } = {},
) {
  const context = await requirePatient();
  if (!testDefinitionId) return [];

  const supabase = await createClient();
  const safeLimit = normalizeLimit(limit, MAX_HISTORY, MAX_HISTORY);
  const reports = await getPatientReportIds(supabase, context.patient_id);

  if (!reports.length) return [];

  const reportIds = reports.map((report) => report.id);

  const { data: observations, error } = await supabase
    .from("observations")
    .select(
      `
        id,
        diagnostic_report_id,
        test_definition_id,
        value_numeric,
        value_text,
        value_boolean,
        unit,
        reference_range_template_id,
        reference_min,
        reference_max,
        reference_text,
        reference_source,
        flag,
        status,
        observed_at,
        created_at,
        supersedes_observation_id,
        test_definitions (
          id,
          name,
          name_fa,
          internal_code,
          value_type,
          default_unit,
          decimal_precision
        )
      `,
    )
    .in("diagnostic_report_id", reportIds)
    .eq("test_definition_id", testDefinitionId)
    .in("status", CURRENT_OBSERVATION_STATUSES)
    .order("observed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw error;

  const reportMap = new Map(reports.map((report) => [report.id, report]));

  return (observations ?? []).map((observation) => {
    const report = reportMap.get(observation.diagnostic_report_id);
    return {
      ...observation,
      ordered_at: report?.lab_orders?.ordered_at ?? null,
      finalized_at: report?.finalized_at ?? null,
      report_status: report?.status ?? null,
    };
  });
}

export async function getPatientResultComparison({
  testDefinitionId,
  currentObservationId = null,
} = {}) {
  const history = await getPatientResultHistory(testDefinitionId);
  if (!history.length) return null;

  const currentIndex = currentObservationId
    ? history.findIndex((item) => item.id === currentObservationId)
    : 0;
  const index = currentIndex >= 0 ? currentIndex : 0;
  const current = history[index] ?? null;
  const previous = history[index + 1] ?? null;
  if (!current) return null;

  const currentValue = valueOfObservation(current);
  const previousValue = previous ? valueOfObservation(previous) : null;
  let difference = null;
  let direction = previous ? "stable" : "new";

  if (typeof currentValue === "number" && typeof previousValue === "number") {
    difference = currentValue - previousValue;
    direction = difference > 0 ? "up" : difference < 0 ? "down" : "stable";
  }

  return {
    current,
    previous,
    currentValue,
    previousValue,
    difference,
    direction,
  };
}

export async function getPatientTrendTests() {
  const context = await requirePatient();
  const supabase = await createClient();
  const reports = await getPatientReportIds(supabase, context.patient_id);
  if (!reports.length) return [];

  const reportIds = reports.map((report) => report.id);
  const { data, error } = await supabase
    .from("observations")
    .select(
      `
        test_definition_id,
        test_definitions (
          id,
          name,
          name_fa,
          internal_code,
          value_type,
          default_unit,
          decimal_precision
        )
      `,
    )
    .in("diagnostic_report_id", reportIds)
    .in("status", CURRENT_OBSERVATION_STATUSES);

  if (error) throw error;

  const unique = new Map();
  for (const row of data ?? []) {
    const test = normalizeNested(row.test_definitions);
    if (!row.test_definition_id || !test) continue;

    unique.set(test.id, {
      ...test,
      code: test.internal_code,
    });
  }

  return [...unique.values()];
}

export async function getPatientTrend(testDefinitionId) {
  const history = await getPatientResultHistory(testDefinitionId, {
    limit: MAX_HISTORY,
  });

  return history
    .slice()
    .sort(
      (a, b) =>
        new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime(),
    );
}

export async function getPatientInterpretations(_ignoredPatientId) {
  const context = await requirePatient();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("doctor_interpretations")
    .select(
      `
        id,
        diagnostic_report_id,
        doctor_id,
        content,
        is_visible_to_patient,
        created_at,
        updated_at,
        diagnostic_reports!doctor_interpretations_diagnostic_report_id_fkey!inner (
          id,
          status,
          lab_order_id,
          lab_orders!diagnostic_reports_lab_order_id_fkey!inner (
            patient_id,
            doctor_id
          )
        )
      `,
    )
    .eq("is_visible_to_patient", true)
    .eq("diagnostic_reports.lab_orders.patient_id", context.patient_id)
    .in("diagnostic_reports.status", FINAL_REPORT_STATUSES)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const doctorIds = [...new Set((data ?? []).map((item) => item.doctor_id))];
  const doctorsResult = doctorIds.length
    ? await supabase
        .from("profiles")
        .select(
          "id, full_name, doctor_profiles!doctor_profiles_id_fkey(specialty)",
        )
        .in("id", doctorIds)
    : { data: [], error: null };

  if (doctorsResult.error) throw doctorsResult.error;

  const doctorMap = new Map(
    (doctorsResult.data ?? []).map((doctor) => [
      doctor.id,
      normalizeDoctor(doctor),
    ]),
  );

  return (data ?? []).map((item) => ({
    ...item,
    interpretation: item.content,
    doctor_profiles: doctorMap.get(item.doctor_id) ?? null,
  }));
}

export async function getPatientFollowUps(_ignoredPatientId) {
  const context = await requirePatient();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("follow_ups")
    .select(
      "id, patient_id, doctor_id, title, description, due_date, status, created_at, completed_at, cancelled_at",
    )
    .eq("patient_id", context.patient_id)
    .in("status", FOLLOW_UP_STATUSES)
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getPatientTimeline({
  limit = MAX_TIMELINE,
  auditView = true,
} = {}) {
  const context = await requirePatient();
  const events = await buildPatientTimeline(context, { limit });

  if (auditView) {
    await recordPatientAudit({
      actorId: context.user_id,
      action: "patient_timeline_viewed",
      entityType: "patient_profile",
      entityId: context.patient_id,
      metadata: { event_count: events.length },
    });
  }

  return events;
}

export async function getPatientProfile() {
  const context = await requirePatient();
  const patientId = context?.user_id ?? context?.patient_id;

  if (!patientId) {
    throw new Error(
      "Patient profile context is missing the authenticated patient ID.",
    );
  }

  // Newer auth contexts expose the full row as `context.profile`. Older
  // deployed versions returned the authenticated identity fields without the
  // nested object, so recover the row from the session-scoped Supabase client.
  let profile = context.profile;

  if (!profile?.id) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, role, full_name, phone, national_id, avatar_url, created_at, updated_at",
      )
      .eq("id", patientId)
      .maybeSingle();

    if (error) throw error;
    profile = data;
  }

  // Fail explicitly instead of masking a missing or mismatched patient record.
  if (!profile?.id || profile.id !== patientId || profile.role !== "patient") {
    throw new Error(
      "The authenticated patient profile could not be found or is invalid.",
    );
  }

  return {
    profile: {
      id: profile.id,
      role: profile.role,
      full_name: profile.full_name,
      phone: profile.phone,
      national_id: profile.national_id,
      avatar_url: profile.avatar_url,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    },
    patient_profile: context.patient_profile ?? null,
  };
}

export async function getPatientAccessList() {
  const context = await requirePatient();
  const supabase = await createClient();

  const [relationshipsResult, labOrdersResult] = await Promise.all([
    supabase
      .from("patient_doctor_relationships")
      .select("id, doctor_id, relationship_type, status, started_at, ended_at")
      .eq("patient_id", context.patient_id)
      .eq("status", "active")
      .order("started_at", { ascending: false }),

    supabase
      .from("lab_orders")
      .select("id, laboratory_id, status, ordered_at")
      .eq("patient_id", context.patient_id)
      .not("laboratory_id", "is", null)
      .neq("status", "cancelled")
      .order("ordered_at", { ascending: false }),
  ]);

  if (relationshipsResult.error) throw relationshipsResult.error;
  if (labOrdersResult.error) throw labOrdersResult.error;

  const doctorIds = [
    ...new Set((relationshipsResult.data ?? []).map((row) => row.doctor_id)),
  ];
  const doctorsResult = doctorIds.length
    ? await supabase
        .from("profiles")
        .select(
          "id, full_name, doctor_profiles!doctor_profiles_id_fkey(specialty)",
        )
        .in("id", doctorIds)
    : { data: [], error: null };

  if (doctorsResult.error) throw doctorsResult.error;

  const doctorMap = new Map(
    (doctorsResult.data ?? []).map((doctor) => [
      doctor.id,
      normalizeDoctor(doctor),
    ]),
  );

  const labIds = [
    ...new Set(
      (labOrdersResult.data ?? [])
        .map((row) => row.laboratory_id)
        .filter(Boolean),
    ),
  ];

  let labMap = new Map();
  if (labIds.length) {
    try {
      const admin = createAdminClient();
      const [
        { data: labProfiles, error: labProfilesError },
        { data: orgProfiles, error: orgProfilesError },
      ] = await Promise.all([
        admin.from("profiles").select("id, full_name").in("id", labIds),
        admin
          .from("laboratory_profiles")
          .select("id, organization_id")
          .in("id", labIds),
      ]);

      if (labProfilesError) throw labProfilesError;
      if (orgProfilesError) throw orgProfilesError;

      const labProfileMap = new Map(
        (labProfiles ?? []).map((profile) => [profile.id, profile]),
      );
      const orgIds = [
        ...new Set(
          (orgProfiles ?? [])
            .map((profile) => profile.organization_id)
            .filter(Boolean),
        ),
      ];

      const orgMap = new Map();
      if (orgIds.length) {
        const { data: organizations, error: organizationsError } = await admin
          .from("organizations")
          .select("id, name, type")
          .in("id", orgIds);
        if (organizationsError) throw organizationsError;
        for (const organization of organizations ?? []) {
          orgMap.set(organization.id, organization);
        }
      }

      for (const profile of orgProfiles ?? []) {
        labMap.set(profile.id, {
          profile: labProfileMap.get(profile.id) ?? null,
          organization: profile.organization_id
            ? (orgMap.get(profile.organization_id) ?? null)
            : null,
        });
      }
    } catch (error) {
      console.error("[getPatientAccessList:laboratories]", error);
    }
  }

  const laboratoriesById = new Map();
  for (const order of labOrdersResult.data ?? []) {
    const existing = laboratoriesById.get(order.laboratory_id) ?? {
      laboratory_id: order.laboratory_id,
      access_basis: "lab_order",
      permission_model: "inferred_from_lab_order",
      order_count: 0,
      resource_ids: [],
      latest_ordered_at: null,
      statuses: [],
      laboratory: labMap.get(order.laboratory_id)?.profile
        ? {
            id: labMap.get(order.laboratory_id).profile.id,
            full_name: labMap.get(order.laboratory_id).profile.full_name,
          }
        : null,
      organization: labMap.get(order.laboratory_id)?.organization ?? null,
    };

    existing.order_count += 1;
    existing.resource_ids.push(order.id);
    existing.statuses.push(order.status);
    if (
      !existing.latest_ordered_at ||
      new Date(order.ordered_at) > new Date(existing.latest_ordered_at)
    ) {
      existing.latest_ordered_at = order.ordered_at;
    }

    laboratoriesById.set(order.laboratory_id, existing);
  }

  const result = {
    doctors: (relationshipsResult.data ?? []).map((relationship) => ({
      ...relationship,
      access_basis: "active_patient_doctor_relationship",
      doctor: doctorMap.get(relationship.doctor_id) ?? null,
    })),
    laboratories: [...laboratoriesById.values()],
  };

  await recordPatientAudit({
    actorId: context.user_id,
    action: "patient_access_list_viewed",
    entityType: "patient_profile",
    entityId: context.patient_id,
    metadata: {
      doctor_count: result.doctors.length,
      laboratory_count: result.laboratories.length,
    },
  });

  return result;
}
