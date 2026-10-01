"use server";

import { requireAdmin, isAdminAuthorizationError } from "@/lib/auth/admin";

import {
  createAdminSchema,
  createDoctorSchema,
  createLaboratorySchema,
} from "./schemas";

import { writeAdminAuditLog } from "./server";

function invalidInput() {
  return {
    ok: false,
    code: "INVALID_INPUT",
  };
}

function mapAuthorizationError(error) {
  if (!isAdminAuthorizationError(error)) {
    return null;
  }

  return {
    ok: false,
    code: error.code === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FORBIDDEN",
  };
}

function mapDatabaseError(error, fallback = "SERVER_ERROR") {
  const message = String(error?.message ?? "").toLowerCase();

  const details = String(error?.details ?? "").toLowerCase();

  const combined = `${message} ${details}`;

  if (error?.code === "23505") {
    if (combined.includes("medical_license_number")) {
      return "DUPLICATE_MEDICAL_LICENSE";
    }

    if (combined.includes("license_number")) {
      return "DUPLICATE_LICENSE";
    }

    if (combined.includes("phone")) {
      return "DUPLICATE_PHONE";
    }

    return "DUPLICATE";
  }

  return fallback;
}

async function rollbackCreatedAuthUser(adminClient, userId) {
  if (!userId) {
    return;
  }

  try {
    const { error } = await adminClient.auth.admin.deleteUser(userId);

    if (error) {
      console.error("[admin:rollbackAuthUser]", error);
    }
  } catch (error) {
    console.error("[admin:rollbackAuthUser]", error);
  }
}

export async function createAdmin(input = {}) {
  let createdUserId = null;

  try {
    const parsed = createAdminSchema.safeParse(input);

    if (!parsed.success) {
      return invalidInput();
    }

    const payload = parsed.data;

    const { user: actor, adminClient } = await requireAdmin();

    const { data: existingPersonnel, error: existingPersonnelError } =
      await adminClient
        .from("admin_profiles")
        .select("id")
        .eq("personnel_code", payload.personnel_code)
        .maybeSingle();

    if (existingPersonnelError) {
      console.error("[createAdmin:personnelCheck]", existingPersonnelError);

      return {
        ok: false,
        code: "SERVER_ERROR",
      };
    }

    if (existingPersonnel) {
      return {
        ok: false,
        code: "DUPLICATE_PERSONNEL_CODE",
      };
    }

    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        phone: payload.phone,
        phone_confirm: true,
        user_metadata: {
          full_name: payload.full_name,
        },
      });

    if (authError || !authData?.user) {
      console.error("[createAdmin:auth]", authError);

      const authMessage = String(authError?.message ?? "").toLowerCase();
      const authCode = String(authError?.code ?? "").toLowerCase();

      return {
        ok: false,
        code:
          authCode === "phone_exists" ||
          (authMessage.includes("phone") && authMessage.includes("already"))
            ? "DUPLICATE_PHONE"
            : "SERVER_ERROR",
      };
    }

    createdUserId = authData.user.id;

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        role: "admin",
        full_name: payload.full_name,
        phone: payload.phone,
      })
      .eq("id", createdUserId);

    if (profileError) {
      console.error("[createAdmin:profile]", profileError);
      throw profileError;
    }

    const { error: adminProfileError } = await adminClient
      .from("admin_profiles")
      .insert({
        id: createdUserId,
        personnel_code: payload.personnel_code,
      });

    if (adminProfileError) {
      console.error("[createAdmin:adminProfile]", adminProfileError);
      throw adminProfileError;
    }

    await writeAdminAuditLog({
      adminClient,
      actorId: actor.id,
      action: "create_admin",
      entityType: "admin",
      entityId: createdUserId,
      metadata: {
        personnel_code: payload.personnel_code,
      },
    });

    return {
      ok: true,
      data: {
        id: createdUserId,
        role: "admin",
        full_name: payload.full_name,
        phone: payload.phone,
        personnel_code: payload.personnel_code,
      },
    };
  } catch (error) {
    const authorizationError = mapAuthorizationError(error);

    if (authorizationError) {
      return authorizationError;
    }

    if (createdUserId) {
      try {
        const { adminClient } = await requireAdmin();
        await rollbackCreatedAuthUser(adminClient, createdUserId);
      } catch (rollbackError) {
        console.error("[createAdmin:rollback]", rollbackError);
      }
    }

    console.error("[createAdmin]", error);

    return {
      ok: false,
      code: mapDatabaseError(error),
    };
  }
}

