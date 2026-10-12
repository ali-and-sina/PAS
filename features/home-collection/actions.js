"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COLLECTION_STATUSES = new Set(["approved", "rejected", "scheduled", "dispatched", "cancelled"]);

function validUuid(value) {
  return UUID_RE.test(String(value || ""));
}

function errorResult(message) {
  return { ok: false, message };
}

export async function advanceHomeCollectionRequest(_previousState, formData) {
  const user = await getSessionUser();
  const requestId = String(formData?.get("home_collection_request_id") || "").trim();
  const nextStatus = String(formData?.get("next_status") || "").trim();
  const isLaboratory = user?.role === "laboratory";
  const isOwnerActor = user?.role === "patient" || user?.role === "doctor";

  if (!user?.id || !validUuid(requestId) || !COLLECTION_STATUSES.has(nextStatus)) {
    return errorResult("اطلاعات درخواست نمونه‌گیری معتبر نیست.");
  }
  if (nextStatus === "cancelled" ? !(isLaboratory || isOwnerActor) : !isLaboratory) {
    return errorResult("برای این عملیات مجوز ندارید.");
  }

  const scheduledRaw = String(formData.get("scheduled_for") || "").trim();
  const scheduledFor = scheduledRaw ? new Date(scheduledRaw) : null;
  const timezoneOffsetRaw = String(formData.get("timezone_offset_minutes") || "").trim();
  const timezoneOffset = timezoneOffsetRaw === "" ? 0 : Number(timezoneOffsetRaw);
  if (nextStatus === "scheduled" && Number.isFinite(timezoneOffset) && scheduledFor && !Number.isNaN(scheduledFor.getTime())) {
    // datetime-local contains wall-clock time without a zone. Adjust the parsed
    // server-side date using the browser's UTC offset to retain the user's time.
    scheduledFor.setMinutes(scheduledFor.getMinutes() + timezoneOffset);
  }
  if (nextStatus === "scheduled" && (!Number.isFinite(timezoneOffset) || timezoneOffset < -840 || timezoneOffset > 840 || !scheduledFor || Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now())) {
    return errorResult("زمان مراجعه باید معتبر و در آینده باشد.");
  }

  const collectorId = String(formData.get("collector_profile_id") || "").trim();
  if (nextStatus === "scheduled" && !validUuid(collectorId)) {
    return errorResult("نمونه‌گیر انتخاب‌شده معتبر نیست.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("advance_home_collection_request", {
    p_home_collection_request_id: requestId,
    p_next_status: nextStatus,
    p_scheduled_for: nextStatus === "scheduled" ? scheduledFor.toISOString() : null,
    p_collector_profile_id: nextStatus === "scheduled" ? collectorId : null,
    p_note: String(formData.get("note") || "").trim().slice(0, 1000) || null,
  });

  if (error) {
    console.error("[advanceHomeCollectionRequest]", error);
    return errorResult("تغییر وضعیت نمونه‌گیری انجام نشد. مجوز شعبه و ترتیب مراحل را بررسی کنید.");
  }

  revalidatePath("/lab/home-collection");
  revalidatePath("/lab/orders");
  revalidatePath("/patient/lab-orders");
  revalidatePath("/patient/notifications");
  return { ok: true, message: "وضعیت نمونه‌گیری به‌روزرسانی شد.", data };
}

export async function updateOwnHomeCollectionAddress(_previousState, formData) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "patient") return errorResult("فقط بیمار می‌تواند نشانی نمونه‌گیری را ثبت کند.");

  const requestId = String(formData?.get("home_collection_request_id") || "").trim();
  const city = String(formData?.get("city") || "").trim();
  const address = String(formData?.get("address") || "").trim();
  const phone = String(formData?.get("contact_phone") || "").trim();
  if (!validUuid(requestId) || city.length < 2 || address.length < 5 || phone.length < 7) {
    return errorResult("شهر، نشانی دقیق و شماره تماس معتبر الزامی است.");
  }

  const latRaw = String(formData.get("latitude") || "").trim();
  const lonRaw = String(formData.get("longitude") || "").trim();
  const latitude = latRaw ? Number(latRaw) : null;
  const longitude = lonRaw ? Number(lonRaw) : null;
  if ((latitude === null) !== (longitude === null)
    || (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90))
    || (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
    return errorResult("مختصات موقعیت معتبر نیست.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_home_collection_private_details", {
    p_home_collection_request_id: requestId,
    p_city: city,
    p_address: address,
    p_address_line2: String(formData.get("address_line2") || "").trim() || null,
    p_postal_code: String(formData.get("postal_code") || "").trim() || null,
    p_latitude: latitude,
    p_longitude: longitude,
    p_contact_phone: phone,
    p_access_instructions: String(formData.get("access_instructions") || "").trim() || null,
    p_preferred_window: String(formData.get("preferred_window") || "").trim() || null,
  });

  if (error) {
    console.error("[updateOwnHomeCollectionAddress]", error);
    return errorResult("ثبت نشانی نمونه‌گیری انجام نشد.");
  }

  revalidatePath("/patient/lab-orders");
  return { ok: true, message: "نشانی نمونه‌گیری ثبت شد.", data };
}

/** Reads the exact address only after an authenticated laboratory action. */
export async function getHomeCollectionPrivateDetailsAction(homeCollectionRequestId) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "laboratory" || !validUuid(homeCollectionRequestId)) {
    return { ok: false, message: "نمایش نشانی برای این حساب مجاز نیست." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_home_collection_private_details", {
    p_home_collection_request_id: homeCollectionRequestId,
  });
  if (error) {
    console.error("[getHomeCollectionPrivateDetailsAction]", error);
    return { ok: false, message: "نشانی خصوصی در دسترس نیست یا این درخواست به شعبهٔ شما تعلق ندارد." };
  }
  // This is a read-only action. Do not invalidate the list and trigger extra queries.
  return { ok: true, data };
}
