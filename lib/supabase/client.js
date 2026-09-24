"use client";

import { createBrowserClient } from "@supabase/ssr";

let client;

export function createClient() {
  const SUPABASEURL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASEPASS = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (client) return client;

  client = createBrowserClient(SUPABASEURL, SUPABASEPASS);

  return client;
}
