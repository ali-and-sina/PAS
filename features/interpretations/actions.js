"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

function fail(message) { return { ok: false, message }; }

import { requireVerifiedDoctor } from "@/features/doctor/access";

export async function createInterpretation(_previousState, formData) {
  try {
    if (!(formData instanceof FormData)) return fail("اطلاعات تفسیر معتبر نیست.");
    const doctor = await requireVerifiedDoctor();
  if (!doctor) return fail("دسترسی معتبر نیست.");

  const reportId = String(formData.get("diagnostic_report_id") || "").trim();
  const content = String(formData.get("content") || "").trim();
  const visible = formData.get("is_visible_to_patient") !== "false";

  if (!reportId || content.length < 3 || content.length > 5000) {
    return fail("متن تفسیر را کامل وارد کنید.");
  }

  const supabase = await createClient();
  const { data: report, error: reportError } = await supabase
    .from("diagnostic_reports")
    .select("id, lab_order_id, status")
    .eq("id", reportId)
    .maybeSingle();

  if (reportError) throw reportError;
  if (!report || !["final", "amended"].includes(report.status)) return fail("گزارش انتخاب‌شده قابل تفسیر نیست.");

  const { data: order, error: orderError } = await supabase
    .from("lab_orders")
    .select("id, patient_id")
    .eq("id", report.lab_order_id)
    .eq("doctor_id", doctor.id)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) return fail("گزارش متعلق به شما نیست.");

  const { error } = await supabase.from("doctor_interpretations").insert({
    diagnostic_report_id: reportId,
    doctor_id: doctor.id,
    content,
    is_visible_to_patient: visible,
  });

  if (error) throw error;

  revalidatePath("/doctor/interpretations");
  revalidatePath(`/doctor/patients/${order.patient_id}`);
    return { ok: true, message: "تفسیر با موفقیت ثبت شد." };
  } catch (error) {
    console.error("[createInterpretation]", error);
    return fail("ثبت تفسیر انجام نشد.");
  }
}
