import "server-only";

import { requireAdmin, isAdminAuthorizationError } from "@/lib/auth/admin";

import { adminListSchema } from "./schemas";

function mapAuthorizationError(error) {
  if (!isAdminAuthorizationError(error)) {
    return null;
  }

  return {
    ok: false,
    code: error.code === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "FORBIDDEN",
  };
}

function normalizeNested(value) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function getAdminDoctors(input = {}) {
  try {
    const parsed = adminListSchema.safeParse(input);

    if (!parsed.success) {
      return {
        ok: false,
        code: "INVALID_INPUT",
      };
    }

    const { search, limit, offset } = parsed.data;

    const { adminClient } = await requireAdmin();

    let query = adminClient
      .from("profiles")
      .select(
        `
        id,
        full_name,
        phone,
        created_at,

        doctor_profiles!doctor_profiles_id_fkey (
          medical_license_number,
          specialty,
          is_verified,
          verified_at
        )
        `,
        {
          count: "exact",
        },
      )
      .eq("role", "doctor")
      .order("created_at", {
        ascending: false,
      })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[getAdminDoctors]", error);

      return {
        ok: false,
        code: "SERVER_ERROR",
      };
    }

    const doctors = (data ?? []).map((row) => {
      const doctor = normalizeNested(row.doctor_profiles);

      return {
        id: row.id,

        full_name: row.full_name,

        phone: row.phone,

        medical_license_number: doctor?.medical_license_number ?? null,

        specialty: doctor?.specialty ?? null,

        is_verified: doctor?.is_verified ?? false,

        verified_at: doctor?.verified_at ?? null,

        created_at: row.created_at,
      };
    });

    return {
      ok: true,
      data: doctors,
      total: count ?? doctors.length,
    };
  } catch (error) {
    const authorizationError = mapAuthorizationError(error);

    if (authorizationError) {
      return authorizationError;
    }

    console.error("[getAdminDoctors]", error);

    return {
      ok: false,
      code: "SERVER_ERROR",
    };
  }
}

export async function getAdminLaboratories(input = {}) {
  try {
    const parsed = adminListSchema.safeParse(input);

    if (!parsed.success) {
      return {
        ok: false,
        code: "INVALID_INPUT",
      };
    }

    const { search, limit, offset } = parsed.data;

    const { adminClient } = await requireAdmin();

    let query = adminClient
      .from("profiles")
      .select(
        `
        id,
        full_name,
        phone,
        created_at,

        laboratory_profiles (
          organization_id,
          license_number,

          organizations (
            id,
            name,
            type
          )
        )
        `,
        {
          count: "exact",
        },
      )
      .eq("role", "laboratory")
      .order("created_at", {
        ascending: false,
      })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[getAdminLaboratories]", error);

      return {
        ok: false,
        code: "SERVER_ERROR",
      };
    }

    const laboratories = (data ?? []).map((row) => {
      const laboratory = normalizeNested(row.laboratory_profiles);

      const organization = normalizeNested(laboratory?.organizations);

      return {
        id: row.id,

        contact_name: row.full_name,

        phone: row.phone,

        license_number: laboratory?.license_number ?? null,

        organization_id: laboratory?.organization_id ?? null,

        organization_name: organization?.name ?? null,

        organization_type: organization?.type ?? null,

        created_at: row.created_at,
      };
    });

    return {
      ok: true,
      data: laboratories,
      total: count ?? laboratories.length,
    };
  } catch (error) {
    const authorizationError = mapAuthorizationError(error);

    if (authorizationError) {
      return authorizationError;
    }

    console.error("[getAdminLaboratories]", error);

    return {
      ok: false,
      code: "SERVER_ERROR",
    };
  }
}
