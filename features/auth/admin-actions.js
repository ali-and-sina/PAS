"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeDigits, normalizeIranianMobile } from "@/lib/utils/validation";

function normalizePersonnelCode(value) {
  if (typeof value !== "string") return "";
  return normalizeDigits(value).trim().toUpperCase();
}

function isValidPersonnelCode(value) {
  return /^[A-Z0-9-]{3,20}$/.test(value);
}

function normalizePhone(value) {
  return normalizeIranianMobile(typeof value === "string" ? value : "");
}

function invalidCredentials() {
  // Deliberately do not reveal whether the personnel code exists.
  return { ok: false, code: "INVALID_CREDENTIALS" };
}

async function clearLocalSession(supabase) {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Best-effort cleanup; do not expose internal auth details to the client.
  }
}

/**
 * Real admin login uses Supabase Auth password authentication.
 * personnel_code is resolved server-side through the private admin directory;
 * the resulting Auth session still belongs to the real admin Auth user.
 */
export async function loginAdminWithPassword({ personnelCode, password } = {}) {
  const normalizedCode = normalizePersonnelCode(personnelCode);

  if (
    !isValidPersonnelCode(normalizedCode) ||
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > 1024
  ) {
    return invalidCredentials();
  }

  try {
    const privileged = createAdminClient();
    const { data: adminRecord, error: adminRecordError } = await privileged
      .from("admin_profiles")
      .select("id, personnel_code")
      .ilike("personnel_code", normalizedCode)
      .maybeSingle();

    if (adminRecordError) {
      console.error("[loginAdminWithPassword:adminRecord]", {
        code: adminRecordError.code,
        message: adminRecordError.message,
      });
      return { ok: false, code: "SERVER_ERROR" };
    }

    if (!adminRecord) return invalidCredentials();

    const { data: profile, error: profileError } = await privileged
      .from("profiles")
      .select("id, role, phone")
      .eq("id", adminRecord.id)
      .maybeSingle();

    if (profileError) {
      console.error("[loginAdminWithPassword:profile]", {
        code: profileError.code,
        message: profileError.message,
      });
      return { ok: false, code: "SERVER_ERROR" };
    }

    if (profile?.role !== "admin") return invalidCredentials();

    const authPhone = normalizePhone(profile.phone);
    if (!authPhone) {
      console.error("[loginAdminWithPassword:phone] Missing/invalid admin phone");
      return { ok: false, code: "SERVER_ERROR" };
    }

    const supabase = await createClient();
    await clearLocalSession(supabase);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      phone: authPhone,
      password,
    });

    if (authError || !data?.user) {
      if (authError) {
        // Never log the submitted password or tokens.
        console.warn("[loginAdminWithPassword:auth]", {
          code: authError.code,
          status: authError.status,
          message: authError.message,
        });
      }
      await clearLocalSession(supabase);
      return invalidCredentials();
    }

    // Defence in depth: the password-authenticated account must be the account
    // selected by the supplied personnel code.
    if (data.user.id !== adminRecord.id) {
      await clearLocalSession(supabase);
      return invalidCredentials();
    }

    return { ok: true, redirectTo: "/admin" };
  } catch (error) {
    console.error("[loginAdminWithPassword]", {
      name: error?.name,
      message: error?.message,
      code: error?.code,
    });
    return { ok: false, code: "SERVER_ERROR" };
  }
}
