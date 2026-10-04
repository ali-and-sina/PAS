"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getDoctorPatient } from "@/features/patients/queries";
import { getSessionUser } from "@/lib/auth/server";

function fail(message) { return { ok: false, message }; }

export async function createPrivateNote(_previousState, formData) {
  try {
    if (!(formData instanceof FormData)) return fail("اطلاعات یادداشت معتبر نیست.");
    const doctor = await getSessionUser();
    if (!doctor || doctor.role !== "doctor" || doctor.is_verified !== true) {
      return fail("دسترسی معتبر نیست.");
    }

    const patientId = String(formData.get("patient_id") || "").trim();
  const reportId = String(formData.get("diagnostic_report_id") || "").trim() || null;
  const content = String(formData.get("content") || "").trim();

  if (!patientId || content.length < 1 || content.length > 5000) return fail("متن یادداشت را وارد کنید.");
  if (!(await getDoctorPatient(doctor.id, patientId))) return fail("این بیمار در فهرست بیماران شما نیست.");

  const supabase = await createClient();
  if (reportId) {
    const { data: report, error: reportError } = await supabase.from("diagnostic_reports").select("id, lab_order_id").eq("id", reportId).maybeSingle();
    if (reportError) throw reportError;
    if (!report) return fail("گزارش مرتبط معتبر نیست.");
    const { data: order, error: orderError } = await supabase.from("lab_orders").select("id").eq("id", report.lab_order_id).eq("doctor_id", doctor.id).eq("patient_id", patientId).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return fail("گزارش مرتبط به این بیمار تعلق ندارد.");
  }

  const { error } = await supabase.from("doctor_notes").insert({ patient_id: patientId, doctor_id: doctor.id, diagnostic_report_id: reportId, content });
  if (error) throw error;

  revalidatePath(`/doctor/patients/${patientId}`);
    return { ok: true, message: "یادداشت خصوصی ثبت شد." };
  } catch (error) {
    console.error("[createPrivateNote]", error);
    return fail("ثبت یادداشت خصوصی انجام نشد.");
  }
}
