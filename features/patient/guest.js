import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordPatientAudit } from "@/features/patient/audit";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const FINAL_REPORT_STATUSES = ["final", "amended"];
const CURRENT_OBSERVATION_STATUSES = ["final", "corrected"];

export function hashGuestResultToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function isValidGuestResultToken(token) {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

export async function getGuestResultByToken(token) {
  if (!isValidGuestResultToken(token)) {
    return null;
  }

  const admin = createAdminClient();
  const tokenHash = hashGuestResultToken(token);

  const { data: access, error: accessError } = await admin
    .from("guest_result_accesses")
    .select(
      `
        id,
        diagnostic_report_id,
        expires_at,
        revoked_at,
        access_count,
        last_accessed_at
      `,
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (accessError) {
    console.error("[getGuestResultByToken:access]", accessError);
    throw new Error("Unable to read guest access");
  }

  if (!access) {
    return null;
  }

  const expiresAtMs = new Date(access.expires_at).getTime();
  if (access.revoked_at || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return null;
  }

  const { data: report, error: reportError } = await admin
    .from("diagnostic_reports")
    .select(
      `
        id,
        status,
        created_at,
        finalized_at,
        lab_order_id,
        lab_orders!diagnostic_reports_lab_order_id_fkey!inner (
          id,
          ordered_at,
          status
        )
      `,
    )
    .eq("id", access.diagnostic_report_id)
    .in("status", FINAL_REPORT_STATUSES)
    .maybeSingle();

  if (reportError) {
    console.error("[getGuestResultByToken:report]", reportError);
    throw new Error("Unable to read guest result");
  }

  if (!report) {
    return null;
  }

  const { data: observations, error: observationsError } = await admin
    .from("observations")
    .select(
      `
        id,
        diagnostic_report_id,
        test_definition_id,
        value_numeric,
        value_text,
        value_boolean,
        unit,
        reference_range_template_id,
        reference_min,
        reference_max,
        reference_text,
        reference_source,
        flag,
        status,
        observed_at,
        created_at,
        test_definitions (
          id,
          name,
          name_fa,
          internal_code,
          value_type,
          default_unit,
          decimal_precision
        )
      `,
    )
    .eq("diagnostic_report_id", report.id)
    .in("status", CURRENT_OBSERVATION_STATUSES)
    .order("observed_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (observationsError) {
    console.error("[getGuestResultByToken:observations]", observationsError);
    throw new Error("Unable to read guest result observations");
  }

  const { data: touchedAccess, error: touchError } = await admin
    .from("guest_result_accesses")
    .update({
      access_count: Number(access.access_count || 0) + 1,
      last_accessed_at: new Date().toISOString(),
    })
    .eq("id", access.id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("id, access_count, last_accessed_at")
    .maybeSingle();

  if (touchError || !touchedAccess) {
    return null;
  }

  await recordPatientAudit({
    action: "guest_result_accessed",
    entityType: "diagnostic_report",
    entityId: report.id,
    metadata: {
      guest_access_id: access.id,
      access_count: touchedAccess.access_count,
    },
  });

  return {
    access: {
      id: access.id,
      expires_at: access.expires_at,
    },
    report: {
      id: report.id,
      status: report.status,
      created_at: report.created_at,
      finalized_at: report.finalized_at,
      lab_order_id: report.lab_order_id,
      ordered_at: report.lab_orders?.ordered_at ?? null,
    },
    observations: observations ?? [],
  };
}
