import "server-only";

import { createClient } from "@/lib/supabase/server";

async function getPatientFinalReportIds(supabase, patientId) {
  const { data, error } = await supabase
    .from("diagnostic_reports")
    .select(
      `
      id,
      lab_orders!diagnostic_reports_lab_order_id_fkey!inner (
        patient_id
      )
    `,
    )
    .eq("lab_orders.patient_id", patientId)
    .in("status", ["final", "amended"]);

  if (error) throw error;
  return (data || []).map((row) => row.id);
}

export async function getPatientTrendTests(patientId) {
  if (!patientId) return [];

  const supabase = await createClient();
  const reportIds = await getPatientFinalReportIds(
    supabase,
    patientId,
  );

  if (!reportIds.length) return [];

  const { data, error } = await supabase
    .from("observations")
    .select(
      `
      test_definition_id,
      diagnostic_report_id,
      test_definitions (
        id,
        name,
        name_fa,
        internal_code,
        value_type,
        default_unit
      )
    `,
    )
    .in("diagnostic_report_id", reportIds)
    .in("status", ["final", "corrected"]);

  if (error) throw error;

  const unique = new Map();
  for (const row of data || []) {
    const test = Array.isArray(row.test_definitions)
      ? row.test_definitions[0]
      : row.test_definitions;

    if (!test) continue;

    unique.set(test.id, {
      ...test,
      display_name: test.name_fa || test.name,
      code: test.internal_code,
    });
  }

  return [...unique.values()];
}

export async function getPatientTrend(patientId, testDefinitionId) {
  if (!patientId || !testDefinitionId) return [];

  const supabase = await createClient();
  const reportIds = await getPatientFinalReportIds(
    supabase,
    patientId,
  );

  if (!reportIds.length) return [];

  const { data, error } = await supabase
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
      reference_min,
      reference_max,
      reference_text,
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
        default_unit
      )
    `,
    )
    .in("diagnostic_report_id", reportIds)
    .eq("test_definition_id", testDefinitionId)
    .in("status", ["final", "corrected"])
    .order("observed_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => ({
    ...row,
    test: Array.isArray(row.test_definitions)
      ? row.test_definitions[0] || null
      : row.test_definitions || null,
  }));
}
