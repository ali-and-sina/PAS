import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function getDoctorNames(ids) {
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

export async function getDoctorPrescriptions(doctorId) {
  if (!doctorId) return [];

  const supabase = await createClient();
  const { data: prescriptions, error } = await supabase
    .from("prescriptions")
    .select(
      "id, patient_id, doctor_id, diagnostic_report_id, status, issued_at, created_at",
    )
    .eq("doctor_id", doctorId)
    .order("issued_at", { ascending: false });

  if (error) throw error;
  if (!prescriptions?.length) return [];

  const patientIds = [
    ...new Set(prescriptions.map((row) => row.patient_id)),
  ];
  const prescriptionIds = prescriptions.map((row) => row.id);

  const [patientsResult, itemsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", patientIds),
    supabase
      .from("prescription_items")
      .select(
        "id, prescription_id, medication_name, dosage, frequency, duration, instructions",
      )
      .in("prescription_id", prescriptionIds),
  ]);

  if (patientsResult.error) throw patientsResult.error;
  if (itemsResult.error) throw itemsResult.error;

  const patients = new Map(
    (patientsResult.data || []).map((row) => [row.id, row.full_name]),
  );

  return prescriptions.map((prescription) => ({
    ...prescription,
    patient_name:
      patients.get(prescription.patient_id) || "بیمار",
    items: (itemsResult.data || []).filter(
      (item) => item.prescription_id === prescription.id,
    ),
  }));
}

export async function getDoctorPatientPrescriptions(doctorId, patientId) {
  const prescriptions = await getDoctorPrescriptions(doctorId);
  return prescriptions.filter(
    (item) => item.patient_id === patientId,
  );
}

export async function getPatientPrescriptions(patientId) {
  if (!patientId) return [];

  const supabase = await createClient();
  const { data: prescriptions, error } = await supabase
    .from("prescriptions")
    .select(
      "id, patient_id, doctor_id, diagnostic_report_id, status, issued_at, created_at",
    )
    .eq("patient_id", patientId)
    .order("issued_at", { ascending: false });

  if (error) throw error;
  if (!prescriptions?.length) return [];

  const prescriptionIds = prescriptions.map((row) => row.id);

  const { data: items, error: itemsError } = await supabase
    .from("prescription_items")
    .select(
      "id, prescription_id, medication_name, dosage, frequency, duration, instructions, created_at",
    )
    .in("prescription_id", prescriptionIds);

  if (itemsError) throw itemsError;

  const doctorNames = await getDoctorNames(
    prescriptions.map((row) => row.doctor_id),
  );

  return prescriptions.map((prescription) => ({
    ...prescription,
    doctor_name:
      doctorNames.get(prescription.doctor_id) || "پزشک",
    items: (items || []).filter(
      (item) => item.prescription_id === prescription.id,
    ),
  }));
}
