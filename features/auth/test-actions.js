"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { getPostLoginRedirect } from "@/lib/auth";

import {
  getTestUserCredentials,
  isTestLoginEnabled,
  toAuthPhone,
  TEST_AUTH_PASSWORD,
} from "@/lib/auth/test-session";

async function clearCurrentSession(supabase) {
  try {
    await supabase.auth.signOut({
      scope: "local",
    });
  } catch {
    // Best-effort cleanup only.
  }
}

export async function loginTestUser({
  identifier,
  password,
  loginContext = "public",
} = {}) {
  if (!isTestLoginEnabled()) {
    return {
      ok: false,
      code: "NOT_AVAILABLE",
    };
  }

  /*
   * Admin has a completely separate login entry point.
   *
   * public       -> patient / doctor / laboratory
   * admin        -> admin only
   */
  const normalizedContext = loginContext === "admin" ? "admin" : "public";

  const testUser = getTestUserCredentials(identifier, password);

  if (!testUser) {
    return {
      ok: false,
      code: "INVALID_INPUT",
    };
  }

  /*
   * Never allow admin credentials through the public login.
   */
  if (normalizedContext === "public" && testUser.role === "admin") {
    return {
      ok: false,
      code: "INVALID_INPUT",
    };
  }

  /*
   * Never allow non-admin credentials through the admin login.
   */
  if (normalizedContext === "admin" && testUser.role !== "admin") {
    return {
      ok: false,
      code: "INVALID_INPUT",
    };
  }

  const supabase = await createClient();

  await clearCurrentSession(supabase);

  const authPhone = toAuthPhone(testUser.phone);

  if (!authPhone) {
    return {
      ok: false,
      code: "SERVER_ERROR",
    };
  }

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      phone: authPhone,
      password: TEST_AUTH_PASSWORD,
    });

  if (authError) {
    console.error("[loginTestUser:auth]", authError);

    return {
      ok: false,
      code: "INVALID_INPUT",
    };
  }

  const user = authData?.user;

  if (!user) {
    await clearCurrentSession(supabase);

    return {
      ok: false,
      code: "SERVER_ERROR",
    };
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
          license_number,
          organization_id
        )
      `,
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("[loginTestUser:profile]", profileError);

    await clearCurrentSession(supabase);

    return {
      ok: false,
      code: "SERVER_ERROR",
    };
  }

  /*
   * Database role must match the test-user role.
   */
  if (profile.role !== testUser.role) {
    await clearCurrentSession(supabase);

    return {
      ok: false,
      code: "INVALID_INPUT",
    };
  }

  /*
   * The authenticated profile phone must match the
   * server-side test-user contract.
   */
  const storedPhone = String(profile.phone ?? "")
    .trim()
    .replace(/^\+/, "");

  if (storedPhone !== testUser.phone) {
    await clearCurrentSession(supabase);

    return {
      ok: false,
      code: "INVALID_INPUT",
    };
  }

  /*
   * Doctor-specific validation.
   */
  if (testUser.role === "doctor") {
    const doctorProfile = Array.isArray(profile.doctor_profiles)
      ? profile.doctor_profiles[0]
      : profile.doctor_profiles;

    if (
      !doctorProfile ||
      doctorProfile.medical_license_number !== testUser.identifier ||
      doctorProfile.is_verified !== true
    ) {
      await clearCurrentSession(supabase);

      return {
        ok: false,
        code: "INVALID_INPUT",
      };
    }
  }

  /*
   * Laboratory-specific validation.
   */
  if (testUser.role === "laboratory") {
    const laboratoryProfile = Array.isArray(profile.laboratory_profiles)
      ? profile.laboratory_profiles[0]
      : profile.laboratory_profiles;

    if (
      !laboratoryProfile ||
      laboratoryProfile.license_number !== testUser.identifier
    ) {
      await clearCurrentSession(supabase);

      return {
        ok: false,
        code: "INVALID_INPUT",
      };
    }
  }

  /*
   * Admin-specific validation.
   *
   * Admin must have:
   * 1. profiles.role = admin
   * 2. matching admin_profiles row
   * 3. matching personnel_code
   *
   * This is intentionally checked after the real Supabase
   * authentication has been established.
   */
  if (testUser.role === "admin") {
    const adminClient = createAdminClient();
    const { data: adminProfile, error: adminProfileError } = await adminClient
      .from("admin_profiles")
      .select("personnel_code")
      .eq("id", user.id)
      .single();

    if (
      adminProfileError ||
      !adminProfile ||
      adminProfile.personnel_code !== testUser.identifier
    ) {
      console.error("[loginTestUser:adminProfile]", adminProfileError);

      await clearCurrentSession(supabase);

      return {
        ok: false,
        code: "INVALID_INPUT",
      };
    }
  }

  const doctorProfile = Array.isArray(profile.doctor_profiles)
    ? profile.doctor_profiles[0]
    : profile.doctor_profiles;

  const laboratoryProfile = Array.isArray(profile.laboratory_profiles)
    ? profile.laboratory_profiles[0]
    : profile.laboratory_profiles;

  const redirectTo = await getPostLoginRedirect({
    ...profile,
    is_verified: doctorProfile?.is_verified ?? null,
    specialty: doctorProfile?.specialty ?? null,
    organization_id: laboratoryProfile?.organization_id ?? null,
    patient_profile_completed: testUser.role === "patient" ? true : null,
  });

  return { ok: true, userId: user.id, role: profile.role, redirectTo };
}
