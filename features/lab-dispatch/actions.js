"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_RE.test(String(value || ""));
}

function isChecked(value) {
  return value === true || value === "true" || value === "on" || value === "1";
}

function optionalNumber(value, min, max) {
  if (value === null || value === undefined || String(value).trim() === "") return { ok: true, value: null };
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return { ok: false, value: null };
  return { ok: true, value: number };
}

function stateError(message) {
  return { ok: false, message };
}

export async function submitLabRequestToBranch(_previousState, formData) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "patient") return stateError("برای ارسال درخواست، وارد حساب بیمار شوید.");

  const requestId = String(formData?.get("request_id") || "").trim();
  const branchId = String(formData?.get("branch_id") || "").trim();
  const requestedHomeCollection = isChecked(formData?.get("requested_home_collection"));
  if (!isUuid(requestId) || !isUuid(branchId)) return stateError("درخواست یا آزمایشگاه انتخاب‌شده معتبر نیست.");

  const lat = optionalNumber(formData.get("latitude"), -90, 90);
  const lon = optionalNumber(formData.get("longitude"), -180, 180);
  if (!lat.ok || !lon.ok || ((lat.value === null) !== (lon.value === null))) {
    return stateError("موقعیت واردشده معتبر نیست.");
  }

  const city = String(formData.get("city") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const contactPhone = String(formData.get("contact_phone") || "").trim();
  if (requestedHomeCollection && (city.length < 2 || address.length < 5 || contactPhone.length < 7)) {
    return stateError("برای نمونه‌گیری در منزل، شهر، نشانی دقیق و شماره تماس را وارد کنید.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_lab_request_to_branch", {
    p_request_id: requestId,
    p_branch_id: branchId,
    p_requested_home_collection: requestedHomeCollection,
    p_city: requestedHomeCollection ? city : null,
    p_address: requestedHomeCollection ? address : null,
    p_address_line2: requestedHomeCollection ? String(formData.get("address_line2") || "").trim() || null : null,
    p_postal_code: requestedHomeCollection ? String(formData.get("postal_code") || "").trim() || null : null,
    p_latitude: requestedHomeCollection ? lat.value : null,
    p_longitude: requestedHomeCollection ? lon.value : null,
    p_contact_phone: requestedHomeCollection ? contactPhone : null,
    p_access_instructions: requestedHomeCollection ? String(formData.get("access_instructions") || "").trim() || null : null,
    p_preferred_window: requestedHomeCollection ? String(formData.get("preferred_window") || "").trim() || null : null,
  });

  if (error) {
    console.error("[submitLabRequestToBranch]", error);
    const msg = String(error.message || "");
    if (msg.includes("already has a pending")) return stateError("این درخواست قبلاً برای یک آزمایشگاه ارسال شده است.");
    if (msg.includes("already accepted")) return stateError("این درخواست قبلاً توسط آزمایشگاه پذیرفته شده است.");
    if (msg.includes("does not support home collection")) return stateError("این آزمایشگاه نمونه‌گیری در منزل ارائه نمی‌دهد.");
    return stateError("ارسال درخواست به آزمایشگاه انجام نشد. اطلاعات درخواست و دسترسی حساب را بررسی کنید.");
  }

  if (!data?.ok || !data?.dispatch_id) return stateError("ارسال درخواست به آزمایشگاه انجام نشد.");

  revalidatePath("/patient/lab-orders");
  revalidatePath("/patient/dashboard");
  revalidatePath("/lab/orders");

  return {
    ok: true,
    message: requestedHomeCollection
      ? "درخواست برای آزمایشگاه ارسال شد و درخواست نمونه‌گیری در منزل نیز برای بررسی ثبت شد. زمان مراجعه پس از تأیید آزمایشگاه مشخص می‌شود."
      : "درخواست آزمایش برای آزمایشگاه انتخاب‌شده ارسال شد.",
    requestId: data.request_id,
    dispatchId: data.dispatch_id,
    homeCollectionRequestId: data.home_collection_request_id || null,
  };
}

export async function cancelPatientLabDispatch(dispatchId) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "patient" || !isUuid(dispatchId)) {
    return { ok: false, message: "درخواست لغو معتبر نیست." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_lab_dispatch_by_patient", {
    p_dispatch_id: dispatchId,
  });
  if (error) {
    console.error("[cancelPatientLabDispatch]", error);
    return { ok: false, message: "لغو ارسال درخواست انجام نشد؛ ممکن است آزمایشگاه قبلاً آن را پذیرفته باشد." };
  }

  revalidatePath("/patient/lab-orders");
  revalidatePath("/lab/orders");
  return { ok: true, data };
}

export async function cancelPhysicianLabRequest(requestId) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "doctor" || user.is_verified !== true || !isUuid(requestId)) {
    return { ok: false, message: "دسترسی یا شناسه درخواست معتبر نیست." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_physician_lab_request", { p_request_id: requestId });
  if (error) {
    console.error("[cancelPhysicianLabRequest]", error);
    return { ok: false, message: "لغو درخواست آزمایش انجام نشد." };
  }

  revalidatePath("/doctor/lab-orders");
  revalidatePath("/patient/lab-orders");
  return { ok: true, data };
}

export async function acceptLabDispatch(dispatchId) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "laboratory" || !isUuid(dispatchId)) {
    return { ok: false, message: "دسترسی به این درخواست مجاز نیست." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_lab_dispatch", { p_dispatch_id: dispatchId });
  if (error) {
    console.error("[acceptLabDispatch]", error);
    return { ok: false, message: "پذیرش درخواست انجام نشد. عضویت شعبه و وضعیت درخواست را بررسی کنید." };
  }

  revalidatePath("/lab/orders");
  revalidatePath("/lab/dispatches");
  revalidatePath("/lab/home-collection");
  revalidatePath("/doctor/lab-orders");
  revalidatePath("/patient/lab-orders");
  return { ok: true, data };
}

export async function rejectLabDispatch(_previousState, formData) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "laboratory") return stateError("دسترسی به این درخواست مجاز نیست.");

  const dispatchId = String(formData?.get("dispatch_id") || "").trim();
  const responseNote = String(formData?.get("response_note") || "").trim();
  if (!isUuid(dispatchId)) return stateError("شناسه درخواست معتبر نیست.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reject_lab_dispatch", {
    p_dispatch_id: dispatchId,
    p_response_note: responseNote || null,
  });
  if (error) {
    console.error("[rejectLabDispatch]", error);
    return stateError("رد درخواست انجام نشد.");
  }

  revalidatePath("/lab/orders");
  revalidatePath("/lab/dispatches");
  revalidatePath("/lab/home-collection");
  revalidatePath("/patient/lab-orders");
  revalidatePath("/doctor/lab-orders");
  return { ok: true, message: "درخواست رد شد و بیمار می‌تواند آزمایشگاه دیگری انتخاب کند.", data };
}
