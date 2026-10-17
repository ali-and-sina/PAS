import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let adminClient;

export function createAdminClient() {
  if (adminClient) {
    return adminClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // This module is server-only. Prefer the server-only environment names;
  // retain the project's legacy deployment name for compatibility. Never
  // import this module from client code or expose the value in action results.
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!secretKey) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, or the configured legacy secret variable",
    );
  }

  adminClient = createSupabaseClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
