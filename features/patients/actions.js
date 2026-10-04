"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findPatientForDoctor } from "@/features/patients/server";
import { requireVerifiedDoctor } from "@/features/doctor/access";
import {
  isValidIranianNationalId,
  normalizeDigits,
  normalizeIranianMobile,
} from "@/lib/utils/validation";

function fail(message) {
  return {
    ok: false,
    message,
  };
}

export async function addExistingPatient(_previousState, formData) {
  try {
    if (!(formData instanceof FormData)) {
      return fail("اطلاعات بیمار معتبر نیست.");
    }

    const doctor = await requireVerifiedDoctor();

    if (!doctor) {
      return fail("دسترسی معتبر نیست.");
    }

    const nationalId = normalizeDigits(
      String(formData.get("national_id") || "").trim(),
    );
    const rawPhone = String(formData.get("phone") || "").trim();
    const phone = normalizeIranianMobile(rawPhone);

    if (!isValidIranianNationalId(nationalId)) {
      return fail("کد ملی واردشده معتبر نیست.");
    }

    if (!phone) {
      return fail("شماره موبایل واردشده معتبر نیست.");
    }

    const patient = await findPatientForDoctor({
      doctorId: doctor.id,
      nationalId,
      phone,
    });

    if (!patient) {
      return fail("بیماری با این مشخصات پیدا نشد.");
    }

    const supabase = await createClient();

    const { data: existingRelationship, error: relationshipLookupError } =
      await supabase
        .from("patient_doctor_relationships")
        .select("status")
        .eq("patient_id", patient.id)
        .eq("doctor_id", doctor.id)
        .maybeSingle();

    if (relationshipLookupError) throw relationshipLookupError;

    if (existingRelationship?.status === "active") {
      revalidatePath("/doctor/patients");

      return {
        ok: true,
        message: "این بیمار از قبل در فهرست بیماران شماست.",
        status: "active",
        patientId: patient.id,
      };
    }

    if (existingRelationship?.status === "pending") {
      return {
        ok: true,
        message:
          "درخواست اتصال به این بیمار قبلاً ثبت شده است و در انتظار تأیید است.",
        status: "pending",
        patientId: patient.id,
      };
    }

    if (existingRelationship) {
      return fail(
        "برای این بیمار یک رابطهٔ قبلی وجود دارد و قابل ایجاد مجدد نیست.",
      );
    }

    const { data: relationship, error: relationshipInsertError } =
      await supabase
        .from("patient_doctor_relationships")
        .insert({
          patient_id: patient.id,
          doctor_id: doctor.id,
          created_by: doctor.id,
          status: "pending",
        })
        .select("id, doctor_id, patient_id")
        .single();

    if (relationshipInsertError) throw relationshipInsertError;

    const admin = createAdminClient();
    const { error: notificationError } = await admin
      .from("notifications")
      .insert({
        type: "doctor_connection_request",
        recipient_id: patient.id,
        related_entity_type: "patient_doctor_relationship",
        related_entity_id: relationship.id,
        title: "درخواست ارتباط پزشک",
        body: `دکتر ${doctor.full_name || "پزشک"} درخواست دسترسی به پرونده پزشکی شما را ارسال کرده است.`,
      });

    if (notificationError) {
      console.error("[addExistingPatient:notification]", notificationError);
      const { error: rollbackError } = await admin
        .from("patient_doctor_relationships")
        .delete()
        .eq("id", relationship.id)
        .eq("status", "pending");

      if (rollbackError) {
        console.error("[addExistingPatient:rollback]", rollbackError);
      }

      return fail("ثبت درخواست ارتباط کامل نشد.");
    }

    revalidatePath("/doctor/patients");
    revalidatePath("/patient/doctor-requests");
    revalidatePath("/patient/notifications");

    return {
      ok: true,
      message:
        "درخواست اتصال به بیمار ثبت شد و پس از تأیید بیمار، پرونده در فهرست شما نمایش داده می‌شود.",
      status: "pending",
      patientId: patient.id,
    };
  } catch (error) {
    console.error("[addExistingPatient]", error);
    return fail("ثبت درخواست ارتباط انجام نشد.");
  }
}
