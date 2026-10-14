import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTestDisplayName } from "@/lib/medical/test-name";
import { getSessionUser } from "@/lib/auth/server";

const FINAL_REPORT_STATUSES = ["final", "amended"];

const CURRENT_OBSERVATION_STATUSES = ["final", "corrected"];

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function pickName(profile) {
  return profile?.full_name?.trim() || "بیمار";
}

function getObservationValue(observation) {
  if (observation?.value_numeric != null) {
    return Number(observation.value_numeric);
  }

  if (observation?.value_text != null) {
    return String(observation.value_text);
  }

  if (observation?.value_boolean != null) {
    return observation.value_boolean ? "مثبت" : "منفی";
  }

  return null;
}

function isNumeric(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function buildComparison(observations) {
  const byTest = new Map();

  for (const observation of observations) {
    if (!observation?.test_definition_id) {
      continue;
    }

    if (!CURRENT_OBSERVATION_STATUSES.includes(observation.status)) {
      continue;
    }

    const rows = byTest.get(observation.test_definition_id) || [];

    rows.push(observation);

    byTest.set(observation.test_definition_id, rows);
  }

  return [...byTest.entries()]
    .map(([testId, rows]) => {
      const ordered = [...rows].sort(
        (a, b) =>
          new Date(b.observed_at || b.created_at || 0).getTime() -
          new Date(a.observed_at || a.created_at || 0).getTime(),
      );

      const current = ordered[0] || null;

      const previous = ordered[1] || null;

      const currentValue = getObservationValue(current);

      const previousValue = getObservationValue(previous);

      let change = null;
      let direction = "same";

      if (isNumeric(currentValue) && isNumeric(previousValue)) {
        change = Number((currentValue - previousValue).toFixed(4));

        direction = change > 0 ? "up" : change < 0 ? "down" : "same";
      }

      const test =
        asArray(current?.test_definitions)[0] ||
        current?.test_definitions ||
        null;

      return {
        testId,

        testName: getTestDisplayName(test),

        testCode: test?.internal_code || null,

        unit: current?.unit || previous?.unit || null,

        referenceMin: current?.reference_min ?? previous?.reference_min ?? null,

        referenceMax: current?.reference_max ?? previous?.reference_max ?? null,

        referenceText:
          current?.reference_text || previous?.reference_text || null,

        current: currentValue,

        previous: previousValue,

        change,

        direction,

        observedAt: current?.observed_at || current?.created_at || null,
      };
    })
    .sort((a, b) => new Date(b.observedAt || 0) - new Date(a.observedAt || 0));
}

async function getReportBundle(supabase, doctorId, patientId = null) {
  let ordersQuery = supabase
    .from("lab_orders")
    .select(
      "id, patient_id, laboratory_id, status, clinical_note, ordered_at, received_at, completed_at, cancelled_at",
    )
    .eq("doctor_id", doctorId)
    .order("ordered_at", {
      ascending: false,
    });

  if (patientId) {
    ordersQuery = ordersQuery.eq("patient_id", patientId);
  }

  const { data: orders, error: ordersError } = await ordersQuery;

  if (ordersError) {
    throw ordersError;
  }

  if (!orders?.length) {
    return {
      orders: [],
      reports: [],
      observations: [],
    };
  }

  const orderIds = orders.map((row) => row.id);

  const { data: reports, error: reportsError } = await supabase
    .from("diagnostic_reports")
    .select(
      "id, lab_order_id, laboratory_id, status, finalized_at, created_at, updated_at",
    )
    .in("lab_order_id", orderIds)
    .in("status", FINAL_REPORT_STATUSES)
    .order("created_at", {
      ascending: false,
    });

  if (reportsError) {
    throw reportsError;
  }

  const reportIds = (reports || []).map((report) => report.id);

  if (!reportIds.length) {
    return {
      orders,
      reports: [],
      observations: [],
    };
  }

  const { data: observations, error: observationsError } = await supabase
    .from("observations")
    .select(
      "id, diagnostic_report_id, test_definition_id, value_numeric, value_text, value_boolean, unit, reference_min, reference_max, reference_text, flag, status, observed_at, created_at, test_definitions(id, name, name_fa, internal_code)",
    )
    .in("diagnostic_report_id", reportIds)
    .in("status", CURRENT_OBSERVATION_STATUSES)
    .order("observed_at", {
      ascending: false,
    });

  if (observationsError) {
    throw observationsError;
  }

  return {
    orders,
    reports: reports || [],
    observations: observations || [],
  };
}

async function getPhysicianVoiceNotes(supabase, doctorId, patientId) {
  const { data, error } = await supabase
    .from("voice_notes")
    .select("id, visit_id, patient_id, doctor_id, audio_path, duration, created_at, archived_at")
    .eq("doctor_id", doctorId)
    .eq("patient_id", patientId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw error;
  }

  if (!data?.length) {
    return [];
  }

  const admin = createAdminClient();
  const paths = data.map((note) => note.audio_path).filter(Boolean);
  const { data: signed, error: signedError } = await admin.storage
    .from("pab-voice-notes")
    .createSignedUrls(paths, 300);

  if (signedError) {
    throw signedError;
  }

  const signedByPath = new Map(
    (signed || []).map((item) => [item.path, item.signedUrl || item.signedURL || null]),
  );

  const visitIds = [...new Set(data.map((note) => note.visit_id).filter(Boolean))];
  let visits = [];

  if (visitIds.length) {
    const { data: visitRows, error: visitsError } = await supabase
      .from("visits")
      .select("id, patient_id, doctor_id, visit_date, status, created_at")
      .in("id", visitIds)
      .eq("doctor_id", doctorId)
      .eq("patient_id", patientId);

    if (visitsError) {
      throw visitsError;
    }

    visits = visitRows || [];
  }

  const visitMap = new Map(visits.map((visit) => [visit.id, visit]));
  const voiceNoteIds = data.map((note) => note.id);
  const [transcriptsResult, summariesResult] = await Promise.all([
    supabase
      .from("transcripts")
      .select("id, voice_note_id, transcript_text, created_at")
      .in("voice_note_id", voiceNoteIds),
    supabase
      .from("visit_summaries")
      .select("id, voice_note_id, summary, structured_content, doctor_confirmed, confirmed_at, created_at, updated_at")
      .in("voice_note_id", voiceNoteIds),
  ]);
  if (transcriptsResult.error) throw transcriptsResult.error;
  if (summariesResult.error) throw summariesResult.error;

  const transcriptByVoiceNoteId = new Map(
    (transcriptsResult.data || []).map((row) => [row.voice_note_id, row]),
  );
  const summaryByVoiceNoteId = new Map(
    (summariesResult.data || []).map((row) => [row.voice_note_id, row]),
  );

  return data.map((note) => ({
    ...note,
    audioUrl: signedByPath.get(note.audio_path) || null,
    visit: visitMap.get(note.visit_id) || null,
    transcript: transcriptByVoiceNoteId.get(note.id) || null,
    visitSummary: summaryByVoiceNoteId.get(note.id) || null,
  }));
}

async function getPatientNames(supabase, patientIds) {
  const ids = [...new Set(patientIds.filter(Boolean))];

  if (!ids.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((row) => [row.id, pickName(row)]));
}

function getDateInTimeZone(date = new Date(), timeZone = "Asia/Baku") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function getPhysicianDashboard() {
  const user = await getSessionUser();

  if (!user || user.role !== "doctor" || user.is_verified !== true) {
    return {
      doctor: null,

      counts: {
        activePatients: 0,
        newResults: 0,
        followUpsDue: 0,
        completedRequestedTests: 0,
        pendingRequestedTests: 0,
        overdueFollowUps: 0,
        doctorNotes: 0,
        unreadNotifications: 0,
      },

      attention: [],
      recentPatients: [],
      recentOrders: [],
      followUps: [],
      notificationPreview: [],
    };
  }

  const supabase = await createClient();
  const today = getDateInTimeZone();

  const [
    relationshipsResult,
    ordersBundle,
    notificationsResult,
    unreadNotificationsCountResult,
    profileResult,
    followUpsResult,
    followUpsDueCountResult,
    overdueFollowUpsCountResult,
    overduePendingFollowUpsCountResult,
    doctorNotesCountResult,
  ] = await Promise.all([
    supabase
      .from("patient_doctor_relationships")
      .select("patient_id, started_at")
      .eq("doctor_id", user.id)
      .eq("status", "active")
      .order("started_at", { ascending: false }),

    getReportBundle(supabase, user.id),

    supabase
      .from("notifications")
      .select("id, type, title, body, related_entity_type, related_entity_id, is_read, status, reviewed_at, created_at")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),

    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false),

    supabase
      .from("profiles")
      .select("id, full_name, phone, created_at")
      .eq("id", user.id)
      .maybeSingle(),

    supabase
      .from("follow_ups")
      .select("id, patient_id, doctor_id, title, description, due_date, status, created_at, completed_at, cancelled_at")
      .eq("doctor_id", user.id)
      .in("status", ["pending", "overdue"])
      .order("due_date", { ascending: true })
      .limit(100),

    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", user.id)
      .eq("status", "pending")
      .eq("due_date", today),

    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", user.id)
      .eq("status", "overdue"),

    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", user.id)
      .eq("status", "pending")
      .lt("due_date", today),

    supabase
      .from("doctor_notes")
      .select("id", { count: "exact", head: true })
      .eq("doctor_id", user.id),
  ]);

  if (relationshipsResult.error) {
    throw relationshipsResult.error;
  }

  if (notificationsResult.error) throw notificationsResult.error;
  if (unreadNotificationsCountResult.error) throw unreadNotificationsCountResult.error;
  if (profileResult.error) throw profileResult.error;
  if (followUpsResult.error) throw followUpsResult.error;
  if (followUpsDueCountResult.error) throw followUpsDueCountResult.error;
  if (overdueFollowUpsCountResult.error) throw overdueFollowUpsCountResult.error;
  if (overduePendingFollowUpsCountResult.error) throw overduePendingFollowUpsCountResult.error;
  if (doctorNotesCountResult.error) throw doctorNotesCountResult.error;

  const patientIds = [
    ...new Set((relationshipsResult.data || []).map((row) => row.patient_id)),
  ];
  const activePatientIds = new Set(patientIds);
  const patientNames = await getPatientNames(supabase, patientIds);

  const orderIdsForCounts = ordersBundle.orders.map((order) => order.id);
  let orderItemsForCounts = [];
  if (orderIdsForCounts.length) {
    const { data: countItems, error: countItemsError } = await supabase
      .from("lab_order_items")
      .select("id, lab_order_id, test_panel_id, test_definition_id")
      .in("lab_order_id", orderIdsForCounts);
    if (countItemsError) throw countItemsError;
    orderItemsForCounts = countItems || [];
  }

  // Count actual test definitions rather than order rows. An order item can be
  // a panel containing many tests, so counting it as a single test undercounts
  // requested/completed laboratory work.
  const panelIdsForCounts = [...new Set(
    orderItemsForCounts.map((item) => item.test_panel_id).filter(Boolean),
  )];
  let panelItemsForCounts = [];
  if (panelIdsForCounts.length) {
    const { data: panelItems, error: panelItemsError } = await supabase
      .from("test_panel_items")
      .select("panel_id, test_definition_id")
      .in("panel_id", panelIdsForCounts);
    if (panelItemsError) throw panelItemsError;
    panelItemsForCounts = panelItems || [];
  }

  const testsByPanel = new Map();
  for (const item of panelItemsForCounts) {
    if (!item.panel_id || !item.test_definition_id) continue;
    const tests = testsByPanel.get(item.panel_id) || new Set();
    tests.add(item.test_definition_id);
    testsByPanel.set(item.panel_id, tests);
  }

  // Build the requested-test set per order, expanding panels into the tests
  // they actually contain. Cancelled orders are not counted as pending work.
  const cancelledOrderIds = new Set(
    ordersBundle.orders.filter((order) => order.status === "cancelled").map((order) => order.id),
  );
  const requestedTestKeys = new Set();
  for (const item of orderItemsForCounts) {
    if (cancelledOrderIds.has(item.lab_order_id)) continue;
    if (item.test_definition_id) {
      requestedTestKeys.add(`${item.lab_order_id}:${item.test_definition_id}`);
    }
    if (item.test_panel_id) {
      for (const testId of testsByPanel.get(item.test_panel_id) || []) {
        requestedTestKeys.add(`${item.lab_order_id}:${testId}`);
      }
    }
  }

  // A test is completed only when it has a current final/corrected observation
  // inside a finalized/amended report. Order status alone is not proof that
  // every ordered test has a result.
  const orderIdByReportId = new Map(
    ordersBundle.reports.map((report) => [report.id, report.lab_order_id]),
  );
  const performedTestKeys = new Set();
  for (const observation of ordersBundle.observations) {
    const orderId = orderIdByReportId.get(observation.diagnostic_report_id);
    if (orderId && observation.test_definition_id && !cancelledOrderIds.has(orderId)) {
      performedTestKeys.add(`${orderId}:${observation.test_definition_id}`);
    }
  }
  const completedRequestedTests = [...requestedTestKeys].filter((key) => performedTestKeys.has(key)).length;
  const pendingRequestedTests = [...requestedTestKeys].filter((key) => !performedTestKeys.has(key)).length;

  const interpretedReportIds = new Set();

  if (ordersBundle.reports.length) {
    const { data: interpretations, error: interpretationError } = await supabase
      .from("doctor_interpretations")
      .select("diagnostic_report_id")
      .eq("doctor_id", user.id)
      .in(
        "diagnostic_report_id",
        ordersBundle.reports.map((row) => row.id),
      );

    if (interpretationError) {
      throw interpretationError;
    }

    for (const row of interpretations || []) {
      interpretedReportIds.add(row.diagnostic_report_id);
    }
  }

  const newReports = ordersBundle.reports.filter(
    (report) => !interpretedReportIds.has(report.id),
  );

  const newReportPatientIds = new Set(
    ordersBundle.orders
      .filter((order) =>
        newReports.some((report) => report.lab_order_id === order.id),
      )
      .map((order) => order.patient_id),
  );

  const completedOrders = ordersBundle.orders.filter((order) => order.status === "completed");
  const visibleFollowUpRows = (followUpsResult.data || []).filter((row) => activePatientIds.has(row.patient_id));
  const followUps = visibleFollowUpRows.map((row) => {
    const isOverdue = row.status === "overdue" || (row.status === "pending" && row.due_date < today);
    return {
      ...row,
      displayStatus: isOverdue ? "overdue" : row.status,
      patientName: patientNames.get(row.patient_id) || "بیمار",
    };
  });
  const followUpsDue = followUpsDueCountResult.count || 0;
  const overdueFollowUps = (overdueFollowUpsCountResult.count || 0) + (overduePendingFollowUpsCountResult.count || 0);

  const attention = [];

  for (const report of newReports.slice(0, 6)) {
    const order = ordersBundle.orders.find(
      (item) => item.id === report.lab_order_id,
    );

    if (!order) continue;

    const reportObservations = ordersBundle.observations.filter(
      (observation) => observation.diagnostic_report_id === report.id,
    );
    const reportTestIds = new Set(reportObservations.map((row) => row.test_definition_id).filter(Boolean));
    const patientOrderIds = new Set(
      ordersBundle.orders.filter((patientOrder) => patientOrder.patient_id === order.patient_id).map((patientOrder) => patientOrder.id),
    );
    const patientReportIds = new Set(
      ordersBundle.reports.filter((patientReport) => patientOrderIds.has(patientReport.lab_order_id)).map((patientReport) => patientReport.id),
    );
    const patientObservationHistory = ordersBundle.observations.filter(
      (observation) => patientReportIds.has(observation.diagnostic_report_id),
    );
    const comparisons = buildComparison(patientObservationHistory).filter((item) => reportTestIds.has(item.testId));

    const topChange =
      comparisons.find((item) => item.previous != null && item.change !== 0) ||
      comparisons[0];

    attention.push({
      type: "new_result",

      patientId: order.patient_id,

      patientName: patientNames.get(order.patient_id) || "بیمار",

      reportId: report.id,

      title: "نتیجه جدید دریافت شد",

      detail:
        topChange?.previous != null
          ? `${topChange.testName}: ${topChange.previous} → ${topChange.current}`
          : `${reportObservations.length} مورد نتیجه در گزارش جدید ثبت شده است.`,

      date: report.finalized_at || report.created_at,
    });
  }

  for (const order of completedOrders.slice(0, 4)) {
    if (newReportPatientIds.has(order.patient_id)) {
      continue;
    }

    attention.push({
      type: "completed_test",

      patientId: order.patient_id,

      orderId: order.id,

      patientName: patientNames.get(order.patient_id) || "بیمار",

      title: "آزمایش تکمیل شد",

      detail: "نتیجه آزمایش در حال بررسی پزشک است.",

      date: order.completed_at || order.ordered_at,
    });
  }

  const recentPatients = (relationshipsResult.data || [])
    .map((relationship) => ({
      id: relationship.patient_id,

      fullName: patientNames.get(relationship.patient_id) || "بیمار",

      startedAt: relationship.started_at || null,
    }))
    .slice(0, 8)
    .map(({ id, fullName }) => ({
      id,
      fullName,
    }));

  const unreadNotifications = unreadNotificationsCountResult.count || 0;

  return {
    doctor: profileResult.data || null,

    counts: {
      activePatients: patientIds.length,
      newResults: newReportPatientIds.size,
      followUpsDue,
      completedRequestedTests,
      pendingRequestedTests,
      overdueFollowUps,
      doctorNotes: doctorNotesCountResult.count || 0,
      unreadNotifications,
    },

    attention: attention.slice(0, 8),
    recentPatients,
    recentOrders: ordersBundle.orders.slice(0, 6),
    followUps: followUps.slice(0, 12),
    notificationPreview: notificationsResult.data || [],
  };
}

