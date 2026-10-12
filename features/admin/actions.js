"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDoctorSchema, createLaboratorySchema } from "@/features/admin/schemas";

function normalize(value, max = 255) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizePhone(value) {
  const raw = normalize(value, 32).replace(/[\s()-]/g, "");

  if (/^09\d{9}$/.test(raw)) return `+98${raw.slice(1)}`;
  if (/^9\d{9}$/.test(raw)) return `+98${raw}`;
  if (/^989\d{9}$/.test(raw)) return `+${raw}`;
  if (/^\+989\d{9}$/.test(raw)) return raw;

  return "";
}


const DOCTOR_FIELDS = [
  "full_name",
  "phone",
  "medical_license_number",
  "specialty",
];
const LABORATORY_FIELDS = [
  "full_name",
  "phone",
  "organization_name",
  "license_number",
];
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isFormDataLike(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.get === "function" &&
      typeof value.entries === "function",
  );
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/**
 * Supports both standard Next.js useActionState(previousState, FormData) and
 * direct calls with FormData or a validated plain object. Every field is
 * allow-listed and converted to a string before schema validation, preventing
 * `.get is not a function` from surfacing as a runtime error.
 */
function readAdminActionInput(firstArgument, secondArgument, fields) {
  const formData = isFormDataLike(secondArgument)
    ? secondArgument
    : isFormDataLike(firstArgument)
      ? firstArgument
      : null;

  const source =
    formData ??
    (isRecord(secondArgument)
      ? secondArgument
      : isRecord(firstArgument)
        ? firstArgument
        : {});

  return Object.fromEntries(
    fields.map((field) => {
      const value = formData ? formData.get(field) : source[field];
      return [field, typeof value === "string" ? value : ""];
    }),
  );
}

function normalizeUuid(value) {
  const id = normalize(value, 36);
  return UUID_PATTERN.test(id) ? id : "";
}

function invalid(message, code = "INVALID_INPUT") {
  return { ok: false, code, message };
}

function failure(message = "عملیات انجام نشد.") {
  return { ok: false, code: "SERVER_ERROR", message };
}

function success(data = {}) {
  return { ok: true, ...data };
}

async function writeAuditLog(
  supabase,
  actorId,
  action,
  entityType,
  entityId,
  metadata = {},
) {
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });

  if (error) throw error;
}

