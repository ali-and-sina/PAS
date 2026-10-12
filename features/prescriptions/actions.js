"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getDoctorPatient } from "@/features/patients/queries";

function fail(message) { return { ok: false, message }; }

import { requireVerifiedDoctor } from "@/features/doctor/access";

export async function createPrescription(_previousState, formData) {
  const doctor = await requireVerifiedDoctor();
  if (!doctor) return fail("دسترسی معتبر نیست.");

  const patientId = String(formData.get("patient_id") || "").trim();
  const reportId = String(formData.get("diagnostic_report_id") || "").trim() || null;
  const rawItems = String(formData.get("items_json") || "");

  if (!patientId || !rawItems) return fail("بیمار و حداقل یک قلم دارو الزامی است.");

  let items;
  try { items = JSON.parse(rawItems); } catch { return fail("اطلاعات داروها معتبر نیست."); }
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) return fail("تعداد اقلام نسخه معتبر نیست.");

  const normalizedItems = items.map((item) => ({
    medication_name: String(item?.medication_name || "").trim(),
    dosage: String(item?.dosage || "").trim(),
    frequency: String(item?.frequency || "").trim(),
    duration: String(item?.duration || "").trim() || null,
    instructions: String(item?.instructions || "").trim() || null,
  }));

  if (normalizedItems.some((item) => !item.medication_name || !item.dosage || !item.frequency)) return fail("نام دارو، دوز و تعداد مصرف را کامل کنید.");

  const patient = await getDoctorPatient(doctor.id, patientId);
  if (!patient) return fail("این بیمار در فهرست بیماران شما نیست.");

  const supabase = await createClient();
  if (reportId) {
    const { data: report, error: reportError } = await supabase.from("diagnostic_reports").select("id, lab_order_id").eq("id", reportId).maybeSingle();
    if (reportError) throw reportError;
    if (!report) return fail("گزارش انتخاب‌شده معتبر نیست.");
    const { data: order, error: orderError } = await supabase.from("lab_orders").select("id, patient_id").eq("id", report.lab_order_id).eq("doctor_id", doctor.id).eq("patient_id", patientId).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return fail("گزارش انتخاب‌شده به این بیمار یا پزشک تعلق ندارد.");
  }

  const { data: prescription, error: prescriptionError } = await supabase
    .from("prescriptions")
    .insert({ patient_id: patientId, doctor_id: doctor.id, diagnostic_report_id: reportId, status: "active" })
    .select("id")
    .single();

  if (prescriptionError) throw prescriptionError;

  const { error: itemsError } = await supabase.from("prescription_items").insert(
    normalizedItems.map((item) => ({ ...item, prescription_id: prescription.id })),
  );

  if (itemsError) throw itemsError;

  revalidatePath("/doctor/prescriptions");
  revalidatePath(`/doctor/patients/${patientId}`);
  revalidatePath("/patient/prescriptions");
  revalidatePath("/patient/health-record");
  revalidatePath("/patient/dashboard");
  return { ok: true, message: "نسخه با موفقیت ثبت شد." };
}
