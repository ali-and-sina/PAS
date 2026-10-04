import "server-only";

import { createClient } from "@/lib/supabase/server";

const REPORT_SELECT = `
  id,
  status,
  created_at,
  finalized_at,
  lab_order_id,
  lab_orders!diagnostic_reports_lab_order_id_fkey!inner (
    id,
    patient_id,
    doctor_id,
    laboratory_id,
    status,
    ordered_at,
    completed_at
  )
`;

async function getOwnedPatientReport(supabase, patientId, reportId) {
  const { data, error } = await supabase
    .from("diagnostic_reports")
    .select(REPORT_SELECT)
    .eq("id", reportId)
    .eq("lab_orders.patient_id", patientId)
    .in("status", ["final", "amended"])
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function getPatientReports(patientId) {
  if (!patientId) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("diagnostic_reports")
    .select(REPORT_SELECT)
    .eq("lab_orders.patient_id", patientId)
    .in("status", ["final", "amended"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getPatientReport(reportId, patientId) {
  if (!reportId || !patientId) return null;

  const supabase = await createClient();
  return getOwnedPatientReport(supabase, patientId, reportId);
}

export async function getPatientObservations(patientId, reportId) {
  if (!patientId || !reportId) return [];

  const supabase = await createClient();
  const report = await getOwnedPatientReport(
    supabase,
    patientId,
    reportId,
  );

  if (!report) return [];

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
      supersedes_observation_id,
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
    .in("status", ["final", "corrected"])
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((observation) => ({
    ...observation,
    test: Array.isArray(observation.test_definitions)
      ? observation.test_definitions[0] || null
      : observation.test_definitions || null,
  }));
}
