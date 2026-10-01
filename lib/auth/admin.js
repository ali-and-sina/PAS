import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export class AdminAuthorizationError extends Error {
  constructor(code = "FORBIDDEN") {
    super(code);

    this.name = "AdminAuthorizationError";
    this.code = code;
  }
}

export async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AdminAuthorizationError("UNAUTHENTICATED");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[requireAdmin:profile]", profileError);

    throw new AdminAuthorizationError("FORBIDDEN");
  }

  if (!profile || profile.role !== "admin") {
    throw new AdminAuthorizationError("FORBIDDEN");
  }

  return {
    user,
    profile,
    adminClient: createAdminClient(),
  };
}

export function isAdminAuthorizationError(error) {
  return error instanceof AdminAuthorizationError;
}