export async function getPhysicianPatientSnapshot(patientId) {
  const user = await getSessionUser();

  if (
    !user ||
    user.role !== "doctor" ||
    user.is_verified !== true ||
    !patientId
  ) {
    return null;
  }

  const supabase = await createClient();

  const { data: relationship, error: relationshipError } = await supabase
    .from("patient_doctor_relationships")
    .select("id, patient_id, doctor_id, relationship_type, status, started_at")
    .eq("doctor_id", user.id)
    .eq("patient_id", patientId)
    .eq("status", "active")
    .maybeSingle();

  if (relationshipError) {
    throw relationshipError;
  }

  if (!relationship) {
    return null;
  }

  const { data: relatedPhysicians, error: relatedPhysiciansError } = await supabase.rpc(
    "get_patient_related_physicians",
    { p_patient_id: patientId },
  );
  if (relatedPhysiciansError) throw relatedPhysiciansError;

  const [
    { data: profile, error: profileError },
    { data: patientProfile, error: patientProfileError },
    reportBundle,
    { data: notes, error: notesError },
    { data: prescriptions, error: prescriptionsError },
    { data: visits, error: visitsError },
    { data: followUpRows, error: followUpsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      // The physician snapshot needs identity/display metadata only. Do not
      // fetch patient phone or national ID when the UI does not use them.
      .select("id, full_name, created_at")
      .eq("id", patientId)
      .maybeSingle(),

    supabase
      .from("patient_profiles")
      .select("id, date_of_birth, sex, blood_type")
      .eq("id", patientId)
      .maybeSingle(),

    getReportBundle(supabase, user.id, patientId),

    supabase
      .from("doctor_notes")
      .select(
        "id, patient_id, doctor_id, diagnostic_report_id, content, created_at",
      )
      .eq("doctor_id", user.id)
      .eq("patient_id", patientId)
      .order("created_at", {
        ascending: false,
      })
      .limit(10),

    supabase
      .from("prescriptions")
      .select(
        "id, patient_id, doctor_id, diagnostic_report_id, status, issued_at, created_at",
      )
      .eq("doctor_id", user.id)
      .eq("patient_id", patientId)
      .order("issued_at", {
        ascending: false,
      })
      .limit(10),

    supabase
      .from("visits")
      .select("id, patient_id, doctor_id, visit_date, status, created_at")
      .eq("doctor_id", user.id)
      .eq("patient_id", patientId)
      .order("visit_date", { ascending: false })
      .limit(10),

    supabase
      .from("follow_ups")
      .select("id, patient_id, doctor_id, title, description, due_date, status, created_at, completed_at, cancelled_at")
      .eq("doctor_id", user.id)
      .eq("patient_id", patientId)
      .order("due_date", { ascending: true })
      .limit(30),
  ]);

  if (profileError) {
    throw profileError;
  }

  if (patientProfileError) {
    throw patientProfileError;
  }

  if (notesError) {
    throw notesError;
  }

  if (prescriptionsError) {
    throw prescriptionsError;
  }

  if (visitsError) throw visitsError;
  if (followUpsError) throw followUpsError;

  if (!profile) {
    return null;
  }

  const voiceNotes = await getPhysicianVoiceNotes(
    supabase,
    user.id,
    patientId,
  );

  const reportIds = reportBundle.reports.map((report) => report.id);

  let interpretations = [];

  if (reportIds.length) {
    const { data, error } = await supabase
      .from("doctor_interpretations")
      .select(
        "id, diagnostic_report_id, content, is_visible_to_patient, created_at, updated_at",
      )
      .eq("doctor_id", user.id)
      .in("diagnostic_report_id", reportIds)
      .order("created_at", {
        ascending: false,
      })
      .limit(20);

    if (error) {
      throw error;
    }

    interpretations = data || [];
  }

  const orderIds = reportBundle.orders.map((order) => order.id);

  const labIds = [
    ...new Set(
      reportBundle.orders.map((order) => order.laboratory_id).filter(Boolean),
    ),
  ];

  const prescriptionIds = (prescriptions || []).map((row) => row.id);

  const [
    { data: labs, error: labsError },
    { data: orderItems, error: orderItemsError },
    { data: prescriptionItems, error: prescriptionItemsError },
  ] = await Promise.all([
    labIds.length
      ? supabase.from("laboratory_profiles").select("id, license_number").in("id", labIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    orderIds.length
      ? supabase
          .from("lab_order_items")
          .select(
            "id, lab_order_id, test_panel_id, test_definition_id, test_panels(id, name, name_fa), test_definitions(id, name, name_fa, internal_code)",
          )
          .in("lab_order_id", orderIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    prescriptionIds.length
      ? supabase
          .from("prescription_items")
          .select(
            "id, prescription_id, medication_name, dosage, frequency, duration, instructions",
          )
          .in("prescription_id", prescriptionIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (labsError) {
    throw labsError;
  }

  if (orderItemsError) {
    throw orderItemsError;
  }

  if (prescriptionItemsError) {
    throw prescriptionItemsError;
  }

  const labMap = new Map(
    (labs || []).map((lab) => [
      lab.id,
      lab.license_number ? `آزمایشگاه ${lab.license_number}` : "آزمایشگاه",
    ]),
  );

  const latestReportByOrder = new Map();

  for (const report of reportBundle.reports) {
    if (!latestReportByOrder.has(report.lab_order_id)) {
      latestReportByOrder.set(report.lab_order_id, report);
    }
  }

  const reportById = new Map(
    reportBundle.reports.map((report) => [report.id, report]),
  );

  const orderById = new Map(
    reportBundle.orders.map((order) => [order.id, order]),
  );

  // A report being present is not the same as being reviewed. Include only
  // actionable notifications explicitly marked reviewed by this doctor and
  // directly linked to this patient's report/order in the timeline.
  const reviewEntityIds = [...new Set([
    ...reportBundle.reports.map((report) => report.id),
    ...reportBundle.orders.map((order) => order.id),
  ])];
  let reviewedNotifications = [];
  if (reviewEntityIds.length) {
    const { data: reviewedRows, error: reviewedRowsError } = await supabase
      .from("notifications")
      .select("id, title, body, related_entity_type, related_entity_id, status, reviewed_at, reviewed_by, created_at")
      .eq("recipient_id", user.id)
      .eq("status", "reviewed")
      .eq("reviewed_by", user.id)
      .in("related_entity_id", reviewEntityIds)
      .order("reviewed_at", { ascending: false });
    if (reviewedRowsError) throw reviewedRowsError;
    reviewedNotifications = reviewedRows || [];
  }

  const labHistory = [...reportBundle.reports]
    .sort(
      (a, b) =>
        new Date(b.finalized_at || b.created_at || 0).getTime() -
        new Date(a.finalized_at || a.created_at || 0).getTime(),
    )
    .map((report) => {
      const order = orderById.get(report.lab_order_id);

      const reportObservations = reportBundle.observations.filter(
        (observation) => observation.diagnostic_report_id === report.id,
      );

      return {
        ...report,

        patientId: patientId,

        laboratoryName:
          labMap.get(report.laboratory_id || order?.laboratory_id) ||
          "آزمایشگاه",

        order,

        observations: reportObservations,
      };
    });

  const changes = buildComparison(reportBundle.observations).slice(0, 8);
  const today = getDateInTimeZone();
  const followUps = (followUpRows || []).map((row) => ({
    ...row,
    displayStatus: row.status === "overdue" || (row.status === "pending" && row.due_date < today) ? "overdue" : row.status,
  }));

  const timeline = [];

  for (const order of reportBundle.orders) {
    timeline.push({
      id: `order-${order.id}`,

      kind: "lab_order",

      title: "درخواست آزمایش ثبت شد",

      detail: order.clinical_note || "درخواست آزمایش برای بیمار ثبت شده است.",

      date: order.ordered_at,
    });
  }

  for (const report of reportBundle.reports) {
    timeline.push({
      id: `report-${report.id}`,

      kind: "lab_result",

      title:
        report.status === "amended"
          ? "نتیجه آزمایش اصلاح شد"
          : "نتیجه آزمایش ثبت شد",

      detail:
        report.status === "amended"
          ? "نسخه اصلاح‌شده گزارش در پرونده موجود است."
          : "گزارش نهایی آزمایش دریافت شده است.",

      date: report.finalized_at || report.created_at,

      reportId: report.id,
    });
  }

  for (const note of notes || []) {
    timeline.push({
      id: `note-${note.id}`,

      kind: "note",

      title: "یادداشت خصوصی پزشک",

      detail: note.content,

      date: note.created_at,
    });
  }

  for (const interpretation of interpretations) {
    const report = reportById.get(interpretation.diagnostic_report_id);

    if (!report) {
      continue;
    }

    timeline.push({
      id: `interpretation-${interpretation.id}`,

      kind: "interpretation",

      title: "تفسیر پزشک ثبت شد",

      detail: interpretation.content,

      date: interpretation.created_at,

      reportId: interpretation.diagnostic_report_id,
    });
  }

  for (const notification of reviewedNotifications) {
    const report = notification.related_entity_type === "diagnostic_report"
      ? reportById.get(notification.related_entity_id)
      : null;
    const order = notification.related_entity_type === "lab_order"
      ? orderById.get(notification.related_entity_id)
      : null;
    if (!report && !order) continue;

    timeline.push({
      id: `review-${notification.id}`,
      kind: "review",
      title: report ? "گزارش آزمایش بررسی شد" : "درخواست آزمایش بررسی شد",
      detail: notification.body || notification.title || "پزشک این مورد را بررسی کرده است.",
      date: notification.reviewed_at || notification.created_at,
      reportId: report?.id || null,
      labOrderId: order?.id || report?.lab_order_id || null,
    });
  }

  for (const followUp of followUps) {
    timeline.push({
      id: `follow-up-${followUp.id}`,
      kind: "follow_up",
      title: followUp.displayStatus === "overdue" ? "پیگیری سررسید گذشته" : followUp.status === "completed" ? "پیگیری تکمیل شد" : followUp.status === "cancelled" ? "پیگیری لغو شد" : "پیگیری ثبت شد",
      detail: followUp.title,
      date: followUp.completed_at || followUp.cancelled_at || followUp.due_date || followUp.created_at,
      followUpId: followUp.id,
    });
  }

  for (const visit of visits || []) {
    timeline.push({
      id: `visit-${visit.id}`,
      kind: "visit",
      title: "ویزیت پزشک",
      detail: visit.status === "completed" ? "ویزیت تکمیل شد." : "ویزیت ثبت شد.",
      date: visit.visit_date || visit.created_at,
      visitId: visit.id,
    });
  }

  for (const voiceNote of voiceNotes || []) {
    timeline.push({
      id: `voice-${voiceNote.id}`,
      kind: "voice_note",
      title: "یادداشت صوتی ویزیت ثبت شد",
      detail: `یادداشت صوتی ${Math.round(Number(voiceNote.duration || 0))} ثانیه‌ای برای ویزیت ثبت شده است.`,
      date: voiceNote.created_at,
      visitId: voiceNote.visit_id,
      voiceNoteId: voiceNote.id,
    });
    if (voiceNote.transcript) {
      timeline.push({
        id: `transcript-${voiceNote.transcript.id}`,
        kind: "transcript",
        title: "متن یادداشت صوتی ثبت شد",
        detail: `${voiceNote.transcript.transcript_text.length} نویسه متن پیاده‌سازی‌شده در پرونده موجود است.`,
        date: voiceNote.transcript.created_at,
        visitId: voiceNote.visit_id,
        voiceNoteId: voiceNote.id,
      });
    }
    if (voiceNote.visitSummary) {
      timeline.push({
        id: `summary-${voiceNote.visitSummary.id}`,
        kind: "visit_summary",
        title: voiceNote.visitSummary.doctor_confirmed ? "خلاصه ویزیت تأیید شد" : "پیش‌نویس خلاصه ویزیت ثبت شد",
        detail: voiceNote.visitSummary.doctor_confirmed ? "پزشک خلاصه را تأیید کرده است." : "خلاصه هنوز پیش‌نویس است و تأیید پزشک را ندارد.",
        date: voiceNote.visitSummary.confirmed_at || voiceNote.visitSummary.updated_at || voiceNote.visitSummary.created_at,
        visitId: voiceNote.visit_id,
        voiceNoteId: voiceNote.id,
      });
    }
  }

  for (const prescription of prescriptions || []) {
    timeline.push({
      id: `prescription-${prescription.id}`,

      kind: "prescription",

      title: "نسخه ثبت شد",

      detail:
        prescription.status === "active"
          ? "نسخه فعال برای بیمار ایجاد شد."
          : "نسخه در پرونده ثبت شد.",

      date: prescription.issued_at || prescription.created_at,
    });
  }

  timeline.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return {
    patient: {
      ...profile,
      patientProfile,
      relationship,
    },

    relatedPhysicians: relatedPhysicians || [],

    latestVisit: visits?.[0] || null,

    latestLab: labHistory[0] || null,

    latestNote: (notes || [])[0] || null,

    changes,

    labHistory,

    orders: reportBundle.orders.map((order) => ({
      ...order,

      laboratoryName: labMap.get(order.laboratory_id) || "آزمایشگاه",

      latestReport: latestReportByOrder.get(order.id) || null,

      items: (orderItems || []).filter(
        (item) => item.lab_order_id === order.id,
      ),
    })),

    prescriptions: (prescriptions || []).map((prescription) => ({
      ...prescription,

      items: (prescriptionItems || []).filter(
        (item) => item.prescription_id === prescription.id,
      ),
    })),

    notes: notes || [],

    interpretations,

    timeline,

    followUps,

    visits: visits || [],

    voiceNotes,

    dependencies: {
      followUps: true,
      visits: true,
      voiceNotes: true,
      transcripts: true,
      visitSummaries: true,
    },
  };
}

export async function getPhysicianNotifications() {
  const user = await getSessionUser();

  if (!user || user.role !== "doctor" || user.is_verified !== true) {
    return [];
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, type, title, body, related_entity_type, related_entity_id, is_read, status, reviewed_at, reviewed_by, created_at",
    )
    .eq("recipient_id", user.id)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data || [];
}
