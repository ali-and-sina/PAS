"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireVerifiedDoctor } from "@/features/doctor/access";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message) => ({ ok: false, message });

export async function createLabOrder(_previousState, formData) {
  const doctor = await requireVerifiedDoctor();
  if (!doctor?.id) return fail("دسترسی پزشک معتبر نیست.");

  const patientId = String(formData?.get("patient_id") || "").trim();
  const clinicalNote = String(formData?.get("clinical_note") || "").trim().slice(0, 2000);
  if (!UUID_RE.test(patientId)) return fail("بیمار انتخاب‌شده معتبر نیست.");

  let items = [];
  const rawItems = String(formData?.get("items_json") || "").trim();
  if (rawItems) {
    try { items = JSON.parse(rawItems); } catch { return fail("فهرست آزمایش‌ها معتبر نیست."); }
  } else {
    const panelId = String(formData?.get("test_panel_id") || "").trim();
    const testId = String(formData?.get("test_definition_id") || "").trim();
    if (panelId || testId) items = [{ test_panel_id: panelId || null, test_definition_id: testId || null }];
  }

  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    return fail("حداقل یک آزمایش یا پنل انتخاب کنید.");
  }

  const normalizedItems = [];
  const uniqueKeys = new Set();
  for (const item of items) {
    const panelId = String(item?.test_panel_id || "").trim();
    const testId = String(item?.test_definition_id || "").trim();
    const hasPanel = UUID_RE.test(panelId);
    const hasTest = UUID_RE.test(testId);
    if (hasPanel === hasTest) return fail("هر مورد باید دقیقاً یک پنل یا یک آزمایش مشخص داشته باشد.");
    const key = hasPanel ? `panel:${panelId}` : `test:${testId}`;
    if (uniqueKeys.has(key)) continue;
    uniqueKeys.add(key);
    normalizedItems.push({ test_panel_id: hasPanel ? panelId : null, test_definition_id: hasTest ? testId : null });
  }
  if (!normalizedItems.length) return fail("حداقل یک آزمایش یا پنل انتخاب کنید.");

  const supabase = await createClient();
  const { data: relationship, error: relationshipError } = await supabase
    .from("patient_doctor_relationships")
    .select("patient_id")
    .eq("doctor_id", doctor.id)
    .eq("patient_id", patientId)
    .eq("status", "active")
    .maybeSingle();
  if (relationshipError) {
    console.error("[createLabOrder:relationship]", relationshipError);
    return fail("بررسی دسترسی پزشک به بیمار انجام نشد.");
  }
  if (!relationship) return fail("این بیمار در فهرست بیماران فعال شما نیست.");

  const { data, error } = await supabase.rpc("create_physician_lab_request", {
    p_patient_id: patientId,
    p_clinical_note: clinicalNote || null,
    p_items: normalizedItems,
  });
  if (error) {
    console.error("[createLabOrder:physician-request]", error);
    return fail("ثبت درخواست آزمایش انجام نشد. ارتباط فعال بیمار و مجوز پزشک را بررسی کنید.");
  }

  const requestId = data?.request_id;
  if (!data?.ok || !requestId) return fail("ثبت درخواست آزمایش انجام نشد.");

  revalidatePath("/doctor/lab-orders");
  revalidatePath("/doctor/medical-services");
  revalidatePath(`/doctor/patients/${patientId}`);
  revalidatePath("/patient/lab-orders");
  revalidatePath("/patient/medical-services");
  return {
    ok: true,
    requestId,
    message: "درخواست آزمایش در پرونده بیمار ثبت شد. بیمار بعداً آزمایشگاه مقصد و شیوه نمونه‌گیری را انتخاب می‌کند.",
  };
}
