"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PENDING_ERROR = "این درخواست دیگر قابل تغییر نیست.";

function result(ok, status, message) {
  return { ok, status, message };
}

async function createDoctorNotification({
  doctorId,
  type,
  relationshipId,
  title,
  body,
}) {
  const admin = createAdminClient();

  const { error } = await admin.from("notifications").insert({
    recipient_id: doctorId,
    type,
    title,
    body,
    related_entity_type: "patient_doctor_relationship",
    related_entity_id: relationshipId,
  });

  if (error) throw error;
}

async function rollbackRelationshipStatus(relationshipId, fromStatus, toStatus) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("patient_doctor_relationships")
    .update({ status: toStatus })
    .eq("id", relationshipId)
    .eq("status", fromStatus);

  if (error) {
    console.error("[patientDoctorRequest:rollback]", error);
  }
}

export async function acceptDoctorRequest(_previousState, formData) {
  try {
    if (!(formData instanceof FormData)) {
      return result(false, "pending", "درخواست نامعتبر است.");
    }
    const user = await getSessionUser();

  if (!user?.id || user.role !== "patient") {
    return result(false, "pending", "دسترسی معتبر نیست.");
  }

  const relationshipId = String(formData.get("relationship_id") || "").trim();

  if (!relationshipId) {
    return result(false, "pending", "درخواست نامعتبر است.");
  }

  const supabase = await createClient();

  const { data: relationship, error: updateError } = await supabase
    .from("patient_doctor_relationships")
    .update({ status: "active" })
    .eq("id", relationshipId)
    .eq("patient_id", user.id)
    .eq("status", "pending")
    .select("id, doctor_id, status")
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (!relationship) {
    return result(false, "pending", PENDING_ERROR);
  }

  try {
    await createDoctorNotification({
      doctorId: relationship.doctor_id,
      type: "doctor_connection_accepted",
      relationshipId: relationship.id,
      title: "درخواست ارتباط تأیید شد",
      body: "بیمار درخواست برقراری ارتباط شما را تأیید کرده است.",
    });
  } catch (error) {
    console.error("[acceptDoctorRequest:notification]", error);
    await rollbackRelationshipStatus(relationship.id, "active", "pending");
    return result(false, "pending", "تأیید درخواست کامل نشد.");
  }

  revalidatePath("/patient/doctor-requests");
  revalidatePath("/patient/notifications");
  revalidatePath("/doctor/patients");

    return result(true, "active", "درخواست پزشک تأیید شد.");
  } catch (error) {
    console.error("[acceptDoctorRequest]", error);
    return result(false, "pending", "تأیید درخواست انجام نشد.");
  }
}

export async function rejectDoctorRequest(_previousState, formData) {
  try {
    if (!(formData instanceof FormData)) {
      return result(false, "pending", "درخواست نامعتبر است.");
    }
    const user = await getSessionUser();

  if (!user?.id || user.role !== "patient") {
    return result(false, "pending", "دسترسی معتبر نیست.");
  }

  const relationshipId = String(formData.get("relationship_id") || "").trim();

  if (!relationshipId) {
    return result(false, "pending", "درخواست نامعتبر است.");
  }

  const supabase = await createClient();

  const { data: relationship, error: updateError } = await supabase
    .from("patient_doctor_relationships")
    .update({ status: "inactive" })
    .eq("id", relationshipId)
    .eq("patient_id", user.id)
    .eq("status", "pending")
    .select("id, doctor_id, status")
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  if (!relationship) {
    return result(false, "pending", PENDING_ERROR);
  }

  try {
    await createDoctorNotification({
      doctorId: relationship.doctor_id,
      type: "doctor_connection_rejected",
      relationshipId: relationship.id,
      title: "درخواست ارتباط رد شد",
      body: "بیمار درخواست برقراری ارتباط شما را رد کرده است.",
    });
  } catch (error) {
    console.error("[rejectDoctorRequest:notification]", error);
    await rollbackRelationshipStatus(relationship.id, "inactive", "pending");
    return result(false, "pending", "رد درخواست کامل نشد.");
  }

  revalidatePath("/patient/doctor-requests");
  revalidatePath("/patient/notifications");

    return result(true, "inactive", "درخواست پزشک رد شد.");
  } catch (error) {
    console.error("[rejectDoctorRequest]", error);
    return result(false, "pending", "رد درخواست انجام نشد.");
  }
}
