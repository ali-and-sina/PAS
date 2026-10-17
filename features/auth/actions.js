"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPostLoginRedirect } from "@/lib/auth";
import { isValidIranianNationalId, normalizeDigits, normalizeIranianMobile } from "@/lib/utils/validation";

// Admin is handled through the same OTP action, but its personnel-code/phone
// pair is verified against the private admin directory before sending OTP.
const ROLES = new Set(["patient", "doctor", "laboratory", "admin"]);

function normalizeString(value) {
  return typeof value === "string" ? normalizeDigits(value).trim() : "";
}

function normalizePhone(value) {
  const normalized = normalizeIranianMobile(value) ?? "";
  return normalized.replace(/^\+/, "");
}

function isValidPhone(phone) {
  return /^989\d{9}$/.test(phone);
}

/** Validate the Iranian national ID format and checksum on the server. */
function isValidNationalId(value) {
  return isValidIranianNationalId(value);
}

/**
 * Validate the identifier according to the selected role.
 */
function isValidIdentifier(role, identifier) {
  if (role === "patient") {
    return isValidNationalId(identifier);
  }

  return identifier.length > 0 && identifier.length <= 100;
}

/**
 * Supabase SMS OTP is six digits.
 */
function isValidOtp(code) {
  return /^\d{6}$/.test(code);
}

/**
 * Invalid request.
 */
function invalidInput() {
  return {
    ok: false,
    code: "INVALID_INPUT",
  };
}

/**
 * Best-effort local session cleanup.
 *
 * This is intentionally local-only:
 * we want to clear the browser/server session used by
 * the current login flow, without affecting other sessions.
 */
async function clearCurrentSession(supabase) {
  try {
    await supabase.auth.signOut({
      scope: "local",
    });
  } catch {
    // Best-effort cleanup only.
  }
}

/**
 * Convert Supabase Auth OTP errors into stable application codes.
 */
function mapOtpError(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();

  if (
    code === "otp_disabled" &&
    message.includes("signups not allowed for otp")
  ) {
    return "USER_NOT_FOUND";
  }

  if (
    message.includes("rate") ||
    message.includes("too many") ||
    message.includes("limit")
  ) {
    return "RATE_LIMITED";
  }

  if (message.includes("expired") || message.includes("otp has expired")) {
    return "EXPIRED_OTP";
  }

  if (
    message.includes("invalid") ||
    message.includes("incorrect") ||
    message.includes("token")
  ) {
    return "WRONG_OTP";
  }

  return "SERVER_ERROR";
}

/**
 * Request a login / registration OTP.
 *
 * Patient:
 *   - can create a new Auth user
 *   - national_id is stored in Auth metadata
 *
 * Doctor / Laboratory:
 *   - Auth user must already exist
 *   - no new Auth user is created
 *
 * IMPORTANT:
 * The role selected by the UI is only used to determine the
 * authentication flow. It is NOT trusted for authorization.
 */
export async function requestLoginOtp({ role, identifier, phone } = {}) {
  try {
    role = normalizeString(role);
    identifier = normalizeString(identifier);
    phone = normalizePhone(phone);

    if (!ROLES.has(role)) {
      return invalidInput();
    }

    if (!isValidIdentifier(role, identifier)) {
      return invalidInput();
    }

    if (!isValidPhone(phone)) {
      return invalidInput();
    }

    // Do not send an admin OTP unless both the personnel code and phone
    // belong to the same active admin record. admin_profiles intentionally
    // has no direct SELECT grant/policy for authenticated users, so this
    // lookup must use the server-only privileged client.
    if (role === "admin") {
      const privileged = createAdminClient();
      const { data: adminRecord, error: adminRecordError } = await privileged
        .from("admin_profiles")
        .select("id, personnel_code")
        .eq("personnel_code", identifier)
        .maybeSingle();

      if (adminRecordError) {
        console.error("[requestLoginOtp:adminRecord]", adminRecordError);
        return { ok: false, code: "SERVER_ERROR" };
      }

      if (!adminRecord) return invalidInput();

      const { data: adminIdentity, error: adminIdentityError } = await privileged
        .from("profiles")
        .select("id, role, phone")
        .eq("id", adminRecord.id)
        .maybeSingle();

      if (adminIdentityError) {
        console.error("[requestLoginOtp:adminIdentity]", adminIdentityError);
        return { ok: false, code: "SERVER_ERROR" };
      }

      if (
        !adminIdentity ||
        adminIdentity.role !== "admin" ||
        normalizePhone(adminIdentity.phone) !== phone
      ) {
        return invalidInput();
      }
    }

    const supabase = await createClient();

    /**
     * Important:
     *
     * If another user/session is already authenticated in this
     * browser, clear the local session before starting a new
     * login flow. This prevents role/session contamination.
     */
    await clearCurrentSession(supabase);

    const shouldCreateUser = role === "patient";

    const authPhone = `+${phone}`;

    const { error } = await supabase.auth.signInWithOtp({
      phone: authPhone,
      options: {
        shouldCreateUser,
        ...(role === "patient"
          ? {
              data: {
                national_id: identifier,
              },
            }
          : {}),
      },
    });

    if (error) {
      console.error("========== LOGIN OTP ERROR ==========");
      console.error("message:", error.message);
      console.error("status:", error.status);
      console.error("name:", error.name);
      console.error("code:", error.code);
      console.error("details:", error);
      console.error("=====================================");

      return {
        ok: false,
        code: mapOtpError(error),
      };
    }

    return {
      ok: true,
    };
  } catch (error) {
    console.error("[requestLoginOtp]", error);

    return {
      ok: false,
      code: "SERVER_ERROR",
    };
  }
}

