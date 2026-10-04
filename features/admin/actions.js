"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDoctorSchema, createLaboratorySchema } from "@/features/admin/schemas";

function normalize(value, max = 255) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function invalid(message) {
  return { ok: false, code: "INVALID_INPUT", message };
}

function failure(message = "عملیات انجام نشد.") {
  return { ok: false, code: "SERVER_ERROR", message };
}

function success(data = {}) {
  return { ok: true, ...data };
}

function getActionInput(input) {
  if (input instanceof FormData) {
    return Object.fromEntries(input.entries());
  }

  return input ?? {};
}

function schemaErrorMessage(parsed, fallback) {
  return parsed.error?.issues?.[0]?.message || fallback;
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
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", id);

  if (error) throw error;
}

async function rollbackAuthUser(supabase, authUserId, tableName) {
  if (!authUserId) return;

  const { error: profileRollbackError } = await supabase
    .from(tableName)
    .delete()
    .eq("id", authUserId);

  if (profileRollbackError) {
    console.error(`[admin:rollback:${tableName}]`, profileRollbackError);
  }

  try {
    await supabase.auth.admin.deleteUser(authUserId);
  } catch (error) {
    console.error("[admin:rollback:auth]", error);
  }
}

export async function createDoctor(input) {
  const admin = await requireAdmin();
  const raw = getActionInput(input);
  const parsed = createDoctorSchema.safeParse(raw);

  if (!parsed.success) {
    return invalid(schemaErrorMessage(parsed, "اطلاعات پزشک معتبر نیست."));
  }

  const { full_name: fullName, phone, medical_license_number: license, specialty } =
    parsed.data;

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
    return {
      ok: false,
      code: "DUPLICATE_LICENSE",
      message: "این شماره نظام پزشکی قبلاً ثبت شده است.",
    };
  }

  let authUserId;

  try {
    const { data, error: authError } =
      await supabase.auth.admin.createUser({
        phone,
        phone_confirm: false,
        user_metadata: { full_name: fullName },
      });

    if (authError || !data?.user) {
      console.error("[createDoctor:auth]", authError);
      return failure("ساخت حساب کاربری انجام نشد.");
    }

    authUserId = data.user.id;
    await updateProfileRole(supabase, authUserId, "doctor");

    const { error: doctorError } = await supabase
      .from("doctor_profiles")
      .insert({
        id: authUserId,
        medical_license_number: license,
        specialty: specialty || null,
        is_verified: false,
        verified_at: null,
        verified_by: null,
      });

    if (doctorError) throw doctorError;

    await writeAuditLog(
      supabase,
      admin.id,
      "create_doctor",
      "doctor",
      authUserId,
      { medical_license_number: license, specialty: specialty || null },
    );

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/admin/doctors");
    revalidatePath(`/admin/doctors/${authUserId}`);

    return success({ doctorId: authUserId });
  } catch (error) {
    console.error("[createDoctor]", error);

    await rollbackAuthUser(supabase, authUserId, "doctor_profiles");

    return failure("ساخت پزشک کامل نشد.");
  }
}

