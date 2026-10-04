import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function getNames(ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (!uniqueIds.length) return new Map();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", uniqueIds);

  if (error) throw error;
  return new Map((data || []).map((row) => [row.id, row.full_name]));
}

export async function getDoctorInterpretations(doctorId) {
  if (!doctorId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doctor_interpretations")
    .select(
      "id, diagnostic_report_id, doctor_id, content, is_visible_to_patient, created_at, updated_at",
    )
    .eq("doctor_id", doctorId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPatientInterpretations(patientId) {
  if (!patientId) return [];

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
      diagnostic_reports!inner (
        id,
        status,
        lab_order_id,
        lab_orders!diagnostic_reports_lab_order_id_fkey!inner (
          id,
          patient_id,
          ordered_at
        )
      )
    `,
    )
    .eq("is_visible_to_patient", true)
    .eq("diagnostic_reports.lab_orders.patient_id", patientId)
    .in("diagnostic_reports.status", ["final", "amended"])
    .order("created_at", { ascending: false });

  if (error) throw error;

  const doctorNames = await getNames(
    (data || []).map((item) => item.doctor_id),
  );

  return (data || []).map((item) => ({
    ...item,
    interpretation: item.content,
    doctor_name:
      doctorNames.get(item.doctor_id) || "پزشک",
  }));
}