/**
 * Verify OTP and complete authentication.
 *
 * Flow:
 *
 * 1. Verify Supabase SMS OTP.
 * 2. Read the authenticated user's profile.
 * 3. Verify that the database role matches the requested flow.
 * 4. Verify phone number.
 * 5. Verify role-specific identifier.
 * 6. Verify role-specific domain profile.
 * 7. Redirect according to the authenticated profile.
 *
 * Important:
 *
 * After verifyOtp succeeds, Supabase has established a session.
 * Therefore any later domain-level validation failure must also
 * clear that local session before returning login failure.
 */
export async function verifyLoginOtp({ role, identifier, phone, code } = {}) {
  let supabase = null;
  let authEstablished = false;

  try {
    role = normalizeString(role);
    identifier = normalizeString(identifier);
    phone = normalizePhone(phone);
    code = normalizeString(code);

    if (!ROLES.has(role)) {
      return invalidInput();
    }

    if (!isValidIdentifier(role, identifier)) {
      return invalidInput();
    }

    if (!isValidPhone(phone)) {
      return invalidInput();
    }

    if (!isValidOtp(code)) {
      return invalidInput();
    }

    supabase = await createClient();

    /**
     * Once OTP verification succeeds, a session exists. authEstablished lets
     * the outer catch distinguish pre-auth failures from post-auth failures.
     */

    /**
     * Domain/authz failure after OTP success.
     *
     * Example:
     * - OTP is correct
     * - but user is not a doctor
     * - or doctor profile is missing
     * - or license does not match
     * - or doctor is unverified
     *
     * In all of those cases, we must not leave a valid session
     * behind while telling the UI "login failed".
     */
    const authFailure = async (errorCode = "NOT_VERIFIED") => {
      if (authEstablished) {
        await clearCurrentSession(supabase);
      }

      return {
        ok: false,
        code: errorCode,
      };
    };

    /**
     * Step 1:
     * Verify SMS OTP.
     *
     * Supabase SSR stores the resulting session through
     * the cookie adapter in lib/supabase/server.js.
     */
    const authPhone = `+${phone}`;

    const { data: verifyData, error: verifyError } =
      await supabase.auth.verifyOtp({
        phone: authPhone,
        token: code,
        type: "sms",
      });

    if (verifyError) {
      console.error("[verifyLoginOtp:otp]", verifyError);

      return {
        ok: false,
        code: mapOtpError(verifyError),
      };
    }

    const user = verifyData?.user;

    if (!user) {
      return {
        ok: false,
        code: "NOT_VERIFIED",
      };
    }

    /**
     * OTP verification succeeded.
     *
     * From this point forward, domain validation failures
     * must clean up the session.
     */
    authEstablished = true;

    /**
     * Step 2:
     * Read the authenticated user's profile.
     *
     * Explicitly use the doctor_profiles foreign key because
     * there can be multiple possible relationships in the schema.
     */
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        role,
        full_name,
        phone,
        national_id,
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
      .maybeSingle();

    if (profileError) {
      console.error("[verifyLoginOtp:profile]", profileError);

      return authFailure("SERVER_ERROR");
    }

    if (!profile) {
      return authFailure();
    }

    /**
     * Step 3:
     *
     * The selected role from the UI is NOT trusted.
     * The actual role comes from public.profiles.
     */
    if (profile.role !== role) {
      return authFailure();
    }

    /**
     * Step 4:
     * Verify the authenticated user's phone.
     */
    const profilePhone = normalizePhone(profile.phone);

    if (!profilePhone || profilePhone !== phone) {
      return authFailure();
    }

    /**
     * Step 5:
     * Verify role-specific identifier and domain profile.
     */
    if (role === "patient") {
      /**
       * Patient identity:
       *
       * The authenticated profile must contain the same national ID
       * that was entered at login.
       */
      if (profile.national_id !== identifier) {
        return authFailure();
      }

      /**
       * Patient onboarding state:
       *
       * Existence of patient_profiles is the single source of truth.
       *
       * Auth user exists
       * + profiles row exists
       * + patient_profiles row DOES NOT exist
       * = new/incomplete patient
       */
      const { data: patientProfile, error: patientProfileError } =
        await supabase
          .from("patient_profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

      if (patientProfileError) {
        console.error("[verifyLoginOtp:patient_profile]", patientProfileError);

        return authFailure("SERVER_ERROR");
      }

      if (!patientProfile) {
        /**
         * This is an intentional onboarding response,
         * not an authentication failure.
         *
         * At this point the user is authenticated, and the next
         * step is to collect the mandatory patient profile data.
         */
        return {
          ok: true,
          isNewUser: true,
          redirectTo: "/patient/complete-profile",
        };
      }
    }

    if (role === "doctor") {
      /**
       * IMPORTANT:
       * doctor_profiles is the nested object.
       *
       * Do NOT check Array.isArray(profile.medical_license_number).
       */
      const doctorProfile = Array.isArray(profile.doctor_profiles)
        ? profile.doctor_profiles[0]
        : profile.doctor_profiles;

      /**
       * A doctor Auth user without a domain doctor profile
       * is not authorized to enter the doctor area.
       */
      if (!doctorProfile) {
        return authFailure();
      }

      /**
       * Doctor login requires:
       *
       * - license matches requested identifier
       * - doctor profile is verified
       */
      if (
        doctorProfile.medical_license_number !== identifier ||
        doctorProfile.is_verified !== true
      ) {
        return authFailure();
      }
    }

    if (role === "laboratory") {
      const laboratoryProfile = Array.isArray(profile.laboratory_profiles)
        ? profile.laboratory_profiles[0]
        : profile.laboratory_profiles;

      /**
       * A laboratory Auth user without a domain laboratory profile
       * is not authorized to enter the laboratory area.
       */
      if (!laboratoryProfile) {
        return authFailure();
      }

      /**
       * Laboratory login requires the entered license number
       * to match the trusted domain profile.
       */
      if (laboratoryProfile.license_number !== identifier) {
        return authFailure();
      }
    }

    if (role === "admin") {
      // admin_profiles is deliberately inaccessible to the session client.
      const privileged = createAdminClient();
      const { data: adminProfile, error: adminProfileError } = await privileged
        .from("admin_profiles")
        .select("personnel_code")
        .eq("id", user.id)
        .maybeSingle();

      if (adminProfileError) {
        console.error("[verifyLoginOtp:adminProfile]", adminProfileError);
        return authFailure("SERVER_ERROR");
      }

      if (!adminProfile || adminProfile.personnel_code !== identifier) {
        return authFailure();
      }
    }

    /**
     * Step 6:
     * Authentication and role-specific verification succeeded.
     *
     * Routing is based on the trusted database profile.
     */
    const doctorProfile = Array.isArray(profile.doctor_profiles)
      ? profile.doctor_profiles[0]
      : profile.doctor_profiles;

    const laboratoryProfile = Array.isArray(profile.laboratory_profiles)
      ? profile.laboratory_profiles[0]
      : profile.laboratory_profiles;

    /**
     * Important:
     *
     * Patient onboarding was already handled above.
     * Therefore reaching this section for a patient means that
     * patient_profiles exists and onboarding is complete.
     */
    const redirectTo = await getPostLoginRedirect({
      id: profile.id,
      role: profile.role,
      full_name: profile.full_name,
      phone: profile.phone,
      avatar_url: profile.avatar_url,

      is_verified: doctorProfile?.is_verified ?? null,

      specialty: doctorProfile?.specialty ?? null,

      organization_id: laboratoryProfile?.organization_id ?? null,

      patient_profile_completed: role === "patient" ? true : null,
    });

    return {
      ok: true,
      isNewUser: false,
      redirectTo,
    };
  } catch (error) {
    console.error("[verifyLoginOtp]", error);

    /**
     * If OTP had already established a session,
     * make sure the failure cannot leave that session behind.
     *
     * We cannot access authFailure here because it is scoped
     * inside the try block, so cleanup directly.
     */
    if (authEstablished && supabase) {
      await clearCurrentSession(supabase);
    }

    return {
      ok: false,
      code: "SERVER_ERROR",
    };
  }
}
