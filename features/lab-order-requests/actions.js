"use server";

import { revalidatePath } from "next/cache";

import { requireVerifiedDoctor } from "@/features/doctor/access";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Backend contract for a physician-created lab request. No destination branch
 * or home-collection choice is accepted here; those belong to the patient
 * dispatch action after the physician has saved the prescribed items.
 */
export async function createPhysicianLabRequest({ patientId, clinicalNote = "", items = [] } = {}) {
  const doctor = await requireVerifiedDoctor();
  if (!doctor?.id) return { ok: false, message: "دسترسی پزشک معتبر نیست." };
  if (!UUID_RE.test(String(patientId || ""))) return { ok: false, message: "بیمار انتخاب‌شده معتبر نیست." };
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    return { ok: false, message: "درخواست باید دست‌کم یک آزمایش داشته باشد." };
  }

  const normalizedItems = [];
  for (const item of items) {
    const panelId = String(item?.test_panel_id || "").trim();
    const testId = String(item?.test_definition_id || "").trim();
    const hasPanel = UUID_RE.test(panelId);
    const hasTest = UUID_RE.test(testId);
    if (hasPanel === hasTest) {
      return { ok: false, message: "هر ردیف باید دقیقاً یک پنل یا یک آزمایش مشخص داشته باشد." };
    }
    normalizedItems.push({
      test_panel_id: hasPanel ? panelId : null,
      test_definition_id: hasTest ? testId : null,
    });
  }

  const supabase = await createClient();
  const { data: relationship, error: relationshipError } = await supabase
    .from("patient_doctor_relationships")
    .select("patient_id")
    .eq("doctor_id", doctor.id)
    .eq("patient_id", patientId)
    .eq("status", "active")
    .maybeSingle();
  if (relationshipError) {
    console.error("[createPhysicianLabRequest:relationship]", relationshipError);
    return { ok: false, message: "بررسی دسترسی پزشک به بیمار انجام نشد." };
  }
  if (!relationship) return { ok: false, message: "این بیمار در فهرست بیماران فعال شما نیست." };

  const { data, error } = await supabase.rpc("create_physician_lab_request", {
    p_patient_id: patientId,
    p_clinical_note: String(clinicalNote || "").trim().slice(0, 2000) || null,
    p_items: normalizedItems,
  });

  if (error) {
    console.error("[createPhysicianLabRequest]", error);
    return { ok: false, message: "ثبت درخواست آزمایش انجام نشد. فهرست آزمایش‌ها و دسترسی پزشک را بررسی کنید." };
  }
  if (!data?.ok || !data?.request_id) return { ok: false, message: "ثبت درخواست آزمایش انجام نشد." };

  revalidatePath("/doctor/lab-orders");
  revalidatePath("/doctor/medical-services");
  revalidatePath(`/doctor/patients/${patientId}`);
  revalidatePath("/patient/lab-orders");
  revalidatePath("/patient/medical-services");

  return {
    ok: true,
    requestId: data.request_id,
    itemCount: data.item_count,
    status: data.status,
    message: "درخواست آزمایش ثبت شد؛ انتخاب و ارسال آن به آزمایشگاه بر عهده بیمار است.",
  };
}
