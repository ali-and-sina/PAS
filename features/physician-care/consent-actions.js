"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePatient } from "@/features/patient/auth";
import { PHYSICIAN_VOICE_CONSENT_TYPE } from "@/features/physician-care/consent-constants";

function fail(message) {
  return { ok: false, message };
}

export async function grantPhysicianVoiceRecordingConsent() {
  try {
    const patient = await requirePatient();
    const supabase = await createClient();

    const { data: existing, error: selectError } = await supabase
      .from("consents")
      .select("id")
      .eq("patient_id", patient.patient_id)
      .eq("consent_type", PHYSICIAN_VOICE_CONSENT_TYPE)
      .eq("granted", true)
      .is("revoked_at", null)
      .limit(1)
      .maybeSingle();
    if (selectError) throw selectError;
    if (existing) return { ok: true, alreadyGranted: true };

    const { data, error } = await supabase
      .from("consents")
      .insert({
        patient_id: patient.patient_id,
        consent_type: PHYSICIAN_VOICE_CONSENT_TYPE,
        granted: true,
        revoked_at: null,
      })
      .select("id, consent_type, granted, granted_at, revoked_at")
      .single();
    if (error) {
      // A competing request may have created the active row after our read.
      if (error.code === "23505") return { ok: true, alreadyGranted: true };
      throw error;
    }

    revalidatePath("/patient/profile");
    revalidatePath("/doctor/patients");
    revalidatePath("/doctor/patients/[patientId]", "page");
    return { ok: true, data };
  } catch (error) {
    console.error("[grantPhysicianVoiceRecordingConsent]", error);
    return fail("ثبت رضایت انجام نشد. لطفاً پس از ورود به حساب بیمار دوباره تلاش کنید.");
  }
}

export async function revokePhysicianVoiceRecordingConsent() {
  try {
    const patient = await requirePatient();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("consents")
      .update({ granted: false, revoked_at: new Date().toISOString() })
      .eq("patient_id", patient.patient_id)
      .eq("consent_type", PHYSICIAN_VOICE_CONSENT_TYPE)
      .eq("granted", true)
      .is("revoked_at", null)
      .select("id");
    if (error) throw error;

    revalidatePath("/patient/profile");
    revalidatePath("/doctor/patients");
    revalidatePath("/doctor/patients/[patientId]", "page");
    return { ok: true, revoked: data?.length ?? 0 };
  } catch (error) {
    console.error("[revokePhysicianVoiceRecordingConsent]", error);
    return fail("لغو رضایت انجام نشد. لطفاً دوباره تلاش کنید.");
  }
}
