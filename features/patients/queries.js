import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getDoctorPatients(doctorId) {
  if (!doctorId) return [];

  const supabase = await createClient();

  const { data: relationships, error } = await supabase
    .from("patient_doctor_relationships")
    .select("patient_id, status")
    .eq("doctor_id", doctorId)
    .eq("status", "active")
    .order("patient_id");

  if (error) throw error;
  if (!relationships?.length) return [];

  const patientIds = relationships.map((row) => row.patient_id);

  const [
    { data: profiles, error: profilesError },
    { data: patientProfiles, error: patientProfilesError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone, national_id, created_at")
      .in("id", patientIds),

    supabase
      .from("patient_profiles")
      .select("id, date_of_birth, sex, blood_type")
      .in("id", patientIds),
  ]);

  if (profilesError) throw profilesError;
  if (patientProfilesError) {
    throw patientProfilesError;
  }

  const byId = new Map((patientProfiles || []).map((row) => [row.id, row]));

  return (profiles || []).map((profile) => ({
    ...profile,
    patientProfile: byId.get(profile.id) || null,
  }));
}

export async function getDoctorPatient(doctorId, patientId) {
  if (!doctorId || !patientId) {
    return null;
  }

  const supabase = await createClient();

  const { data: relationship, error: relationshipError } = await supabase
    .from("patient_doctor_relationships")
    .select("patient_id, doctor_id, status")
    .eq("doctor_id", doctorId)
    .eq("patient_id", patientId)
    .eq("status", "active")
    .maybeSingle();

  if (relationshipError) {
    throw relationshipError;
  }

  if (!relationship) {
    return null;
  }

  const [
    { data: profile, error: profileError },
    { data: patientProfile, error: patientProfileError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone, national_id, created_at")
      .eq("id", patientId)
      .maybeSingle(),

    supabase
      .from("patient_profiles")
      .select("id, date_of_birth, sex, blood_type")
      .eq("id", patientId)
      .maybeSingle(),
  ]);

  if (profileError) throw profileError;
  if (patientProfileError) {
    throw patientProfileError;
  }

  if (!profile) {
    return null;
  }

  return {
    ...profile,
    patientProfile,
    relationship,
  };
}

export async function findPatientByIdentity({ nationalId, phone }) {
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, phone, national_id")
    .eq("role", "patient")
    .eq("national_id", nationalId);

  if (phone) {
    query = query.eq("phone", phone);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;

  return data || null;
}
