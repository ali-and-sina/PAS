import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getTestSessionUser } from "@/lib/auth/test-session";

/**
 * Server-only.
 *
 * Test login is development-only and intentionally bypasses Supabase Auth.
 * Production always uses the real Supabase Auth session.
 */
export async function getSessionUser() {
  const testUser = await getTestSessionUser();

  if (testUser) {
    return testUser;
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      `
      id,
      role,
      full_name,
      phone,
      avatar_url,
      doctor_profiles!doctor_profiles_id_fkey (
        medical_license_number,
        is_verified,
        specialty
      ),
      laboratory_profiles (
        organization_id
      )
      `,
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  let patientProfileCompleted = null;

  if (profile.role === "patient") {
    const { data: patientProfile, error: patientProfileError } = await supabase
      .from("patient_profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (patientProfileError) {
      return null;
    }

    patientProfileCompleted = Boolean(patientProfile);
  }

  const doctorProfile = Array.isArray(profile.doctor_profiles)
    ? profile.doctor_profiles[0]
    : profile.doctor_profiles;

  const laboratoryProfile = Array.isArray(profile.laboratory_profiles)
    ? profile.laboratory_profiles[0]
    : profile.laboratory_profiles;

  return {
    id: profile.id,
    role: profile.role,
    full_name: profile.full_name,
    phone: profile.phone,
    avatar_url: profile.avatar_url,
    is_verified: doctorProfile?.is_verified ?? null,
    specialty: doctorProfile?.specialty ?? null,
    organization_id: laboratoryProfile?.organization_id ?? null,
    patient_profile_completed: patientProfileCompleted,
  };
}
