import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeIranianMobile } from "@/lib/utils/validation";

function normalizeStoredPhone(phone) {
  return normalizeIranianMobile(String(phone ?? ""));
}

export async function findPatientForDoctor({ doctorId, nationalId, phone }) {
  if (!doctorId || !nationalId || !phone) {
    return null;
  }

  const admin = createAdminClient();

  const { data: doctor, error: doctorError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", doctorId)
    .maybeSingle();

  if (doctorError) {
    throw doctorError;
  }

  if (!doctor || doctor.role !== "doctor") {
    return null;
  }

  const { data: doctorProfile, error: doctorProfileError } = await admin
    .from("doctor_profiles")
    .select("id, is_verified")
    .eq("id", doctorId)
    .maybeSingle();

  if (doctorProfileError) {
    throw doctorProfileError;
  }

  if (!doctorProfile || doctorProfile.is_verified !== true) {
    return null;
  }

  const { data: candidates, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, phone, national_id")
    .eq("role", "patient")
    .eq("national_id", nationalId);

  if (profileError) {
    throw profileError;
  }

  const normalizedPhone = normalizeStoredPhone(phone);

  const patient =
    (candidates ?? []).find(
      (candidate) => normalizeStoredPhone(candidate.phone) === normalizedPhone,
    ) ?? null;

  if (!patient) {
    return null;
  }

  const { data: patientProfile, error: patientProfileError } = await admin
    .from("patient_profiles")
    .select("id")
    .eq("id", patient.id)
    .maybeSingle();

  if (patientProfileError) {
    throw patientProfileError;
  }

  if (!patientProfile) {
    return null;
  }

  return patient;
}
