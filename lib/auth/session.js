import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getSessionUser() {
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
        organization_id,
        pas_medical_centers(center_type,is_active,display_name)
      )
      `,
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("[getSessionUser:profile]", profileError);

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
      console.error("[getSessionUser:patient_profile]", patientProfileError);

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

  const center = Array.isArray(laboratoryProfile?.pas_medical_centers) ? laboratoryProfile.pas_medical_centers[0] : laboratoryProfile?.pas_medical_centers;

  return {
    id: profile.id,
    role: profile.role === "laboratory" && (center?.center_type !== "laboratory" || center?.is_active !== true) ? "medical_center" : profile.role,
    database_role: profile.role,
    center_type: center?.center_type || null,
    center_active: center?.is_active ?? false,
    center_name: center?.display_name || null,
    full_name: profile.full_name,
    phone: profile.phone,
    avatar_url: profile.avatar_url,
    is_verified: doctorProfile?.is_verified ?? null,
    specialty: doctorProfile?.specialty ?? null,
    organization_id: laboratoryProfile?.organization_id ?? null,
    patient_profile_completed: patientProfileCompleted,
  };
}
