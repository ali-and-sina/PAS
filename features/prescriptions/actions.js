"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getDoctorPatient } from "@/features/patients/queries";
import { requireVerifiedDoctor } from "@/features/doctor/access";

function fail(message) {
  return { ok: false, message };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function readOptionalText(value, maxLength) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized.length > maxLength) return undefined;
  return normalized || null;
}

export async function createPrescription(_previousState, formData) {
  try {
    if (!formData || typeof formData.get !== "function") {
      return fail("اطلاعات فرم نسخه معتبر نیست؛ صفحه را تازه‌سازی کنید.");
    }

    const doctor = await requireVerifiedDoctor();
    if (!doctor?.id) return fail("دسترسی معتبر نیست.");

    const patientId = String(formData.get("patient_id") || "").trim();
    const rawReportId = String(formData.get("diagnostic_report_id") || "").trim();
    const reportId = rawReportId || null;
    const rawItems = String(formData.get("items_json") || "");

    if (!isUuid(patientId) || !rawItems) {
      return fail("بیمار و حداقل یک قلم دارو الزامی است.");
    }
    if (reportId && !isUuid(reportId)) {
      return fail("شناسه گزارش آزمایش معتبر نیست.");
    }

    let items;
    try {
      items = JSON.parse(rawItems);
    } catch {
      return fail("اطلاعات داروها معتبر نیست.");
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
      return fail("تعداد اقلام نسخه باید بین ۱ تا ۲۰ باشد.");
    }

    const normalizedItems = [];
    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return fail("ساختار یکی از اقلام دارو معتبر نیست.");
      }

      const medicationName = readOptionalText(item.medication_name, 150);
      const dosage = readOptionalText(item.dosage, 100);
      const frequency = readOptionalText(item.frequency, 100);
      const duration = readOptionalText(item.duration, 100);
      const instructions = readOptionalText(item.instructions, 1000);

      if (
        !medicationName || !dosage || !frequency ||
        medicationName === undefined || dosage === undefined || frequency === undefined ||
        duration === undefined || instructions === undefined
      ) {
        return fail("نام دارو، دوز و تعداد مصرف را کامل کنید و طول فیلدها را بررسی کنید.");
      }

      const quantity = item.quantity_units === "" || item.quantity_units == null ? null : Number(item.quantity_units);
      const perDay = item.units_per_day === "" || item.units_per_day == null ? null : Number(item.units_per_day);
      if ((quantity !== null && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000)) ||
          (perDay !== null && (!Number.isFinite(perDay) || perDay <= 0 || perDay > 1000))) {
        return fail("مقدار دارو و مقدار مصرف روزانه معتبر نیست.");
      }
      const unitLabel = readOptionalText(item.unit_label || "عدد",30);
      if (!unitLabel || (item.as_needed !== undefined && typeof item.as_needed !== "boolean")) return fail("واحد یا برنامهٔ مصرف معتبر نیست.");
      normalizedItems.push({
        medication_name: medicationName,
        dosage,
        frequency,
        duration,
        instructions,
        quantity_units: quantity,
        units_per_day: item.as_needed ? null : perDay,
        unit_label: unitLabel,
        as_needed: item.as_needed === true,
      });
    }

    // Keep the user-facing authorization check for a helpful error; the RPC
    // independently rechecks role, active relationship, report ownership and
    // inserts the prescription + all items in a single database transaction.
    const patient = await getDoctorPatient(doctor.id, patientId);
    if (!patient) return fail("این بیمار در فهرست بیماران شما نیست.");

    const supabase = await createClient();
    const { data: prescriptionId, error } = await supabase.rpc(
      "create_prescription_with_items",
      {
        p_patient_id: patientId,
        p_diagnostic_report_id: reportId,
        p_items: normalizedItems,
      },
    );

    if (error) {
      console.error("[createPrescription:atomic_insert]", error);
      const message = String(error.message || "").toLowerCase();
      if (error.code === "42501" || message.includes("relationship") || message.includes("report")) {
        return fail("اجازه ثبت نسخه برای بیمار یا گزارش انتخاب‌شده وجود ندارد.");
      }
      return fail("ثبت نسخه انجام نشد. لطفاً اطلاعات واردشده را بررسی کنید.");
    }

    if (!prescriptionId) return fail("شناسه نسخه از دیتابیس دریافت نشد.");

    revalidatePath("/doctor/prescriptions");
    revalidatePath(`/doctor/patients/${patientId}`);
    revalidatePath("/patient/prescriptions");
    revalidatePath("/patient/health-record");
    revalidatePath("/patient/dashboard");
    return { ok: true, message: "نسخه با موفقیت ثبت شد.", prescriptionId };
  } catch (error) {
    console.error("[createPrescription]", error);
    return fail("ثبت نسخه انجام نشد. لطفاً دوباره تلاش کنید.");
  }
}