async function updateProfileRole(supabase, id, role) {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function createDoctor(previousStateOrInput, formData) {
  const admin = await requireAdmin();
  const input = readAdminActionInput(previousStateOrInput, formData, DOCTOR_FIELDS);
  const parsed = createDoctorSchema.safeParse(input);

  if (!parsed.success) {
    return invalid(parsed.error.issues[0]?.message ?? "اطلاعات پزشک معتبر نیست.");
  }

  const fullName = normalize(parsed.data.full_name, 120);
  const phone = normalizePhone(parsed.data.phone);
  const license = normalize(parsed.data.medical_license_number, 100);
  const specialty = normalize(parsed.data.specialty, 80);

  if (!fullName || !phone || !license) {
    return invalid("اطلاعات پزشک کامل یا معتبر نیست.");
  }

  const supabase = createAdminClient();

  const { data: duplicateDoctor, error: duplicateError } = await supabase
    .from("doctor_profiles")
    .select("id")
    .eq("medical_license_number", license)
    .maybeSingle();

  if (duplicateError) {
    console.error("[createDoctor:duplicate]", duplicateError);
    return failure();
  }

  if (duplicateDoctor) {
    return invalid(
      "این شماره نظام پزشکی قبلاً ثبت شده است.",
      "DUPLICATE_LICENSE",
    );
  }

  let authUserId;

  try {
    const { data, error: authError } = await supabase.auth.admin.createUser({
      phone,
      phone_confirm: false,
      user_metadata: { full_name: fullName },
    });

    if (authError || !data?.user) {
      const authCode = String(authError?.code ?? "").toLowerCase();
      if (["phone_exists", "user_already_exists"].includes(authCode)) {
        return invalid("این شماره موبایل قبلاً ثبت شده است.", "DUPLICATE_PHONE");
      }
      console.error("[createDoctor:auth]", authError);
      return failure("ساخت حساب کاربری انجام نشد.");
    }

    authUserId = data.user.id;
    await updateProfileRole(supabase, authUserId, "doctor");

    const { error: doctorError } = await supabase.from("doctor_profiles").insert({
      id: authUserId,
      medical_license_number: license,
      specialty: specialty || null,
      is_verified: false,
    });

    if (doctorError) throw doctorError;

    await writeAuditLog(
      supabase,
      admin.id,
      "create_doctor",
      "doctor",
      authUserId,
      { medical_license_number: license },
    );

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/admin/doctors");

    return success({ redirectTo: "/admin/doctors" });
  } catch (error) {
    console.error("[createDoctor]", error);

    if (authUserId) {
      try {
        const { error: rollbackError } = await supabase.auth.admin.deleteUser(authUserId);
        if (rollbackError) console.error("[createDoctor:rollback]", rollbackError);
      } catch (rollbackError) {
        console.error("[createDoctor:rollback]", rollbackError);
      }
    }

    if (error?.code === "23505" && String(error?.message ?? "").includes("medical_license_number")) {
      return invalid(
      "این شماره نظام پزشکی قبلاً ثبت شده است.",
      "DUPLICATE_LICENSE",
    );
    }

    return failure("ساخت پزشک کامل نشد.");
  }
}

export async function createLaboratory(previousStateOrInput, formData) {
  const admin = await requireAdmin();
  const input = readAdminActionInput(previousStateOrInput, formData, LABORATORY_FIELDS);
  const parsed = createLaboratorySchema.safeParse(input);

  if (!parsed.success) {
    return invalid(parsed.error.issues[0]?.message ?? "اطلاعات آزمایشگاه معتبر نیست.");
  }

  const fullName = normalize(parsed.data.full_name, 120);
  const phone = normalizePhone(parsed.data.phone);
  const labName = normalize(parsed.data.organization_name, 160);
  const license = normalize(parsed.data.license_number, 100);

  if (!fullName || !phone || labName.length < 2 || !license) {
    return invalid("اطلاعات آزمایشگاه کامل یا معتبر نیست.");
  }

  const supabase = createAdminClient();

  const { data: duplicateLab, error: duplicateError } = await supabase
    .from("laboratory_profiles")
    .select("id")
    .eq("license_number", license)
    .maybeSingle();

  if (duplicateError) {
    console.error("[createLaboratory:duplicate]", duplicateError);
    return failure();
  }

  if (duplicateLab) {
    return invalid(
      "این شماره مجوز آزمایشگاه قبلاً ثبت شده است.",
      "DUPLICATE_LICENSE",
    );
  }

  let authUserId;
  let organizationId;

  try {
    const { data, error: authError } = await supabase.auth.admin.createUser({
      phone,
      phone_confirm: false,
      user_metadata: { full_name: fullName },
    });

    if (authError || !data?.user) {
      const authCode = String(authError?.code ?? "").toLowerCase();
      if (["phone_exists", "user_already_exists"].includes(authCode)) {
        return invalid("این شماره موبایل قبلاً ثبت شده است.", "DUPLICATE_PHONE");
      }
      console.error("[createLaboratory:auth]", authError);
      return failure("ساخت حساب کاربری انجام نشد.");
    }

    authUserId = data.user.id;
    await updateProfileRole(supabase, authUserId, "laboratory");

    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .insert({
        name: labName,
        type: "laboratory",
        license_number: license,
      })
      .select("id")
      .single();

    if (organizationError) throw organizationError;
    if (!organization?.id) throw new Error("Organization was not returned after insert.");
    organizationId = organization.id;

    const { error: laboratoryError } = await supabase
      .from("laboratory_profiles")
      .insert({
        id: authUserId,
        organization_id: organizationId,
        license_number: license,
      });

    if (laboratoryError) throw laboratoryError;

    await writeAuditLog(
      supabase,
      admin.id,
      "create_laboratory",
      "laboratory",
      authUserId,
      { organization_id: organizationId, license_number: license },
    );

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/admin/laboratories");

    return success({ redirectTo: "/admin/laboratories" });
  } catch (error) {
    console.error("[createLaboratory]", error);

    // Remove the profile reference before deleting its organization. The live
    // schema restricts deleting organizations while laboratory_profiles still
    // references them; reversing this order could leave an orphan organization.
    if (authUserId) {
      try {
        const { error: profileCleanupError } = await supabase
          .from("laboratory_profiles")
          .delete()
          .eq("id", authUserId);
        if (profileCleanupError) {
          console.error(
            "[createLaboratory:profile-rollback]",
            profileCleanupError,
          );
        }
      } catch (rollbackError) {
        console.error("[createLaboratory:profile-rollback]", rollbackError);
      }

      try {
        const { error: authCleanupError } = await supabase.auth.admin.deleteUser(authUserId);
        if (authCleanupError) {
          console.error("[createLaboratory:auth-rollback]", authCleanupError);
        }
      } catch (rollbackError) {
        console.error("[createLaboratory:auth-rollback]", rollbackError);
      }
    }

    if (organizationId) {
      try {
        const { error: organizationCleanupError } = await supabase
          .from("organizations")
          .delete()
          .eq("id", organizationId);
        if (organizationCleanupError) {
          console.error(
            "[createLaboratory:organization-rollback]",
            organizationCleanupError,
          );
        }
      } catch (rollbackError) {
        console.error("[createLaboratory:organization-rollback]", rollbackError);
      }
    }

    if (error?.code === "23505" && String(error?.message ?? "").includes("license_number")) {
      return invalid(
      "این شماره مجوز آزمایشگاه قبلاً ثبت شده است.",
      "DUPLICATE_LICENSE",
    );
    }

    return failure("ساخت آزمایشگاه کامل نشد.");
  }
}

export async function verifyDoctor(doctorId) {
  const admin = await requireAdmin();
  const id = normalizeUuid(doctorId);
  if (!id) return invalid("شناسه پزشک معتبر نیست.");

  const supabase = createAdminClient();
  const { data: doctor, error: doctorError } = await supabase
    .from("doctor_profiles")
    .select("id, is_verified")
    .eq("id", id)
    .maybeSingle();

  if (doctorError) {
    console.error("[verifyDoctor:lookup]", doctorError);
    return failure();
  }
  if (!doctor) return invalid("پزشک پیدا نشد.");
  if (doctor.is_verified) return success();

  const { error } = await supabase
    .from("doctor_profiles")
    .update({
      is_verified: true,
      verified_at: new Date().toISOString(),
      verified_by: admin.id,
    })
    .eq("id", id);

  if (error) {
    console.error("[verifyDoctor]", error);
    return failure();
  }

  try {
    await writeAuditLog(supabase, admin.id, "verify_doctor", "doctor", id);
  } catch (auditError) {
    console.error("[verifyDoctor:audit]", auditError);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/doctors");

  return success();
}

export async function revokeDoctorVerification(doctorId) {
  const admin = await requireAdmin();
  const id = normalizeUuid(doctorId);
  if (!id) return invalid("شناسه پزشک معتبر نیست.");

  const supabase = createAdminClient();
  const { data: doctor, error: doctorError } = await supabase
    .from("doctor_profiles")
    .select("id, is_verified")
    .eq("id", id)
    .maybeSingle();

  if (doctorError) {
    console.error("[revokeDoctorVerification:lookup]", doctorError);
    return failure();
  }
  if (!doctor) return invalid("پزشک پیدا نشد.");
  if (!doctor.is_verified) return success();

  const { error } = await supabase
    .from("doctor_profiles")
    .update({
      is_verified: false,
      verified_at: null,
      verified_by: null,
    })
    .eq("id", id);

  if (error) {
    console.error("[revokeDoctorVerification]", error);
    return failure();
  }

  try {
    await writeAuditLog(supabase, admin.id, "revoke_doctor", "doctor", id);
  } catch (auditError) {
    console.error("[revokeDoctorVerification:audit]", auditError);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/doctors");

  return success();
}
