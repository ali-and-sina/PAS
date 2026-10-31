"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const PENDING_ERROR = "این درخواست دیگر قابل تغییر نیست.";

function result(ok, status, message) {
  return { ok, status, message };
}

async function respondToDoctorRequest(formData, decision) {
  if (!formData || typeof formData.get !== "function") {
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
  const { data: response, error } = await supabase.rpc(
    "pas_care_command",
    {
      p_action: "relationship.respond",
      p_payload: {
        id: relationshipId,
        decision,
        scopes: decision === "accept" ? formData.getAll("scopes") : [],
      },
    },
  );

  if (error) {
    if (error.code === "P0001" || error.code === "42501") {
      return result(false, "pending", PENDING_ERROR);
    }
    throw error;
  }

  if (!response?.ok || !response.relationship_id) {
    return result(false, "pending", PENDING_ERROR);
  }

  revalidatePath("/patient/doctor-requests");
  revalidatePath("/patient/notifications");
  if (decision === "accept") revalidatePath("/doctor/patients");

  return decision === "accept"
    ? result(true, "active", "درخواست پزشک تأیید شد.")
    : result(true, "inactive", "درخواست پزشک رد شد.");
}

export async function acceptDoctorRequest(_previousState, formData) {
  try {
    return await respondToDoctorRequest(formData, "accept");
  } catch (error) {
    console.error("[acceptDoctorRequest]", error);
    return result(false, "pending", "تأیید درخواست انجام نشد.");
  }
}

export async function rejectDoctorRequest(_previousState, formData) {
  try {
    return await respondToDoctorRequest(formData, "reject");
  } catch (error) {
    console.error("[rejectDoctorRequest]", error);
    return result(false, "pending", "رد درخواست انجام نشد.");
  }
}