export async function createDoctor(input = {}) {
  let createdUserId = null;

  try {
    const parsed = createDoctorSchema.safeParse(input);

    if (!parsed.success) {
      return invalidInput();
    }

    const payload = parsed.data;

    const { user: actor, adminClient } = await requireAdmin();

    const { data: existingDoctor, error: existingDoctorError } =
      await adminClient
        .from("doctor_profiles")
        .select("id")
        .eq("medical_license_number", payload.medical_license_number)
        .maybeSingle();

    if (existingDoctorError) {
      console.error("[createDoctor:licenseCheck]", existingDoctorError);

      return {
        ok: false,
        code: "SERVER_ERROR",
      };
    }

    if (existingDoctor) {
      return {
        ok: false,
        code: "DUPLICATE_MEDICAL_LICENSE",
      };
    }

    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        phone: payload.phone,

        phone_confirm: true,

        user_metadata: {
          full_name: payload.full_name,
        },
      });

    if (authError || !authData?.user) {
      console.error("[createDoctor:auth]", authError);

      const authMessage = String(authError?.message ?? "").toLowerCase();

      const authCode = String(authError?.code ?? "").toLowerCase();

      return {
        ok: false,

        code:
          authCode === "phone_exists" ||
          (authMessage.includes("phone") && authMessage.includes("already"))
            ? "DUPLICATE_PHONE"
            : "SERVER_ERROR",
      };
    }

    createdUserId = authData.user.id;

    /*
     * handle_new_user() creates the initial
     * profile with role=patient.
     *
     * Admin provisioning converts that row
     * into the intended role.
     */
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        role: "doctor",

        full_name: payload.full_name,

        phone: payload.phone,
      })
      .eq("id", createdUserId);

    if (profileError) {
      console.error("[createDoctor:profile]", profileError);

      throw profileError;
    }

    const { error: doctorProfileError } = await adminClient
      .from("doctor_profiles")
      .insert({
        id: createdUserId,

        medical_license_number: payload.medical_license_number,

        specialty: payload.specialty,

        is_verified: false,
      });

    if (doctorProfileError) {
      console.error("[createDoctor:doctorProfile]", doctorProfileError);

      throw doctorProfileError;
    }

    await writeAdminAuditLog({
      adminClient,

      actorId: actor.id,

      action: "create_doctor",

      entityType: "doctor",

      entityId: createdUserId,

      metadata: {
        specialty: payload.specialty,
      },
    });

    return {
      ok: true,

      data: {
        id: createdUserId,

        role: "doctor",

        full_name: payload.full_name,

        phone: payload.phone,

        medical_license_number: payload.medical_license_number,

        specialty: payload.specialty,

        is_verified: false,
      },
    };
  } catch (error) {
    const authorizationError = mapAuthorizationError(error);

    if (authorizationError) {
      return authorizationError;
    }

    if (createdUserId) {
      try {
        const { adminClient } = await requireAdmin();

        await rollbackCreatedAuthUser(adminClient, createdUserId);
      } catch (rollbackError) {
        console.error("[createDoctor:rollback]", rollbackError);
      }
    }

    console.error("[createDoctor]", error);

    return {
      ok: false,
      code: mapDatabaseError(error),
    };
  }
}

