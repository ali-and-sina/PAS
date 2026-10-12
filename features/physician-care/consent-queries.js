import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getPatientContext } from "@/features/patient/auth";
import { PHYSICIAN_VOICE_CONSENT_TYPE } from "@/features/physician-care/consent-constants";

export async function getPhysicianVoiceRecordingConsentStatus() {
  const patient = await getPatientContext();
  if (!patient?.patient_id) return { granted: false, grantedAt: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consents")
    .select("granted_at")
    .eq("patient_id", patient.patient_id)
    .eq("consent_type", PHYSICIAN_VOICE_CONSENT_TYPE)
    .eq("granted", true)
    .is("revoked_at", null)
    .order("granted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return { granted: Boolean(data), grantedAt: data?.granted_at ?? null };
}
