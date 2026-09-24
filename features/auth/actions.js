"use server";

import { createClient } from "@/lib/supabase/server";
import { getPostLoginRedirect } from "@/lib/auth";
import { normalizeIranianMobile } from "@/lib/utils/validation";

const ROLES = new Set(["patient", "doctor", "laboratory"]);

/**
 * Normalize a generic string.
 */
function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Normalize Iranian mobile numbers to E.164.
 *
 * Examples:
 * 09121234567   -> +989121234567
 * 9121234567    -> +989121234567
 * 989121234567  -> +989121234567
 * +989121234567 -> +989121234567
 * 00989121234567 -> +989121234567
 */
function normalizePhone(value) {
  return normalizeIranianMobile(value) ?? "";
}

/**
 * Only accept canonical Iranian E.164 mobile numbers.
 */
function isValidPhone(phone) {
  return /^\+989\d{9}$/.test(phone);
}

/**
 * Iranian national ID.
 *
 * At this layer we only require 10 Latin digits.
 * Full checksum validation is handled by the shared
 * validation helper before registration.
 */
function isValidNationalId(value) {
  return /^\d{10}$/.test(value);
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
 * Convert Supabase Auth OTP errors into stable application codes.
 */
function mapOtpError(error) {
  const message = String(error?.message || "").toLowerCase();

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

    const supabase = await createClient();

    const shouldCreateUser = role === "patient";

    const { error } = await supabase.auth.signInWithOtp({
      phone,
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
 * 6. Redirect according to the authenticated profile.
 */
export async function verifyLoginOtp({ role, identifier, phone, code } = {}) {
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

    const supabase = await createClient();

    /**
     * Step 1:
     * Verify SMS OTP.
     *
     * Supabase SSR stores the resulting session through
     * the cookie adapter in lib/supabase/server.js.
     */
    const { data: verifyData, error: verifyError } =
      await supabase.auth.verifyOtp({
        phone,
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
     * Step 2:
     * The OTP has been verified.
     *
     * Now the request is authenticated, so RLS can allow
     * the user to read their own profile.
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

      return {
        ok: false,
        code: "SERVER_ERROR",
      };
    }

    if (!profile) {
      return {
        ok: false,
        code: "NOT_VERIFIED",
      };
    }

    /**
     * Step 3:
     *
     * The selected role from the UI is NOT trusted.
     * The actual role comes from public.profiles.
     */
    if (profile.role !== role) {
      return {
        ok: false,
        code: "NOT_VERIFIED",
      };
    }

    /**
     * Step 4:
     * Verify the authenticated user's phone.
     */
    const profilePhone = normalizePhone(profile.phone);

    if (!profilePhone || profilePhone !== phone) {
      return {
        ok: false,
        code: "NOT_VERIFIED",
      };
    }

    /**
     * Step 5:
     * Verify the role-specific identifier.
     */
    if (role === "patient") {
      if (profile.national_id !== identifier) {
        return {
          ok: false,
          code: "NOT_VERIFIED",
        };
      }

      /**
       * A patient is considered a new patient when:
       *
       * - Auth user exists
       * - profiles row exists
       * - patient_profiles row does not exist
       *
       * We deliberately do NOT use full_name === "کاربر جدید".
       */
      const { data: patientProfile, error: patientProfileError } =
        await supabase
          .from("patient_profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

      if (patientProfileError) {
        console.error("[verifyLoginOtp:patient_profile]", patientProfileError);

        return {
          ok: false,
          code: "SERVER_ERROR",
        };
      }

      if (!patientProfile) {
        return {
          ok: true,
          isNewUser: true,
          redirectTo: "/patient/complete-profile",
        };
      }
    }

    if (role === "doctor") {
      const doctorProfile = Array.isArray(profile.medical_license_number)
        ? profile.doctor_profiles[0]
        : profile.doctor_profiles;

      if (!doctorProfile) {
        return {
          ok: false,
          code: "NOT_VERIFIED",
        };
      }

      if (
        doctorProfile.medical_license_number !== identifier ||
        doctorProfile.is_verified !== true
      ) {
        return {
          ok: false,
          code: "NOT_VERIFIED",
        };
      }
    }

    if (role === "laboratory") {
      const laboratoryProfile = Array.isArray(profile.laboratory_profiles)
        ? profile.laboratory_profiles[0]
        : profile.laboratory_profiles;

      if (!laboratoryProfile) {
        return {
          ok: false,
          code: "NOT_VERIFIED",
        };
      }

      if (laboratoryProfile.license_number !== identifier) {
        return {
          ok: false,
          code: "NOT_VERIFIED",
        };
      }
    }

    /**
     * Step 6:
     * Authentication and role-specific verification succeeded.
     *
     * Routing is based on the trusted database profile.
     */
    const redirectTo = await getPostLoginRedirect({
      id: profile.id,
      role: profile.role,
      full_name: profile.full_name,
      phone: profile.phone,
      avatar_url: profile.avatar_url,

      is_verified: Array.isArray(profile.doctor_profiles)
        ? (profile.doctor_profiles[0]?.is_verified ?? null)
        : (profile.doctor_profiles?.is_verified ?? null),

      specialty: Array.isArray(profile.doctor_profiles)
        ? (profile.doctor_profiles[0]?.specialty ?? null)
        : (profile.doctor_profiles?.specialty ?? null),

      organization_id: Array.isArray(profile.laboratory_profiles)
        ? (profile.laboratory_profiles[0]?.organization_id ?? null)
        : (profile.laboratory_profiles?.organization_id ?? null),
    });

    return {
      ok: true,
      isNewUser: false,
      redirectTo,
    };
  } catch (error) {
    console.error("[verifyLoginOtp]", error);

    return {
      ok: false,
      code: "SERVER_ERROR",
    };
  }
}
