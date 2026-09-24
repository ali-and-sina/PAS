"use server";

import { createClient } from "@/lib/supabase/server";

const SEX_VALUES = new Set(["male", "female", "other"]);

const BLOOD_TYPES = new Set(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);

function invalidInput() {
  return {
    ok: false,
    code: "INVALID_INPUT",
  };
}

function optionalString(value, maxLength = 255) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const result = value.trim();

  if (!result || result.length > maxLength) {
    return undefined;
  }

  return result;
}

function requiredString(value, maxLength = 255) {
  if (typeof value !== "string") {
    return null;
  }

  const result = value.trim();

  if (!result || result.length > maxLength) {
    return null;
  }

  return result;
}

function isValidDate(value) {
  if (typeof value !== "string") {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime());
}

export async function updateOwnProfile(input = {}) {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return invalidInput();
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        ok: false,
        code: "SERVER_ERROR",
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return {
        ok: false,
        code: "SERVER_ERROR",
      };
    }

    /*
     * profiles
     *
     * Editable:
     *   full_name
     *   phone
     *   avatar_url
     *
     * NOT editable here:
     *   role
     *   national_id
     */
    const profilePatch = {};

    if ("full_name" in input) {
      const fullName = requiredString(input.full_name, 150);

      if (!fullName) {
        return invalidInput();
      }

      profilePatch.full_name = fullName;
    }

    if ("phone" in input) {
      const phone = requiredString(input.phone, 30);

      if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
        return invalidInput();
      }

      profilePatch.phone = phone;
    }

    if ("avatar_url" in input) {
      const avatarUrl = optionalString(input.avatar_url, 2048);

      if (avatarUrl === undefined) {
        return invalidInput();
      }

      profilePatch.avatar_url = avatarUrl;
    }

    if (Object.keys(profilePatch).length > 0) {
      const { error } = await supabase
        .from("profiles")
        .update(profilePatch)
        .eq("id", user.id);

      if (error) {
        return {
          ok: false,
          code: "SERVER_ERROR",
        };
      }
    }

    /*
     * Patient-only profile.
     */
    if (profile.role === "patient") {
      const patientFieldsPresent =
        "date_of_birth" in input ||
        "sex" in input ||
        "blood_type" in input ||
        "emergency_contact_name" in input ||
        "emergency_contact_phone" in input;

      if (patientFieldsPresent) {
        const patientPatch = {};

        /*
         * Required fields for patient_profiles.
         *
         * If this is the first completion request,
         * date_of_birth and sex must be supplied.
         */
        if ("date_of_birth" in input) {
          if (!isValidDate(input.date_of_birth)) {
            return invalidInput();
          }

          patientPatch.date_of_birth = input.date_of_birth;
        }

        if ("sex" in input) {
          if (typeof input.sex !== "string" || !SEX_VALUES.has(input.sex)) {
            return invalidInput();
          }

          patientPatch.sex = input.sex;
        }

        if ("blood_type" in input) {
          if (
            input.blood_type !== null &&
            input.blood_type !== "" &&
            !BLOOD_TYPES.has(input.blood_type)
          ) {
            return invalidInput();
          }

          patientPatch.blood_type = input.blood_type || null;
        }

        if ("emergency_contact_name" in input) {
          const value = optionalString(input.emergency_contact_name, 150);

          if (value === undefined) {
            return invalidInput();
          }

          patientPatch.emergency_contact_name = value;
        }

        if ("emergency_contact_phone" in input) {
          const value = optionalString(input.emergency_contact_phone, 30);

          if (value === undefined) {
            return invalidInput();
          }

          if (value !== null && !/^\+[1-9]\d{7,14}$/.test(value)) {
            return invalidInput();
          }

          patientPatch.emergency_contact_phone = value;
        }

        /*
         * Check whether patient_profiles already exists.
         */
        const { data: existingPatient, error: patientLookupError } =
          await supabase
            .from("patient_profiles")
            .select("id, date_of_birth, sex")
            .eq("id", user.id)
            .maybeSingle();

        if (patientLookupError) {
          return {
            ok: false,
            code: "SERVER_ERROR",
          };
        }

        /*
         * First completion:
         * both DB-required fields must be supplied.
         */
        if (!existingPatient) {
          if (!patientPatch.date_of_birth || !patientPatch.sex) {
            return invalidInput();
          }

          const { error } = await supabase.from("patient_profiles").insert({
            id: user.id,
            ...patientPatch,
          });

          if (error) {
            return {
              ok: false,
              code: "SERVER_ERROR",
            };
          }
        } else {
          const { error } = await supabase
            .from("patient_profiles")
            .update(patientPatch)
            .eq("id", user.id);

          if (error) {
            return {
              ok: false,
              code: "SERVER_ERROR",
            };
          }
        }
      }
    }

    /*
     * Doctor:
     * only profiles.full_name / phone / avatar_url
     * can be changed here.
     *
     * laboratory:
     * same.
     *
     * license, organization and verification fields
     * are deliberately not accepted.
     */

    return {
      ok: true,
    };
  } catch {
    return {
      ok: false,
      code: "SERVER_ERROR",
    };
  }
}
