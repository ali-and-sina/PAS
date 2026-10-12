"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";
import { hashGuestResultToken } from "@/features/patient/guest";

const DEFAULT_TTL_HOURS = 168;
const MAX_TTL_HOURS = 720;

function normalizeTtlHours(value) {
  const ttl = Number(value ?? DEFAULT_TTL_HOURS);

  if (!Number.isFinite(ttl)) return DEFAULT_TTL_HOURS;

  return Math.min(Math.max(Math.floor(ttl), 1), MAX_TTL_HOURS);
}

export async function createGuestResultAccess({
  reportId,
  ttlHours = DEFAULT_TTL_HOURS,
} = {}) {
  const user = await getSessionUser();

  if (!user?.id || user.role !== "laboratory") {
    return { ok: false, code: "FORBIDDEN" };
  }

  if (!reportId) {
    return { ok: false, code: "INVALID_INPUT" };
  }

  const supabase = await createClient();

  const { data: report, error: reportError } = await supabase
    .from("diagnostic_reports")
    .select(
      "id, laboratory_id, status, lab_order_id",
    )
    .eq("id", reportId)
    .eq("laboratory_id", user.id)
    .in("status", ["final", "amended"])
    .maybeSingle();

  if (reportError) throw reportError;
  if (!report) return { ok: false, code: "NOT_FOUND" };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashGuestResultToken(token);
  const ttl = normalizeTtlHours(ttlHours);
  const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000).toISOString();

  const { data: access, error: insertError } = await supabase
    .from("guest_result_accesses")
    .insert({
      diagnostic_report_id: report.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select("id, diagnostic_report_id, expires_at, created_at")
    .single();

  if (insertError) throw insertError;

  // The lab report page owns the controls for creating/revoking secure links.
  revalidatePath(`/lab/results/${report.id}`);

  return {
    ok: true,
    accessId: access.id,
    reportId: report.id,
    token,
    expiresAt: access.expires_at,
    path: `/patient/result/${token}`,
  };
}

export async function revokeGuestResultAccess(accessId) {
  const user = await getSessionUser();

  if (!user?.id || user.role !== "laboratory") {
    return { ok: false, code: "FORBIDDEN" };
  }

  if (!accessId) {
    return { ok: false, code: "INVALID_INPUT" };
  }

  const supabase = await createClient();
  const { data: access, error: accessError } = await supabase
    .from("guest_result_accesses")
    .select(
      `
        id,
        diagnostic_report_id,
        revoked_at,
        diagnostic_reports!guest_result_accesses_diagnostic_report_id_fkey (
          laboratory_id,
          status
        )
      `,
    )
    .eq("id", accessId)
    .maybeSingle();

  if (accessError) throw accessError;

  const report = Array.isArray(access?.diagnostic_reports)
    ? access.diagnostic_reports[0]
    : access?.diagnostic_reports;

  if (!access || !report || report.laboratory_id !== user.id) {
    return { ok: false, code: "NOT_FOUND" };
  }

  if (access.revoked_at) {
    return { ok: true, alreadyRevoked: true };
  }

  const { error: updateError } = await supabase
    .from("guest_result_accesses")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", access.id);

  if (updateError) throw updateError;

  revalidatePath(`/lab/results/${access.diagnostic_report_id}`);

  return { ok: true };
}
