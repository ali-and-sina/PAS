import "server-only";

import { getSessionUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function getPatientDoctorRequests(patientId) {
  const user = await getSessionUser();

  if (!user?.id || user.role !== "patient" || user.id !== patientId) {
    return [];
  }

  // Read relationship rows with the normal authenticated client so the
  // existing pdr_select_involved RLS policy remains the row-level boundary.
  const supabase = await createClient();

  const { data: relationships, error: relationshipsError } = await supabase
    .from("patient_doctor_relationships")
    .select("id, doctor_id, status, created_at, relationship_type")
    .eq("patient_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (relationshipsError) throw relationshipsError;
  if (!relationships?.length) return [];

  const doctorIds = [...new Set(relationships.map((row) => row.doctor_id))];

  // Pending relationships are intentionally not covered by the existing
  // related-profile SELECT policies, so only the minimum doctor display
  // fields required by the request card are fetched through service_role.
  const admin = createAdminClient();

  const [{ data: profiles, error: profilesError }, { data: doctorProfiles, error: doctorProfilesError }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name")
        .in("id", doctorIds),
      admin
        .from("doctor_profiles")
        .select("id, specialty, medical_license_number")
        .in("id", doctorIds),
    ]);

  if (profilesError) throw profilesError;
  if (doctorProfilesError) throw doctorProfilesError;

  const profileById = new Map((profiles || []).map((row) => [row.id, row]));
  const doctorProfileById = new Map(
    (doctorProfiles || []).map((row) => [row.id, row]),
  );

  return relationships.map((relationship) => ({
    id: relationship.id,
    doctor_id: relationship.doctor_id,
    status: relationship.status,
    created_at: relationship.created_at,
    relationship_type: relationship.relationship_type,
    doctor: {
      full_name: profileById.get(relationship.doctor_id)?.full_name || null,
      specialty:
        doctorProfileById.get(relationship.doctor_id)?.specialty || null,
      medical_license_number:
        doctorProfileById.get(relationship.doctor_id)
          ?.medical_license_number || null,
    },
  }));
}