export async function createLaboratory(input = {}) {
  let createdUserId = null;
  let createdOrganizationId = null;

  try {
    const parsed = createLaboratorySchema.safeParse(input);

    if (!parsed.success) {
      return invalidInput();
    }

    const payload = parsed.data;

    const { user: actor, adminClient } = await requireAdmin();

    const { data: existingLaboratory, error: existingLaboratoryError } =
      await adminClient
        .from("laboratory_profiles")
        .select("id")
        .eq("license_number", payload.license_number)
        .maybeSingle();

    if (existingLaboratoryError) {
      console.error("[createLaboratory:licenseCheck]", existingLaboratoryError);

      return {
        ok: false,
        code: "SERVER_ERROR",
      };
    }

    if (existingLaboratory) {
      return {
        ok: false,
        code: "DUPLICATE_LICENSE",
      };
    }

    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        phone: payload.phone,

        phone_confirm: true,

        user_metadata: {
          full_name: payload.contact_name,
        },
      });

    if (authError || !authData?.user) {
      console.error("[createLaboratory:auth]", authError);

      const authMessage = String(authError?.message ?? "").toLowerCase();

      const authCode = String(authError?.code ?? "").toLowerCase();

      return {
        ok: false,

        code:
          authCode === "phone_exists" ||
          (authMessage.includes("phone") && authMessage.includes("already"))
            ? "DUPLICATE_PHONE"
            : "SERVER_ERROR",
      };
    }

    createdUserId = authData.user.id;

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        role: "laboratory",

        full_name: payload.contact_name,

        phone: payload.phone,
      })
      .eq("id", createdUserId);

    if (profileError) {
      console.error("[createLaboratory:profile]", profileError);

      throw profileError;
    }

    const { data: organization, error: organizationError } = await adminClient
      .from("organizations")
      .insert({
        name: payload.organization_name,

        type: payload.organization_type,

        license_number: payload.license_number,

        address: payload.address || null,
      })
      .select("id")
      .single();

    if (organizationError || !organization) {
      console.error("[createLaboratory:organization]", organizationError);

      throw organizationError ?? new Error("Organization creation failed");
    }

    createdOrganizationId = organization.id;

    const { error: laboratoryProfileError } = await adminClient
      .from("laboratory_profiles")
      .insert({
        id: createdUserId,

        organization_id: createdOrganizationId,

        license_number: payload.license_number,
      });

    if (laboratoryProfileError) {
      console.error(
        "[createLaboratory:laboratoryProfile]",
        laboratoryProfileError,
      );

      throw laboratoryProfileError;
    }

    const { error: memberError } = await adminClient
      .from("organization_members")
      .insert({
        organization_id: createdOrganizationId,

        profile_id: createdUserId,

        role_in_org: "member",
      });

    if (memberError) {
      console.error("[createLaboratory:member]", memberError);

      throw memberError;
    }

    await writeAdminAuditLog({
      adminClient,

      actorId: actor.id,

      action: "create_laboratory",

      entityType: "laboratory",

      entityId: createdUserId,

      metadata: {
        organization_id: createdOrganizationId,

        organization_name: payload.organization_name,

        organization_type: payload.organization_type,
      },
    });

    return {
      ok: true,

      data: {
        id: createdUserId,

        role: "laboratory",

        contact_name: payload.contact_name,

        phone: payload.phone,

        license_number: payload.license_number,

        organization_id: createdOrganizationId,

        organization_name: payload.organization_name,

        organization_type: payload.organization_type,
      },
    };
  } catch (error) {
    const authorizationError = mapAuthorizationError(error);

    if (authorizationError) {
      return authorizationError;
    }

    if (createdUserId) {
      try {
        const { adminClient } = await requireAdmin();

        await rollbackCreatedAuthUser(adminClient, createdUserId);

        if (createdOrganizationId) {
          const { error: organizationCleanupError } = await adminClient
            .from("organizations")
            .delete()
            .eq("id", createdOrganizationId);

          if (organizationCleanupError) {
            console.error(
              "[createLaboratory:rollbackOrganization]",
              organizationCleanupError,
            );
          }
        }
      } catch (rollbackError) {
        console.error("[createLaboratory:rollback]", rollbackError);
      }
    }

    console.error("[createLaboratory]", error);

    return {
      ok: false,
      code: mapDatabaseError(error),
    };
  }
}

