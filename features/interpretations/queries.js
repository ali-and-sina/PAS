import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requirePatient } from "@/features/patient/auth";

export async function getDoctorInterpretations(doctorId) {
  if (!doctorId) return [];

  const supabase = await createClient();

  const { data: interpretations, error } = await supabase
    .from("doctor_interpretations")
    .select(
      "id, diagnostic_report_id, doctor_id, content, is_visible_to_patient, created_at, updated_at",
    )
    .eq("doctor_id", doctorId)
    .order("created_at", {
      ascending: false,
    });

  if (error) throw error;

  if (!interpretations?.length) {
    return [];
  }

  const reportIds = [
    ...new Set(interpretations.map((row) => row.diagnostic_report_id)),
  ];

  const { data: reports, error: reportsError } = await supabase
    .from("diagnostic_reports")
    .select("id, lab_order_id, status, finalized_at")
    .in("id", reportIds);

  if (reportsError) {
    throw reportsError;
  }

  const orderIds = [...new Set((reports || []).map((row) => row.lab_order_id))];

  const { data: orders, error: ordersError } = orderIds.length
    ? await supabase
        .from("lab_orders")
        .select("id, patient_id, ordered_at")
        .in("id", orderIds)
        .eq("doctor_id", doctorId)
    : {
        data: [],
        error: null,
      };

  if (ordersError) {
    throw ordersError;
  }

  const patientIds = [...new Set((orders || []).map((row) => row.patient_id))];

  const { data: patients, error: patientsError } = patientIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", patientIds)
    : {
        data: [],
        error: null,
      };

  if (patientsError) {
    throw patientsError;
  }

  const reportMap = new Map((reports || []).map((row) => [row.id, row]));

  const orderMap = new Map((orders || []).map((row) => [row.id, row]));

  const patientMap = new Map(
    (patients || []).map((row) => [row.id, row.full_name]),
  );

  return interpretations.map((item) => {
    const report = reportMap.get(item.diagnostic_report_id);

    const order = report ? orderMap.get(report.lab_order_id) : null;

    return {
      ...item,
      report,
      patient_id: order?.patient_id || null,
      patient_name: order
        ? patientMap.get(order.patient_id) || "بیمار"
        : "بیمار",
    };
  });
}

export async function getPatientInterpretations() {
  const context = await requirePatient();
  const supabase = await createClient();

  const { data: interpretations, error: interpretationsError } = await supabase
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
    .in("diagnostic_reports.status", ["final", "amended"])
    .order("created_at", { ascending: false });

  if (interpretationsError) {
    throw interpretationsError;
  }

  if (!interpretations?.length) {
    return [];
  }

  const doctorIds = [...new Set(interpretations.map((item) => item.doctor_id))];

  const { data: doctors, error: doctorsError } = doctorIds.length
    ? await supabase
        .from("profiles")
        .select(
          "id, full_name, doctor_profiles!doctor_profiles_id_fkey(specialty)",
        )
        .in("id", doctorIds)
    : { data: [], error: null };

  if (doctorsError) {
    throw doctorsError;
  }

  const doctorMap = new Map(
    (doctors || []).map((doctor) => [
      doctor.id,
      {
        id: doctor.id,
        full_name: doctor.full_name,
        specialty: Array.isArray(doctor.doctor_profiles)
          ? doctor.doctor_profiles[0]?.specialty ?? null
          : doctor.doctor_profiles?.specialty ?? null,
      },
    ]),
  );

  return interpretations.map((item) => ({
    ...item,
    interpretation: item.content,
    doctor_profiles: doctorMap.get(item.doctor_id) || null,
  }));
}
