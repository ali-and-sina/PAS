"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseCoordinate(value, min, max) {
  if (value === null || value === undefined || String(value).trim() === "") return { valid: true, value: null };
  const number = Number(value);
  return { valid: Number.isFinite(number) && number >= min && number <= max, value: number };
}

function checkbox(value) {
  return value === true || value === "on" || value === "true" || value === "1";
}

export async function saveLaboratoryBranch(_previousState, formData) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "admin") return { ok: false, message: "دسترسی مدیر سامانه لازم است." };

  const branchId = String(formData?.get("branch_id") || "").trim() || null;
  const organizationId = String(formData?.get("organization_id") || "").trim();
  const displayName = String(formData?.get("display_name") || "").trim();
  const city = String(formData?.get("city") || "").trim();
  const address = String(formData?.get("address") || "").trim();
  const latitude = parseCoordinate(formData?.get("latitude"), -90, 90);
  const longitude = parseCoordinate(formData?.get("longitude"), -180, 180);

  if ((branchId && !UUID_RE.test(branchId)) || !UUID_RE.test(organizationId)) {
    return { ok: false, message: "شناسه شعبه یا سازمان معتبر نیست." };
  }
  if (displayName.length < 2 || displayName.length > 160) {
    return { ok: false, message: "نام نمایشی شعبه باید بین ۲ تا ۱۶۰ نویسه باشد." };
  }
  if (!latitude.valid || !longitude.valid || ((latitude.value === null) !== (longitude.value === null))) {
    return { ok: false, message: "مختصات جغرافیایی معتبر نیست." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_upsert_laboratory_branch", {
    p_branch_id: branchId,
    p_organization_id: organizationId,
    p_display_name: displayName,
    p_city: city || null,
    p_address: address || null,
    p_latitude: latitude.value,
    p_longitude: longitude.value,
    p_is_active: checkbox(formData.get("is_active")),
    p_supports_home_collection: checkbox(formData.get("supports_home_collection")),
  });

  if (error) {
    console.error("[saveLaboratoryBranch]", error);
    return { ok: false, message: "ثبت اطلاعات شعبه انجام نشد. سازمان انتخاب‌شده و داده‌های واردشده را بررسی کنید." };
  }

  revalidatePath("/admin/laboratories");
  revalidatePath("/admin/laboratories/branches");
  revalidatePath("/patient/lab-orders");
  revalidatePath("/patient/medical-services");
  return { ok: true, message: "اطلاعات شعبه آزمایشگاه ثبت شد.", branchId: data };
}


const BRANCH_ROLES = new Set(["manager", "reception", "laboratory_staff", "member"]);

/** Grants or revokes an existing laboratory account's membership in a branch. */
export async function saveLaboratoryBranchMember(_previousState, formData) {
  const user = await getSessionUser();
  if (!user?.id || user.role !== "admin") {
    return { ok: false, message: "دسترسی مدیر سامانه لازم است." };
  }

  const branchId = String(formData?.get("branch_id") || "").trim();
  const profileId = String(formData?.get("profile_id") || "").trim();
  const roleInBranch = String(formData?.get("role_in_branch") || "member").trim();
  const isActive = checkbox(formData?.get("is_active"));

  if (!UUID_RE.test(branchId) || !UUID_RE.test(profileId) || !BRANCH_ROLES.has(roleInBranch)) {
    return { ok: false, message: "شعبه، حساب آزمایشگاه یا نقش انتخاب‌شده معتبر نیست." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_laboratory_branch_member", {
    p_branch_id: branchId,
    p_profile_id: profileId,
    p_role_in_branch: roleInBranch,
    p_is_active: isActive,
  });

  if (error) {
    console.error("[saveLaboratoryBranchMember]", error);
    return { ok: false, message: "تغییر دسترسی شعبه انجام نشد. بررسی کن حساب آزمایشگاه به همین سازمان تعلق داشته باشد." };
  }

  revalidatePath("/admin/laboratories");
  revalidatePath("/admin/laboratories/branches");
  revalidatePath("/lab/orders");
  revalidatePath("/patient/lab-orders");
  revalidatePath("/patient/medical-services");
  return {
    ok: true,
    message: isActive ? "عضویت حساب در شعبه فعال شد." : "عضویت حساب در شعبه غیرفعال شد.",
    memberId: data,
  };
}
