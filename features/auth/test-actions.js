"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { getPostLoginRedirect } from "@/lib/auth";

import {
  getTestUserCredentials,
  isTestLoginEnabled,
  isAdminTestLoginEnabled,
  toAuthPhone,
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

export async function loginTestUser(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, code: "INVALID_INPUT" };
  }
  try {
    return await authenticateTestUser(input);
  } catch (error) {
    console.error("[loginTestUser]", { name: error?.name, code: error?.code });
    try {
      await clearCurrentSession(await createClient());
    } catch {
      // The request may have failed before a client/session could be created.
    }
    return { ok: false, code: "SERVER_ERROR" };
  }
}

async function authenticateTestUser({
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

  if (normalizedContext === "admin" && !isAdminTestLoginEnabled()) {
    return { ok: false, code: "NOT_AVAILABLE" };
  }

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

  let authPhone = toAuthPhone(testUser.phone);
  // A reviewed phone correction must not lock a reserved demo account out.
  // Resolve only the pinned Auth identity, after validating the access code.
  if (testUser.role !== "admin" && testUser.user_id &&
      (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    const {data:reserved,error:directoryError}=await createAdminClient().auth.admin.getUserById(testUser.user_id);
    if(directoryError || reserved?.user?.id!==testUser.user_id || !reserved.user.phone_confirmed_at){
      return {ok:false,code:"SERVER_ERROR"};
    }
    authPhone=toAuthPhone(reserved.user.phone);
  }

  if (!authPhone) {
    return {
      ok: false,
      code: "SERVER_ERROR",
    };
  }

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      phone: authPhone,
      password: process.env.PAS_TEST_AUTH_PASSWORD,
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

  if(testUser.user_id && user.id!==testUser.user_id){
    await clearCurrentSession(supabase);
    return {ok:false,code:"INVALID_INPUT"};
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
          organization_id,
          pas_medical_centers(center_type,is_active)
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

  if (storedPhone !== authPhone.replace(/^\+/, "")) {
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

  // Demo administration is bound to a specific Auth user configured by the
  // owner, in addition to the password, phone and database role checks above.
  // It needs no privileged directory read or service key in the login path.
  if (testUser.role === "admin") {
    if (user.id !== testUser.user_id) {
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

  let patientProfileCompleted = null;
  if (testUser.role === "patient") {
    const { data: patientProfile, error: patientProfileError } = await supabase
      .from("patient_profiles").select("id").eq("id", user.id).maybeSingle();
    if (patientProfileError) {
      await clearCurrentSession(supabase);
      return { ok: false, code: "SERVER_ERROR" };
    }
    patientProfileCompleted = Boolean(patientProfile);
  }

  const center = Array.isArray(laboratoryProfile?.pas_medical_centers) ? laboratoryProfile.pas_medical_centers[0] : laboratoryProfile?.pas_medical_centers;
  if (testUser.role === "laboratory" && center?.is_active !== true) {
    await clearCurrentSession(supabase);
    return {ok:false,code:"NOT_AVAILABLE"};
  }
  const redirectTo = await getPostLoginRedirect({
    center_type: center?.center_type,
    center_active: center?.is_active,
    ...profile,
    is_verified: doctorProfile?.is_verified ?? null,
    specialty: doctorProfile?.specialty ?? null,
    organization_id: laboratoryProfile?.organization_id ?? null,
    patient_profile_completed: patientProfileCompleted,
  });

  return { ok: true, userId: user.id, role: profile.role, redirectTo };
}