export async function verifyDoctor(doctorId) {
  try {
    if (typeof doctorId !== "string" || !/^[0-9a-f-]{36}$/i.test(doctorId)) {
      return invalidInput();
    }

    const { user: actor, adminClient } = await requireAdmin();

    const { data: doctor, error: doctorError } = await adminClient
      .from("doctor_profiles")
      .select(
        `
          id,
          is_verified,
          medical_license_number,
          verified_at,
          verified_by
          `,
      )
      .eq("id", doctorId)
      .maybeSingle();

    if (doctorError) {
      console.error("[verifyDoctor:load]", doctorError);

      return {
        ok: false,
        code: "SERVER_ERROR",
      };
    }

    if (!doctor) {
      return {
        ok: false,
        code: "NOT_FOUND",
      };
    }

    if (doctor.is_verified === true) {
      return {
        ok: true,
        alreadyVerified: true,
      };
    }

    const { error: updateError } = await adminClient
      .from("doctor_profiles")
      .update({
        is_verified: true,

        verified_at: new Date().toISOString(),

        verified_by: actor.id,
      })
      .eq("id", doctorId);

    if (updateError) {
      console.error("[verifyDoctor:update]", updateError);

      throw updateError;
    }

    try {
      await writeAdminAuditLog({
        adminClient,

        actorId: actor.id,

        action: "verify_doctor",

        entityType: "doctor",

        entityId: doctorId,

        metadata: {
          medical_license_number: doctor.medical_license_number,
        },
      });
    } catch (auditError) {
      await adminClient
        .from("doctor_profiles")
        .update({
          is_verified: doctor.is_verified,

          verified_at: doctor.verified_at,

          verified_by: doctor.verified_by,
        })
        .eq("id", doctorId);

      throw auditError;
    }

    return {
      ok: true,
    };
  } catch (error) {
    const authorizationError = mapAuthorizationError(error);

    if (authorizationError) {
      return authorizationError;
    }

    console.error("[verifyDoctor]", error);

    return {
      ok: false,
      code: mapDatabaseError(error),
    };
  }
}

export async function revokeDoctorVerification(doctorId) {
  try {
    if (typeof doctorId !== "string" || !/^[0-9a-f-]{36}$/i.test(doctorId)) {
      return invalidInput();
    }

    const { user: actor, adminClient } = await requireAdmin();

    const { data: doctor, error: doctorError } = await adminClient
      .from("doctor_profiles")
      .select(
        `
          id,
          is_verified,
          medical_license_number,
          verified_at,
          verified_by
          `,
      )
      .eq("id", doctorId)
      .maybeSingle();

    if (doctorError) {
      console.error("[revokeDoctorVerification:load]", doctorError);

      return {
        ok: false,
        code: "SERVER_ERROR",
      };
    }

    if (!doctor) {
      return {
        ok: false,
        code: "NOT_FOUND",
      };
    }

    if (doctor.is_verified === false) {
      return {
        ok: true,
        alreadyRevoked: true,
      };
    }

    const { error: updateError } = await adminClient
      .from("doctor_profiles")
      .update({
        is_verified: false,

        verified_at: null,

        verified_by: null,
      })
      .eq("id", doctorId);

    if (updateError) {
      console.error("[revokeDoctorVerification:update]", updateError);

      throw updateError;
    }

    try {
      await writeAdminAuditLog({
        adminClient,

        actorId: actor.id,

        action: "revoke_doctor",

        entityType: "doctor",

        entityId: doctorId,

        metadata: {
          medical_license_number: doctor.medical_license_number,
        },
      });
    } catch (auditError) {
      await adminClient
        .from("doctor_profiles")
        .update({
          is_verified: doctor.is_verified,

          verified_at: doctor.verified_at,

          verified_by: doctor.verified_by,
        })
        .eq("id", doctorId);

      throw auditError;
    }

    return {
      ok: true,
    };
  } catch (error) {
    const authorizationError = mapAuthorizationError(error);

    if (authorizationError) {
      return authorizationError;
    }

    console.error("[revokeDoctorVerification]", error);

    return {
      ok: false,
      code: mapDatabaseError(error),
    };
  }
}
