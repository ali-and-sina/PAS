import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getDoctorPatientNotes(doctorId, patientId) {
  if (!doctorId || !patientId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doctor_notes")
    .select("id, patient_id, doctor_id, diagnostic_report_id, content, created_at")
    .eq("doctor_id", doctorId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