export async function createLaboratory(input) {
  const admin = await requireAdmin();
  const raw = getActionInput(input);
  const parsed = createLaboratorySchema.safeParse(raw);

  if (!parsed.success) {
    return invalid(schemaErrorMessage(parsed, "اطلاعات آزمایشگاه معتبر نیست."));
  }

  const {
    organization_name: labName,
    phone,
    license_number: license,
  } = parsed.data;

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
    return {
      ok: false,
      code: "DUPLICATE_LICENSE",
      message: "این شماره مجوز آزمایشگاه قبلاً ثبت شده است.",
    };
  }

  let authUserId;
  let organizationId;

  try {
    const { data, error: authError } =
      await supabase.auth.admin.createUser({
        phone,
        phone_confirm: false,
        user_metadata: { full_name: labName },
      });

    if (authError || !data?.user) {
      console.error("[createLaboratory:auth]", authError);
      return failure("ساخت حساب کاربری انجام نشد.");
    }

    authUserId = data.user.id;
    await updateProfileRole(supabase, authUserId, "laboratory");

    const { data: organization, error: organizationError } =
      await supabase
        .from("organizations")
        .insert({
          name: labName,
          type: "laboratory",
          license_number: license,
        })
        .select("id")
        .single();

    if (organizationError || !organization) throw organizationError;
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
    revalidatePath(`/admin/laboratories/${authUserId}`);

    return success({ laboratoryId: authUserId });
  } catch (error) {
    console.error("[createLaboratory]", error);

    // organization_id is NO ACTION, so the child lab profile must be removed
    // before its organization can be deleted. Then the Auth user is deleted.
    if (authUserId) {
      try {
        await supabase
          .from("laboratory_profiles")
          .delete()
          .eq("id", authUserId);
      } catch (rollbackError) {
        console.error("[createLaboratory:laboratory-rollback]", rollbackError);
      }
    }

    if (organizationId) {
      try {
        const { error: organizationRollbackError } = await supabase
          .from("organizations")
          .delete()
          .eq("id", organizationId);
        if (organizationRollbackError) {
          console.error(
            "[createLaboratory:organization-rollback]",
            organizationRollbackError,
          );
        }
      } catch (rollbackError) {
        console.error("[createLaboratory:organization-rollback]", rollbackError);
      }
    }

    if (authUserId) {
      try {
        await supabase.auth.admin.deleteUser(authUserId);
      } catch (rollbackError) {
        console.error("[createLaboratory:auth-rollback]", rollbackError);
      }
    }

    return failure("ساخت آزمایشگاه کامل نشد.");
  }
}

export async function verifyDoctor(doctorId) {
  const admin = await requireAdmin();
  const id = normalize(doctorId, 60);
  if (!id) return invalid("شناسه پزشک معتبر نیست.");

  const supabase = createAdminClient();
  const { data: doctor, error: doctorError } = await supabase
    .from("doctor_profiles")
.select("id, is_verified, verified_at, verified_by")
    .eq("id", id)
    .maybeSingle();

  if (doctorError) {
    console.error("[verifyDoctor:lookup]", doctorError);
    return failure();
  }

  if (!doctor) return invalid("پزشک پیدا نشد.");

  const verificationChanged = !doctor.is_verified;

  if (verificationChanged) {
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
  }

  try {
    await writeAuditLog(supabase, admin.id, "verify_doctor", "doctor", id);
  } catch (auditError) {
    console.error("[verifyDoctor:audit]", auditError);

    if (verificationChanged) {
      const { error: rollbackError } = await supabase
        .from("doctor_profiles")
        .update({
          is_verified: doctor.is_verified,
          verified_at: doctor.verified_at,
          verified_by: doctor.verified_by,
        })
        .eq("id", id);

      if (rollbackError) {
        console.error("[verifyDoctor:audit-rollback]", rollbackError);
      }
    }

    return failure("تأیید پزشک کامل نشد.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/doctors");
  revalidatePath(`/admin/doctors/${id}`);

  return success({ doctorId: id, isVerified: true });
}

export async function revokeDoctorVerification(doctorId) {
  const admin = await requireAdmin();
  const id = normalize(doctorId, 60);
  if (!id) return invalid("شناسه پزشک معتبر نیست.");

  const supabase = createAdminClient();
  const { data: doctor, error: doctorError } = await supabase
    .from("doctor_profiles")
.select("id, is_verified, verified_at, verified_by")
    .eq("id", id)
    .maybeSingle();

  if (doctorError) {
    console.error("[revokeDoctorVerification:lookup]", doctorError);
    return failure();
  }

  if (!doctor) return invalid("پزشک پیدا نشد.");
  if (!doctor.is_verified) return success({ doctorId: id, isVerified: false });

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
    await writeAuditLog(supabase, admin.id, "unverify_doctor", "doctor", id);
  } catch (auditError) {
    console.error("[revokeDoctorVerification:audit]", auditError);

    const { error: rollbackError } = await supabase
      .from("doctor_profiles")
      .update({
        is_verified: doctor.is_verified,
        verified_at: doctor.verified_at,
        verified_by: doctor.verified_by,
      })
      .eq("id", id);

    if (rollbackError) {
      console.error("[revokeDoctorVerification:audit-rollback]", rollbackError);
    }

    return failure("لغو تأیید پزشک کامل نشد.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/doctors");
  revalidatePath(`/admin/doctors/${id}`);

  return success({ doctorId: id, isVerified: false });
}
