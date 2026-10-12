import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let adminClient;

export function createAdminClient() {
  if (adminClient) {
    return adminClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY; // legacy deployment fallback

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!secretKey) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY (or the legacy server secret variable)",
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
