import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Server-only. Returns the enriched session user object.
 * Shape: { id, role, full_name, phone, avatar_url,
 *          is_verified, specialty, organization_id }
 */
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      `
      id, role, full_name, phone, avatar_url,
      doctor_profiles!doctor_profiles_id_fkey (
      medical_license_number,
      is_verified,
      specialty
     ),
      laboratory_profiles (organization_id)
    `,
    )
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    role: profile.role,
    full_name: profile.full_name,
    phone: profile.phone,
    avatar_url: profile.avatar_url,
    is_verified: profile.doctor_profiles?.is_verified ?? null,
    specialty: profile.doctor_profiles?.specialty ?? null,
    organization_id: profile.laboratory_profiles?.organization_id ?? null,
  };
}
