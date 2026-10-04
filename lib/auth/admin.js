import "server-only";

import { getSessionUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export class AdminAuthorizationError extends Error {
  constructor(message = "ADMIN_FORBIDDEN") {
    super(message);
    this.name = "AdminAuthorizationError";
  }
}

/**
 * Authorizes the current request as an application admin.
 *
 * The current session helper is reused so real Auth and the temporary
 * test-session mode can share the same role boundary.
 * The final authority remains the database: profiles.role + admin_profiles.
 */
export async function requireAdmin() {
  const sessionUser = await getSessionUser();

  if (!sessionUser?.id) {
    throw new AdminAuthorizationError("ADMIN_UNAUTHENTICATED");
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
        id,
        role,
        full_name,
        phone,
        admin_profiles (
          personnel_code,
          created_at
        )
      `,
    )
    .eq("id", sessionUser.id)
    .maybeSingle();

  if (error) {
    console.error("[requireAdmin]", error);
    throw new AdminAuthorizationError("ADMIN_AUTH_CHECK_FAILED");
  }

  const adminProfile = Array.isArray(data?.admin_profiles)
    ? data.admin_profiles[0]
    : data?.admin_profiles;

  if (data?.role !== "admin" || !adminProfile) {
    throw new AdminAuthorizationError("ADMIN_FORBIDDEN");
  }

  return {
    id: data.id,
    role: data.role,
    full_name: data.full_name,
    phone: data.phone,
    personnel_code: adminProfile.personnel_code,
  };
}
