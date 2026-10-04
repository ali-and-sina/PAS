import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function getAuthenticatedPatient() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, national_id, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || profile.role !== "patient") return null;

  return { supabase, user, profile };
}

async function getDoctorNames(doctorIds) {
  const ids = [...new Set((doctorIds || []).filter(Boolean))];
  if (!ids.length) return new Map();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);

  if (error) throw error;

  return new Map((data || []).map((row) => [row.id, row.full_name]));
}

async function getPatientReportsForDashboard(supabase, patientId) {
  const { data, error } = await supabase
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
        doctor_id,
        laboratory_id,
        ordered_at
      )
    `,
    )
    .eq("lab_orders.patient_id", patientId)
    .in("status", ["final", "amended"])
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw error;
  return data || [];
}

export async function getPatientDashboard() {
  const context = await getAuthenticatedPatient();

  if (!context) {
    return {
      patient: null,
      unreadNotifications: 0,
      pendingRequests: 0,
      recentResults: [],
      recentPrescriptions: [],
    };
  }

  const { supabase, user, profile } = context;

  const [
    unreadNotificationsResult,
    pendingRelationshipsResult,
    recentResults,
    prescriptionsResult,
  ] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false),

    supabase
      .from("patient_doctor_relationships")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", user.id)
      .eq("status", "pending"),

    getPatientReportsForDashboard(supabase, user.id),

    supabase
      .from("prescriptions")
      .select("id, doctor_id, status, issued_at, created_at")
      .eq("patient_id", user.id)
      .order("issued_at", { ascending: false })
      .limit(5),
  ]);

  if (unreadNotificationsResult.error) {
    throw unreadNotificationsResult.error;
  }

  if (pendingRelationshipsResult.error) {
    throw pendingRelationshipsResult.error;
  }

  if (prescriptionsResult.error) {
    throw prescriptionsResult.error;
  }

  const doctorNames = await getDoctorNames(
    (prescriptionsResult.data || []).map((item) => item.doctor_id),
  );

  return {
    patient: profile,
    unreadNotifications: unreadNotificationsResult.count || 0,
    pendingRequests: pendingRelationshipsResult.count || 0,
    recentResults,
    recentPrescriptions: (prescriptionsResult.data || []).map(
      (prescription) => ({
        ...prescription,
        doctor_name:
          doctorNames.get(prescription.doctor_id) || "پزشک",
      }),
    ),
  };
}

export async function getPatientHealthRecord() {
  const context = await getAuthenticatedPatient();

  if (!context) return null;

  const { supabase, user, profile } = context;

  const [
    patientProfileResult,
    relationshipsResult,
    reportsResult,
    prescriptionsResult,
  ] = await Promise.all([
    supabase
      .from("patient_profiles")
      .select(
        "id, date_of_birth, sex, blood_type, emergency_contact_name, emergency_contact_phone, created_at",
      )
      .eq("id", user.id)
      .maybeSingle(),

    supabase
      .from("patient_doctor_relationships")
      .select(
        "id, doctor_id, relationship_type, status, started_at, ended_at, created_at",
      )
      .eq("patient_id", user.id)
      .in("status", ["active", "pending"])
      .order("created_at", { ascending: false }),

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
          doctor_id,
          ordered_at
        )
      `,
      )
      .eq("lab_orders.patient_id", user.id)
      .in("status", ["final", "amended"])
      .order("created_at", { ascending: false })
      .limit(5),

    supabase
      .from("prescriptions")
      .select("id, doctor_id, status, issued_at, created_at")
      .eq("patient_id", user.id)
      .order("issued_at", { ascending: false })
      .limit(5),
  ]);

  if (patientProfileResult.error) throw patientProfileResult.error;
  if (relationshipsResult.error) throw relationshipsResult.error;
  if (reportsResult.error) throw reportsResult.error;
  if (prescriptionsResult.error) throw prescriptionsResult.error;

  const doctorIds = [
    ...(relationshipsResult.data || []).map((row) => row.doctor_id),
    ...(prescriptionsResult.data || []).map((row) => row.doctor_id),
    ...(reportsResult.data || []).map(
      (row) => row.lab_orders?.doctor_id,
    ),
  ];

  const doctorNames = await getDoctorNames(doctorIds);

  return {
    profile,
    patientProfile: patientProfileResult.data || null,
    doctors: (relationshipsResult.data || []).map((relationship) => ({
      ...relationship,
      doctor_name:
        doctorNames.get(relationship.doctor_id) || "پزشک",
    })),
    recentReports: (reportsResult.data || []).map((report) => ({
      ...report,
      doctor_name:
        doctorNames.get(report.lab_orders?.doctor_id) || "پزشک",
    })),
    recentPrescriptions: (prescriptionsResult.data || []).map(
      (prescription) => ({
        ...prescription,
        doctor_name:
          doctorNames.get(prescription.doctor_id) || "پزشک",
      }),
    ),
  };
}
