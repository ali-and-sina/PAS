import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let adminClient;

export function createAdminClient() {
  if (adminClient) {
    return adminClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const secretKey =
    process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!secretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_SECRET_KEY",
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
