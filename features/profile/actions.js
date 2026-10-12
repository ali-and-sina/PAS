"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePatient } from "@/features/patient/auth";
import { recordPatientAudit } from "@/features/patient/audit";

const SUPPORTED_FIELDS = new Set([
  "full_name",
  "avatar_url",
  "date_of_birth",
  "sex",
  "blood_type",
  "emergency_contact_name",
  "emergency_contact_phone",
]);

function invalidInput() {
  return {
    ok: false,
    code: "INVALID_INPUT",
  };
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date <= today
  );
}

function requiredString(value, maxLength = 255) {
  if (typeof value !== "string") return null;

  const result = value.trim();

  if (!result || result.length > maxLength) {
    return null;
  }

  return result;
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

/**
 * Updates the authenticated user's own profile.
 *
 * IMPORTANT:
 * - user id is never accepted from the caller
 * - phone is not editable here
 * - authorization is enforced by the DB RPC
 * - profiles + patient_profiles are updated atomically
 */
export async function updateOwnProfile(input = {}) {
  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return invalidInput();
    }

    const keys = Object.keys(input);

    if (keys.length === 0 || keys.some((key) => !SUPPORTED_FIELDS.has(key))) {
      return invalidInput();
    }

    const payload = {};

    if ("full_name" in input) {
      const fullName = requiredString(input.full_name, 150);

      if (!fullName) {
        return invalidInput();
      }

      payload.full_name = fullName;
    }

    if ("avatar_url" in input) {
      const avatarUrl = optionalString(input.avatar_url, 2048);

      if (avatarUrl === undefined) {
        return invalidInput();
      }

      payload.avatar_url = avatarUrl;
    }

    if ("date_of_birth" in input) {
      if (!isValidDate(input.date_of_birth)) {
        return invalidInput();
      }

      payload.date_of_birth = input.date_of_birth;
    }

    if ("sex" in input) {
      if (input.sex !== "male" && input.sex !== "female") {
        return invalidInput();
      }

      payload.sex = input.sex;
    }

    if ("blood_type" in input) {
      if (
        input.blood_type !== null &&
        input.blood_type !== "" &&
        typeof input.blood_type !== "string"
      ) {
        return invalidInput();
      }

      payload.blood_type = input.blood_type || null;
    }

    if ("emergency_contact_name" in input) {
      const value = optionalString(input.emergency_contact_name, 150);

      if (value === undefined) {
        return invalidInput();
      }

      payload.emergency_contact_name = value;
    }

    if ("emergency_contact_phone" in input) {
      const value = optionalString(input.emergency_contact_phone, 30);

      if (value === undefined) {
        return invalidInput();
      }

      if (value !== null && !/^\+[1-9]\d{7,14}$/.test(value)) {
        return invalidInput();
      }

      payload.emergency_contact_phone = value;
    }

    const context = await requirePatient();

    const supabase = await createClient();

    const { error } = await supabase.rpc("update_own_profile", {
      p_input: payload,
    });

    if (error) {
      const code = String(error.code || "");
      const message = String(error.message || "").toLowerCase();

      if (
        code === "22023" ||
        code === "42501" ||
        message.includes("invalid") ||
        message.includes("required")
      ) {
        return invalidInput();
      }

      console.error("[updateOwnProfile]", error);

      return {
        ok: false,
        code: "SERVER_ERROR",
      };
    }

    // Profile fields are rendered in several authenticated patient routes.
    // Keep these route snapshots fresh without introducing a cross-user cache.
    revalidatePath("/patient/profile");
    revalidatePath("/patient/dashboard");
    revalidatePath("/patient/health-record");

    await recordPatientAudit({
      actorId: context.user_id,
      action: "profile_updated",
      entityType: "patient_profile",
      entityId: context.patient_id,
      metadata: { changed_fields: keys.sort() },
    });


    return {
      ok: true,
    };
  } catch (error) {
    console.error("[updateOwnProfile]", error);

    return {
      ok: false,
      code: "SERVER_ERROR",
    };
  }
}
